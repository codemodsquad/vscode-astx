import { Transform } from 'astx'
import { IpcMatch, AstxWorkerPool } from 'astx/node'
import { TypedEmitter } from 'tiny-typed-emitter'
import * as vscode from 'vscode'
import { debounce, isEqual } from 'lodash'
import { convertGlobPattern, joinPatterns } from './convertGlobPattern'

export type AddMatchesEvent = {
  file: vscode.Uri
  source: string
  matches: readonly IpcMatch[]
  error?: Error
}

export type ProgressEvent = {
  completed: number
  total: number
}

export interface AstxRunnerEvents {
  addMatches: (options: AddMatchesEvent) => void
  stop: () => void
  start: () => void
  progress: (options: ProgressEvent) => void
  done: () => void
  error: (error: Error) => void
}

type Params = {
  find?: string
  replace?: string
  include?: string
  exclude?: string
}

export class AstxRunner extends TypedEmitter<AstxRunnerEvents> {
  private _params: Params = {}
  private abortController: AbortController | undefined
  private pool: AstxWorkerPool

  constructor() {
    super()
    this.pool = new AstxWorkerPool()
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
    this.emit('stop')
  }

  runSoon: () => void = debounce(() => this.run(), 250)

  run(): void {
    this.stop()

    const abortController = new AbortController()
    this.abortController = abortController
    const { signal } = abortController

    this.emit('start')

    const { find } = this._params
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
      : joinPatterns(workspaceFolders)

    const transform: Transform = { find }

    ;(async () => {
      try {
        for await (const next of this.pool.runTransform({
          paths: [include],
          exclude,
          transform,
        })) {
          if (signal?.aborted) return
          if (next.type === 'progress') {
            const { completed, total } = next
            this.emit('progress', { completed, total })
            continue
          }
          const {
            result: { file, source = '', matches, error },
          } = next
          if (!matches?.length && !error) continue
          const event: AddMatchesEvent = {
            file: vscode.Uri.file(file),
            source,
            matches: matches || [],
            error,
          }
          this.emit('addMatches', event)
        }
        if (signal?.aborted) return
        this.emit('done')
      } catch (error) {
        if (signal?.aborted) return
        if (error instanceof Error) {
          // eslint-disable-next-line no-console
          console.error(error.stack)
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
}
