import { Transform } from 'astx'
import type { IpcMatch, AstxWorkerPool } from 'astx/node'
import type * as AstxNodeTypes from 'astx/node'
import { TypedEmitter } from 'tiny-typed-emitter'
import * as vscode from 'vscode'
import { debounce, isEqual } from 'lodash'
import { convertGlobPattern, joinPatterns } from './glob/convertGlobPattern'
import { AstxParser } from './SearchReplaceView/SearchReplaceViewTypes'
import { AstxExtension } from './extension'

export type TransformResultEvent = {
  file: vscode.Uri
  source: string
  transformed?: string
  matches: readonly IpcMatch[]
  error?: Error
}

export type ProgressEvent = {
  completed: number
  total: number
}

export interface AstxRunnerEvents {
  result: (options: TransformResultEvent) => void
  stop: () => void
  start: () => void
  progress: (options: ProgressEvent) => void
  done: () => void
  error: (error: Error) => void
  replaceDone: () => void
}

type Params = {
  find?: string
  replace?: string
  include?: string
  exclude?: string
  parser?: AstxParser
  prettier?: boolean
  babelGeneratorHack?: boolean
  preferSimpleReplacement?: boolean
}

export class AstxRunner extends TypedEmitter<AstxRunnerEvents> {
  private _params: Params = {
    parser: 'babel',
    prettier: true,
    preferSimpleReplacement: false,
  }
  private astxNode: AstxNodeTypes
  private abortController: AbortController | undefined
  private pool: AstxWorkerPool
  private transformResults: Map<
    string,
    {
      source: string
      transformed: string
    }
  > = new Map()
  private startupPromise: Promise<void> = Promise.reject(
    new Error('not started')
  )

  constructor(private extension: AstxExtension) {
    super()
  }

  async startup(): Promise<void> {
    this.startupPromise = (async () => {
      this.astxNode = await this.extension.importAstxNode()
      this.pool = new this.astxNode.AstxWorkerPool()
    })()
    await this.startupPromise
  }

  get params(): Params {
    return this._params
  }

  set params(params: Params) {
    if (!isEqual(this._params, params)) {
      this._params = params
      this.runSoon()
    }
  }

  stop(): void {
    this.abortController?.abort()
    this.transformResults.clear()
    this.emit('stop')
  }

  async restart(): Promise<void> {
    const oldPool = this.pool
    await this.startup()
    this.extension.channel.appendLine(
      'created new worker pool. ending old worker pool...'
    )
    await oldPool?.end()
    this.extension.channel.appendLine('successfully ended old worker pool')
  }

  async shutdown(): Promise<void> {
    await this.pool.end()
  }

  runSoon: () => void = debounce(() => this.run(), 250)

  run(): void {
    this.stop()

    const abortController = new AbortController()
    this.abortController = abortController
    const { signal } = abortController

    this.emit('start')

    const {
      find,
      replace,
      parser,
      prettier,
      babelGeneratorHack,
      preferSimpleReplacement,
    } = this._params
    const workspaceFolders =
      vscode.workspace.workspaceFolders?.map((f) => f.uri.path) || []
    if (!workspaceFolders.length || !find?.trim()) {
      this.emit('done')
      return
    }

    const include = this._params.include
      ? convertGlobPattern(this._params.include, workspaceFolders)
      : joinPatterns(workspaceFolders)
    const exclude = this._params.exclude
      ? convertGlobPattern(this._params.exclude, workspaceFolders)
      : undefined
    const transform: Transform = {
      find,
      replace,
    }

    ;(async () => {
      try {
        await this.startupPromise
        for await (const next of this.pool.runTransform({
          paths: [include],
          exclude,
          transform,
          config: {
            parser,
            parserOptions:
              (parser === 'babel' || parser === 'babel/auto') &&
              babelGeneratorHack
                ? { preserveFormat: 'generatorHack' }
                : undefined,
            prettier,
            preferSimpleReplacement,
          },
        })) {
          if (signal?.aborted) return
          if (next.type === 'progress') {
            const { completed, total } = next
            this.emit('progress', {
              completed,
              total,
            })
            continue
          }
          const {
            result: { file, source = '', transformed, matches, error },
          } = next
          if (transformed) {
            this.transformResults.set(file, {
              source,
              transformed,
            })
          }
          if (!matches?.length && !error) continue
          const event: TransformResultEvent = {
            file: vscode.Uri.file(file),
            source,
            transformed,
            matches: matches || [],
            error: error ? this.astxNode.invertIpcError(error) : null,
          }
          this.emit('result', event)
        }
        if (signal?.aborted) return
        this.emit('done')
      } catch (error) {
        if (signal?.aborted) return
        if (error instanceof Error) {
          this.extension.logError(error)
          this.emit('error', error)
        }
      } finally {
        abortController.abort()
        if (this.abortController === abortController) {
          this.abortController = undefined
        }
      }
    })()
  }

  async replace(): Promise<void> {
    const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit()
    for (const [
      file,
      { source, transformed },
    ] of this.transformResults.entries()) {
      edit.replace(
        vscode.Uri.file(file),
        new vscode.Range(new vscode.Position(0, 0), endPosition(source)),
        transformed
      )
    }
    await vscode.workspace.applyEdit(edit)
    this.transformResults.clear()
    this.emit('stop')
  }
}

function endPosition(s: string): vscode.Position {
  let line = 0,
    column = 0
  const rx = /\r\n?|\n/gm
  let match
  while ((match = rx.exec(s))) {
    line++
    column = s.length - match.index + match[0].length
  }
  return new vscode.Position(line, column)
}
