import * as vscode from 'vscode'
import { isProduction } from './extension'

export class AstxViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'astx.astxView'

  private _view?: vscode.WebviewView

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'colorSelected': {
          vscode.window.activeTextEditor?.insertSnippet(
            new vscode.SnippetString(`#${data.value}`)
          )
          break
        }
      }
    })
  }

  public addColor(): void {
    if (this._view) {
      this._view.show?.(true) // `show` is not implemented in 1.49 but is for 1.50 insiders
      this._view.webview.postMessage({ type: 'addColor' })
    }
  }

  public clearColors(): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'clearColors' })
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'assets', 'webview.js')
    )

    const webpackOrigin = '0.0.0.0:8378'

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce()

    const csp = [
      `default-src 'none'`,
      `img-src ${`vscode-file://vscode-app`} ${webview.cspSource} 'self'`,
      `font-src ${webview.cspSource} 'self'`,
      ...(isProduction
        ? [
            `script-src 'nonce-${nonce}'`,
            `style-src ${webview.cspSource} 'self'`,
          ]
        : [
            `script-src 'unsafe-eval' http://${webpackOrigin}`,
            `style-src ${webview.cspSource} 'self' 'unsafe-inline'`,
            `connect-src http://${webpackOrigin} ws://${webpackOrigin}`,
          ]),
    ]

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="${csp.join(';')}">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				
				<title>Cat Colors</title>
			</head>
			<body>
        ${
          isProduction
            ? `<script nonce="${nonce}" src="${scriptUri}" type="module"></script>`
            : `<script src="http://${webpackOrigin}/webview.js"></script>`
        }
			</body>
			</html>`
  }
}

function getNonce(): string {
  let text = ''
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
