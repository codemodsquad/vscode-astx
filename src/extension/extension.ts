// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { AstxViewProvider } from './AstxViewProvider'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  /* eslint-enable no-console */

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    'extension.helloWorld',
    () => {
      // The code you place here will be executed every time your command is executed

      // Display a message box to the user
      vscode.window.showInformationMessage('Hello World!')
    }
  )

  context.subscriptions.push(disposable)

  const provider = new AstxViewProvider(context.extensionUri)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AstxViewProvider.viewType,
      provider
    )
  )
}

// this method is called when your extension is deactivated
export function deactivate(): void {} // eslint-disable-line @typescript-eslint/no-empty-function
