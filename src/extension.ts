// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import os from 'os'
import { AstxRunner } from './AstxRunner'
import { ASTX_REPORTS_SCHEME, ASTX_RESULT_SCHEME } from './constants'
import { MatchesViewProvider } from './MatchesView/MatchesViewProvider'
import { SearchReplaceViewProvider } from './SearchReplaceView/SearchReplaceViewProvider'
import TransformResultProvider from './TransformResultProvider'
import type * as AstxNodeTypes from 'astx/node'
import fs from 'fs-extra'
import path from 'path'
import { isEqual } from 'lodash'

let extension: AstxExtension

export type AstxParser =
  | 'babel'
  | 'babel/auto'
  | 'recast/babel'
  | 'recast/babel/auto'

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

const paramsInConfig: (keyof Params)[] = [
  'parser',
  'prettier',
  'babelGeneratorHack',
  'preferSimpleReplacement',
]

export class AstxExtension {
  isProduction: boolean

  channel: vscode.OutputChannel = vscode.window.createOutputChannel('astx')
  runner: AstxRunner
  transformResultProvider: TransformResultProvider
  searchReplaceViewProvider: SearchReplaceViewProvider
  matchesViewProvider: MatchesViewProvider | undefined
  fsWatcher: vscode.FileSystemWatcher | undefined

  private params: Params
  private externalWatchPattern: vscode.GlobPattern | undefined
  private externalFsWatcher: vscode.FileSystemWatcher | undefined

  constructor(public context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('astx')
    this.params = Object.fromEntries(paramsInConfig.map((p) => [p, config[p]]))
    this.isProduction =
      context.extensionMode === vscode.ExtensionMode.Production
    this.runner = new AstxRunner(this)
    this.transformResultProvider = new TransformResultProvider(this)
    this.searchReplaceViewProvider = new SearchReplaceViewProvider(this)
  }

  async importAstxNode(): Promise<typeof AstxNodeTypes> {
    const config = vscode.workspace.getConfiguration('astx')
    if (!config.astxPath) return await import('astx/node')

    this.channel.appendLine(`importing astx/node from ${config.astxPath}...`)
    const result = await (async () => {
      const pkg = await fs.readJson(path.join(config.astxPath, 'package.json'))
      let subpath
      if (pkg.exports['./node']) {
        subpath =
          typeof pkg.exports['./node'] === 'string'
            ? pkg.exports['./node']
            : pkg.exports['./node'].require ?? pkg.exports['./node'].default
      } else if (pkg.exports['./*']) {
        subpath = (
          typeof pkg.exports['./*'] === 'string'
            ? pkg.exports['./*']
            : pkg.exports['./*'].require ?? pkg.exports['./*'].default
        )?.replace('*', 'node')
      }
      if (!subpath) {
        throw new Error(
          `failed to find export map entry for ./node or a matching pattern`
        )
      }
      const resolvedPath = path.join(config.astxPath, subpath)
      this.channel.appendLine(`resolved to ${resolvedPath}`)
      return require(/* webpackIgnore: true */ resolvedPath)
    })()

    this.channel.appendLine(
      `successfully imported astx/node from ${config.astxPath}`
    )
    return result
  }

  logError = (error: Error): void => {
    const message = `ERROR: ${error.stack || error.message || String(error)}`
    this.channel.appendLine(message)
    const config = vscode.workspace.getConfiguration('astx')
    if (config.showErrorNotifications) {
      vscode.window.showErrorMessage(message)
    }
  }

  resolveFsPath(fsPath: string): vscode.Uri {
    fsPath = fsPath.trim().replace(/^~/, os.homedir())
    if (!path.isAbsolute(fsPath)) {
      const { workspaceFolders = [] } = vscode.workspace
      let folder =
        workspaceFolders.length === 1 ? workspaceFolders[0] : undefined
      if (workspaceFolders.length > 1) {
        const topDir = fsPath.split(path.sep)[0]
        folder = workspaceFolders.find((f) => f.name === topDir)
      }
      if (folder) fsPath = path.resolve(folder.uri.fsPath, fsPath)
    }
    return vscode.Uri.parse(fsPath)
  }

