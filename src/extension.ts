// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { AstxRunner } from './AstxRunner'
import { ASTX_RESULT_SCHEME } from './constants'
import { MatchesViewProvider } from './MatchesView/MatchesViewProvider'
import { SearchReplaceViewProvider } from './SearchReplaceView/SearchReplaceViewProvider'
import TransformResultProvider from './TransformResultProvider'
import type * as AstxNodeTypes from 'astx/node'
import fs from 'fs-extra'
import path from 'path'

let extension: AstxExtension

export class AstxExtension {
  isProduction: boolean

  channel: vscode.OutputChannel = vscode.window.createOutputChannel('astx')
  runner: AstxRunner
  transformResultProvider: TransformResultProvider

  constructor(public context: vscode.ExtensionContext) {
    this.isProduction =
      context.extensionMode === vscode.ExtensionMode.Production
    this.runner = new AstxRunner(this)
    this.transformResultProvider = new TransformResultProvider(this)
  }

  async importAstxNode(): Promise<AstxNodeTypes> {
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
            : pkg.exports['./node'].import ??
              pkg.exports['./node'].require ??
              pkg.exports['./node'].default
      } else if (pkg.exports['./*']) {
        subpath = (
          typeof pkg.exports['./*'] === 'string'
            ? pkg.exports['./*']
            : pkg.exports['./*'].import ??
              pkg.exports['./*'].require ??
              pkg.exports['./*'].default
        )?.replace('*', 'node')
      }
      if (!subpath) {
        throw new Error(
          `failed to find export map entry for ./node or a matching pattern`
        )
      }
      this.channel.appendLine(
        `resolved to ${path.join(config.astxPath, subpath)}`
      )
      return await import(
        /* webpackIgnore: true */ path.join(config.astxPath, subpath)
      )
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

  activate(context: vscode.ExtensionContext): void {
    this.runner.startup().catch(this.logError)

    context.subscriptions.push(this.channel)

    context.subscriptions.push(
      vscode.commands.registerCommand('astx.restart-worker-pool', () =>
        this.runner.restart()
      )
    )

    context.subscriptions.push(
      vscode.commands.registerCommand('astx.showOutput', () => {
        this.channel.show()
      })
    )

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        ASTX_RESULT_SCHEME,
        this.transformResultProvider
      )
    )

    context.subscriptions.push(
      vscode.window.registerFileDecorationProvider(this.transformResultProvider)
    )

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        SearchReplaceViewProvider.viewType,
        new SearchReplaceViewProvider(this),
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        }
      )
    )
    const rootPath =
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : ''
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider(
        MatchesViewProvider.viewType,
        new MatchesViewProvider(rootPath, this)
      )
    )
  }

  async deactivate(): Promise<void> {
    await this.runner.shutdown()
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
