import { Transform } from 'astx'
import type { IpcMatch, AstxWorkerPool } from 'astx/node'
import type * as AstxNodeTypes from 'astx/node'
import { TypedEmitter } from 'tiny-typed-emitter'
import * as vscode from 'vscode'
import { debounce, isEqual } from 'lodash'
import { convertGlobPattern, joinPatterns } from './glob/convertGlobPattern'
import { AstxParser } from './SearchReplaceView/SearchReplaceViewTypes'
import { AstxExtension } from './extension'
import fs from 'fs/promises'

export type TransformResultEvent = {
  file: vscode.Uri
  source: string
  transformed?: string
  reports?: unknown[]
  matches: readonly IpcMatch[]
  error?: Error
}

export type ProgressEvent = {
  completed: number
  total: number
}

interface FsEntry {
  name: string
  isDirectory(): boolean
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

export type Params = {
  find?: string
  replace?: string
  useTransformFile?: boolean
  transformFile?: string
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
    this.startupPromise.catch(() => {
      // no-op
    })
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
    this.stop()
    await this.pool.end()
  }

  runSoon: () => void = debounce(() => this.run(), 250)

  run(): void {
    this.stop()

    const abortController = new AbortController()
    this.abortController = abortController
    const { signal } = abortController

    this.emit('start')

    this.extension.channel.appendLine(
      `running... ${JSON.stringify(this._params)}`
    )

    const {
      find,
      replace,
      useTransformFile,
      parser,
      prettier,
      babelGeneratorHack,
      preferSimpleReplacement,
    } = this._params
    let { transformFile } = this._params
    const workspaceFolders =
      vscode.workspace.workspaceFolders?.map((f) => f.uri.path) || []

    if (!workspaceFolders.length) {
      this.extension.channel.appendLine('no workspace folders found')
      this.emit('done')
      return
    }
    if (useTransformFile) {
      if (!transformFile) {
        this.extension.channel.appendLine('no transform file')
        this.emit('done')
        return
      }
      transformFile = this.extension.resolveFsPath(transformFile).fsPath
    } else {
      if (!find?.trim()) {
        this.extension.channel.appendLine('find expression is empty')
        this.emit('done')
        return
      }
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

    const fileDocs: Map<string, vscode.TextDocument> = new Map()
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme === 'file') fileDocs.set(doc.uri.fsPath, doc)
    }

    const Fs = {
      readFile: async (file: string, encoding: string): Promise<string> => {
        const doc = fileDocs.get(file)
        if (doc) return doc.getText()
        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(file))
        return new TextDecoder(encoding === 'utf8' ? 'utf-8' : encoding).decode(
          raw
        )
      },
      readdir: async (dir: string): Promise<FsEntry[]> => {
        const entries = await vscode.workspace.fs.readDirectory(
          vscode.Uri.file(dir)
        )
        return entries.map(([name, type]) => ({
          name,
          isDirectory: () => (type & vscode.FileType.Directory) !== 0,
        }))
      },
      realpath: fs.realpath,
    }

    ;(async () => {
      try {
        await this.startupPromise
        for await (const next of this.pool.runTransform({
          paths: [include],
          exclude,
          ...(useTransformFile ? { transformFile } : { transform }),
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
          fs: Fs,
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
            result: { file, source = '', transformed, matches, reports, error },
          } = next
          if (
            !matches?.length &&
            !reports?.length &&
            !error &&
            (transformed == null || transformed === source)
          ) {
            continue
          }
          if (transformed != null && transformed !== source) {
            this.transformResults.set(file, {
              source,
              transformed,
            })
          }
          const event: TransformResultEvent = {
            file: vscode.Uri.file(file),
            source,
            transformed,
            reports,
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
        this.extension.channel.appendLine('run ended')
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