  getParams(): Params {
    return { ...this.params }
  }

  setParams(params: Params): void {
    if (!isEqual(this.params, params)) {
      if (params.transformFile !== this.params.transformFile) {
        if (params.transformFile) {
          const resolved = this.resolveFsPath(params.transformFile)
          if (vscode.workspace.getWorkspaceFolder(resolved)) {
            this.setExternalWatchPattern(undefined)
          } else {
            this.setExternalWatchPattern(
              new vscode.RelativePattern(
                vscode.Uri.file(path.dirname(resolved.fsPath)),
                path.basename(resolved.fsPath)
              )
            )
          }
        } else {
          this.setExternalWatchPattern(undefined)
        }
      }
      const config = vscode.workspace.getConfiguration('astx')
      for (const key of paramsInConfig) {
        if (params[key] !== this.params[key]) {
          config.update(key, params[key], vscode.ConfigurationTarget.Workspace)
        }
      }
      this.params = { ...params }
      this.runner.setParams({ ...this.params })
      this.searchReplaceViewProvider.setParams({ ...this.params })
    }
  }

  activate(context: vscode.ExtensionContext): void {
    this.runner.startup().catch(this.logError)

    context.subscriptions.push(this.channel)

    context.subscriptions.push(
      vscode.commands.registerCommand('astx.restartWorkerPool', () =>
        this.runner.restart()
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand('astx.showOutput', () => {
        this.channel.show()
      })
    )
    context.subscriptions.push(
      vscode.commands.registerCommand('astx.search', () => {
        vscode.commands.executeCommand(
          `${SearchReplaceViewProvider.viewType}.focus`
        )
      })
    )

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(
        (e: vscode.ConfigurationChangeEvent) => {
          if (!e.affectsConfiguration('astx')) return
          const config = vscode.workspace.getConfiguration('astx')
          if (paramsInConfig.some((p) => this.params[p] !== config[p])) {
            this.setParams({
              ...this.params,
              ...Object.fromEntries(paramsInConfig.map((p) => [p, config[p]])),
            })
          }
        }
      )
    )

    this.fsWatcher = vscode.workspace.createFileSystemWatcher(
      '**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'
    )
    this.fsWatcher.onDidChange(this.handleFsChange)
    this.fsWatcher.onDidCreate(this.handleFsChange)
    this.fsWatcher.onDidDelete(this.handleFsChange)
    context.subscriptions.push(this.fsWatcher)

    vscode.workspace.onDidChangeTextDocument(
      this.handleTextDocumentChange,
      this,
      context.subscriptions
    )

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'astx.setAsTransformFile',
        (
          transformFile: vscode.Uri | undefined = vscode.window.activeTextEditor
            ?.document.uri
        ) => {
          if (!transformFile) return
          const newParams = {
            ...this.getParams(),
            useTransformFile: true,
            transformFile: normalizeFsPath(transformFile),
          }
          this.setParams(newParams)
          vscode.commands.executeCommand(
            `${SearchReplaceViewProvider.viewType}.focus`
          )
        }
      )
    )

    const setIncludePaths =
      ({ useTransformFile }: { useTransformFile: boolean }) =>
      (dir: vscode.Uri, arg2: vscode.Uri[]) => {
        const dirs =
          Array.isArray(arg2) &&
          arg2.every((item) => item instanceof vscode.Uri)
            ? arg2
            : [dir || vscode.window.activeTextEditor?.document.uri].filter(
                (x): x is vscode.Uri => x instanceof vscode.Uri
              )
        if (!dirs.length) return
        const newParams: Params = {
          ...this.getParams(),
          useTransformFile,
          include: dirs.map(normalizeFsPath).join(', '),
        }
        this.setParams(newParams)
        vscode.commands.executeCommand(
          `${SearchReplaceViewProvider.viewType}.focus`
        )
      }
    const findInPath = setIncludePaths({ useTransformFile: false })
    const transformInPath = setIncludePaths({ useTransformFile: true })

    context.subscriptions.push(
      vscode.commands.registerCommand('astx.findInFile', findInPath)
    )
    context.subscriptions.push(
      vscode.commands.registerCommand('astx.transformInFile', transformInPath)
    )
    context.subscriptions.push(
      vscode.commands.registerCommand('astx.findInFolder', findInPath)
    )
    context.subscriptions.push(
      vscode.commands.registerCommand('astx.transformInFolder', transformInPath)
    )

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        ASTX_RESULT_SCHEME,
        this.transformResultProvider
      ),
      vscode.workspace.registerTextDocumentContentProvider(
        ASTX_REPORTS_SCHEME,
        this.transformResultProvider
      )
    )

    context.subscriptions.push(
      vscode.window.registerFileDecorationProvider(this.transformResultProvider)
    )

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        SearchReplaceViewProvider.viewType,
        this.searchReplaceViewProvider,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        }
      )
    )
    this.matchesViewProvider = new MatchesViewProvider(this)
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(
        MatchesViewProvider.viewType,
        this.matchesViewProvider
      )
    )

    context.subscriptions.push({
      dispose: () => {
        this.setExternalWatchPattern(undefined)
      },
    })
  }

  async deactivate(): Promise<void> {
    await this.runner.shutdown()
  }

  private setExternalWatchPattern(
    externalWatchPattern: vscode.GlobPattern | undefined
  ) {
    function formatWatchPattern(pattern: vscode.GlobPattern): string {
      return typeof pattern === 'string'
        ? pattern
        : path.join(pattern.baseUri.fsPath, pattern.pattern)
    }
    if (isEqual(this.externalWatchPattern, externalWatchPattern)) return
    if (this.externalWatchPattern)
      this.channel.appendLine(
        `unwatching ${formatWatchPattern(this.externalWatchPattern)}`
      )
    this.externalWatchPattern = externalWatchPattern
    this.externalFsWatcher?.dispose()
    if (!externalWatchPattern) {
      this.externalFsWatcher = undefined
      return
    }
    this.externalFsWatcher =
      vscode.workspace.createFileSystemWatcher(externalWatchPattern)
    this.externalFsWatcher.onDidChange(this.handleFsChange)
    this.externalFsWatcher.onDidCreate(this.handleFsChange)
    this.externalFsWatcher.onDidDelete(this.handleFsChange)
    this.channel.appendLine(
      `watching ${formatWatchPattern(externalWatchPattern)}`
    )
  }

  handleFsChange = (uri: vscode.Uri): void => {
    const { transformFile } = this.getParams()
    if (
      transformFile &&
      uri.toString() === this.resolveFsPath(transformFile).toString()
    ) {
      this.runner.restartSoon()
    } else if (this.searchReplaceViewProvider.visible) {
      this.runner.runSoon()
    }
  }

  handleTextDocumentChange = (e: vscode.TextDocumentChangeEvent): void => {
    if (
      this.searchReplaceViewProvider.visible &&
      e.document.uri.scheme === 'file'
    ) {
      this.runner.runSoon()
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  extension = new AstxExtension(context)
  extension.activate(context)
}

export async function deactivate(): Promise<void> {
  // eslint-disable-next-line no-console
  await extension?.deactivate().catch((error) => console.error(error))
}

function normalizeFsPath(uri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(uri)
  return folder
    ? `${
        (vscode.workspace.workspaceFolders?.length ?? 0) > 1
          ? path.basename(folder.uri.path) + '/'
          : ''
      }${path.relative(folder.uri.path, uri.path)}`
    : uri.fsPath
}
