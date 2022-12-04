// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { AstxRunner } from './AstxRunner'
import { ASTX_RESULT_SCHEME } from './constants'
import { MatchesViewProvider } from './MatchesView/MatchesViewProvider'
import { SearchReplaceViewProvider } from './SearchReplaceView/SearchReplaceViewProvider'
import TransformResultProvider from './TransformResultProvider'

export let isProduction = false
let runner: AstxRunner // this method is called when your extension is activated
// your extension is activated the very first time the command is executed

export function activate(context: vscode.ExtensionContext): void {
  /* eslint-enable no-console */

  isProduction = context.extensionMode === vscode.ExtensionMode.Production
  // isProduction = true

  runner = new AstxRunner()

  const transformResultProvider = new TransformResultProvider(runner)

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      ASTX_RESULT_SCHEME,
      transformResultProvider
    )
  )

  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(transformResultProvider)
  )

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SearchReplaceViewProvider.viewType,
      new SearchReplaceViewProvider(context.extensionUri, runner),
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
      new MatchesViewProvider(rootPath, runner)
    )
  )
} // this method is called when your extension is deactivated

export function deactivate(): void {
  if (runner) runner.stop()
}
