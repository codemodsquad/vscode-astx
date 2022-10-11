import * as vscode from 'vscode'
import { AstxRunner, AstxRunnerEvents, ProgressEvent } from './AstxRunner'
import { isProduction } from './extension'
import { MessageFromWebview } from '../shared/SearchReplaceViewTypes'
export class SearchReplaceViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'astx.SearchReplaceView'

  private _view?: vscode.WebviewView

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly runner: AstxRunner
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webviewView.webview.onDidReceiveMessage((_message: any) => {
      const message: MessageFromWebview = _message
      switch (message.type) {
        case 'values': {
          const { find, replace, include, exclude } = message.values
          this.runner.params = { find, replace, include, exclude }
          break
        }
      }
    })

    // const events: (keyof AstxRunnerEvents)[] = [
    //   'progress',
    //   'start',
    //   'stop',
    //   'done',
    // ]
    const listeners = {
      progress: ({ completed, total }: ProgressEvent) =>
        webviewView.webview.postMessage({
          type: 'status',
          status: { completed, total },
        }),
      start: () => {
        webviewView.webview.postMessage({
          type: 'status',
          status: { running: true },
        })
      },
      stop: () => {
        webviewView.webview.postMessage({
          type: 'status',
          status: { running: false },
        })
      },
      done: () => {
        webviewView.webview.postMessage({
          type: 'status',
          status: { running: false },
        })
      },
    }
    // const listeners = Object.fromEntries(
    // events.map((type) => [
    //   type,
    //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //   (event: any) => webviewView.webview.postMessage({ type, ...event }),
    // ])
    // )

    for (const [event, listener] of Object.entries(listeners)) {
      this.runner.on(event as keyof AstxRunnerEvents, listener)
    }

    webviewView.onDidDispose(() => {
      for (const [event, listener] of Object.entries(listeners)) {
        this.runner.removeListener(event as keyof AstxRunnerEvents, listener)
      }
    })
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'out',
        'assets',
        'SearchReplaceView.js'
      )
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

    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'node_modules',
        '@vscode/codicons',
        'dist',
        'codicon.css'
      )
    )

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="${csp.join(';')}">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${codiconsUri}" rel="stylesheet" />
				
				<title>Cat Colors</title>
			</head>
			<body>
        ${
          isProduction
            ? `<script nonce="${nonce}" src="${scriptUri}"></script>`
            : `<script src="http://${webpackOrigin}/SearchReplaceView.js"></script>`
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
