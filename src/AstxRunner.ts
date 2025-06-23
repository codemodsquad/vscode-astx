import { AstxConfig, Transform } from 'astx'
import type { IpcMatch, AstxWorkerPool } from 'astx/node'
import type * as AstxNodeTypes from 'astx/node'
import { TypedEmitter } from 'tiny-typed-emitter'
import * as vscode from 'vscode'
import { debounce, isEqual } from 'lodash'
import { convertGlobPattern, joinPatterns } from './glob/convertGlobPattern'
import { AstxExtension, Params } from './extension'
import Path from 'path'
import fs from 'fs/promises'
import { Fs } from 'astx/node/runTransformOnFile'

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

export class AstxRunner extends TypedEmitter<AstxRunnerEvents> {
  private params: Params
  private pausedRestart = false
  private astxNode: typeof AstxNodeTypes = undefined as any
  private abortController: AbortController | undefined
  private pool: AstxWorkerPool = undefined as any
  private processedFiles: Set<string> = new Set()
  private transformResults: Map<
    string,
    {
      source: string
      transformed: string
    }
  > = new Map()
  private fs: Fs | undefined
  private config: AstxConfig | undefined
  private startupPromise: Promise<void> = Promise.reject(
    new Error('not started')
  )

  constructor(private extension: AstxExtension) {
    super()
    this.params = extension.getParams()
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

  setParams(params: Params): void {
    if (!isEqual(this.params, params)) {
      this.params = params
      if (!this.params.paused && this.pausedRestart) {
        this.pausedRestart = false
        this.restartSoon()
      } else {
        this.runSoon()
      }
    }
  }

  stop(): void {
    this.abortController?.abort()
    this.transformResults.clear()
    this.emit('stop')
  }
  restartSoon: () => void = () => {
    if (this.params.paused) {
      this.pausedRestart = true
    } else {
      this.debouncedRestart()
    }
  }
  debouncedRestart: () => void = debounce(
    () =>
      this.restart().then(
        () => this.run(),
        () => {
          /* ignore */
        }
      ),
    250
  )

  async restart(): Promise<void> {
    const oldPool = this.pool
    try {
      await this.startup()
      this.extension.channel.appendLine(
        'created new worker pool. ending old worker pool...'
      )
      await oldPool?.end()
      this.extension.channel.appendLine('successfully ended old worker pool')
    } catch (error) {
      this.extension.channel.appendLine(
        `failed to restart worker pool: ${
          error instanceof Error ? error.stack : String(error)
        }`
      )
    }
  }

  async shutdown(): Promise<void> {
    this.stop()
    await this.pool.end()
  }

  runSoon: () => void = () => {
    if (!this.params.paused) this.debouncedRun()
  }

  debouncedRun: () => void = debounce(() => this.run(), 250)

  async handleChange(fileUri: vscode.Uri): Promise<void> {
    const { pool, fs, config } = this
    const { find, replace } = this.params
    const file = fileUri.fsPath
    if (
      !this.abortController?.signal.aborted &&
      pool &&
      fs &&
      config &&
      this.processedFiles.has(file)
    ) {
      const { useTransformFile } = this.params
      let { transformFile } = this.params

      if (transformFile) {
        transformFile = this.extension.resolveFsPath(transformFile).fsPath
      }

      const transform: Transform = {
        find,
        replace,
      }

      try {
        const result = await pool.runTransformOnFile({
          ...(useTransformFile ? { transformFile } : { transform }),
          file,
          source: await fs.readFile(file, 'utf8'),
          config,
        })

        this.handleResult(result)
      } catch (error) {
        if (this.abortController?.signal.aborted) return
        if (error instanceof Error && pool === this.pool) {
          this.extension.logError(error)
          this.emit('error', error)
        }
      }
    }
  }

  handleResult(result: AstxNodeTypes.IpcTransformResult): void {
    const { file, source = '', transformed, matches, reports, error } = result
    this.processedFiles.add(result.file)

    if (this.abortController?.signal.aborted) {
      return
    }

    if (transformed != null && transformed !== source) {
      this.transformResults.set(file, {
        source,
        transformed,
      })
    } else {
      this.transformResults.delete(file)
    }
    const event: TransformResultEvent = {
      file: vscode.Uri.file(file),
      source,
      transformed,
      reports,
      matches: matches || [],
      error: error ? this.astxNode.invertIpcError(error) : undefined,
    }
    this.emit('result', event)
  }

  run(): void {
    this.stop()

    const pool = this.pool

    const abortController = new AbortController()
    this.abortController = abortController
    const { signal } = abortController

    this.emit('start')

    this.extension.channel.appendLine(
      `running... ${JSON.stringify(this.params)}`
    )

    const {
      find,
      replace,
      useTransformFile,
      parser,
      prettier,
      babelGeneratorHack,
      preferSimpleReplacement,
    } = this.params
    let { transformFile } = this.params
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

    const include = this.params.include
      ? convertGlobPattern(this.params.include, workspaceFolders)
      : joinPatterns(workspaceFolders)
    const exclude = this.params.exclude
      ? convertGlobPattern(this.params.exclude, workspaceFolders)
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
    this.fs = Fs
    const config = {
      parser,
      parserOptions:
        parser === 'babel' || parser === 'babel/auto'
          ? {
              preserveFormat: babelGeneratorHack ? 'generatorHack' : undefined,
            }
          : undefined,
      prettier,
      preferSimpleReplacement,
    }
    this.config = config
    ;(async () => {
      try {
        await this.startupPromise
        for await (const next of pool.runTransform({
          paths: [include],
          exclude,
          getResolveAgainstDir: (filename: string) => {
            return (
              workspaceFolders.find(
                (f) => !Path.relative(f, filename).startsWith('.')
              ) || process.cwd()
            )
          },
          ...(useTransformFile ? { transformFile } : { transform }),
          config,
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
          this.handleResult(next.result)
        }
        if (signal?.aborted) return
        this.emit('done')
      } catch (error) {
        if (signal?.aborted) return
        if (error instanceof Error && pool === this.pool) {
          this.extension.logError(error)
          this.emit('error', error)
        }
      } finally {
        if (pool === this.pool) {
          this.extension.channel.appendLine('run ended')
        }
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
      const encoder = new TextEncoder()
      if (source.trim() && transformed?.trim()) {
        edit.replace(
          vscode.Uri.file(file),
          new vscode.Range(new vscode.Position(0, 0), endPosition(source)),
          transformed
        )
      } else if (transformed?.trim()) {
        edit.createFile(vscode.Uri.file(file), {
          contents: encoder.encode(transformed),
        })
      } else {
        edit.deleteFile(vscode.Uri.file(file))
      }
    }
    await vscode.workspace.applyEdit(edit)
    this.transformResults.clear()
    this.processedFiles.clear()
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
