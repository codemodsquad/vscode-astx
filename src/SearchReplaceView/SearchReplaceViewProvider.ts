import * as vscode from 'vscode'
import {
  AstxRunner,
  AstxRunnerEvents,
  ProgressEvent,
  TransformResultEvent,
} from '../AstxRunner'
import { isProduction } from '../extension'
import {
  MessageFromWebview,
  SearchReplaceViewStatus,
} from './SearchReplaceViewTypes'
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

    const status: SearchReplaceViewStatus = {
      running: false,
      completed: 0,
      total: 0,
      numMatches: 0,
      numFilesThatWillChange: 0,
      numFilesWithMatches: 0,
      numFilesWithErrors: 0,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webviewView.webview.onDidReceiveMessage((_message: any) => {
      const message: MessageFromWebview = _message
      switch (message.type) {
        case 'mount': {
          webviewView.webview.postMessage({
            type: 'values',
            values: this.runner.params,
          })
          webviewView.webview.postMessage({
            type: 'status',
            status,
          })

          break
        }
        case 'values': {
          const { find, replace, include, exclude } = message.values
          this.runner.params = {
            find,
            replace,
            include,
            exclude,
          }
          break
        }
        case 'replace': {
          this.runner.replace()
          break
        }
      }
    })

    const listeners = {
      progress: ({ completed, total }: ProgressEvent) => {
        status.completed = completed
        status.total = total
        webviewView.webview.postMessage({
          type: 'status',
          status,
        })
      },
      result: (e: TransformResultEvent) => {
        if (e.transformed && e.transformed !== e.source) {
          status.numFilesThatWillChange++
        }
        if (e.matches.length) {
          status.numMatches += e.matches.length
          status.numFilesWithMatches++
        }
        if (e.error) {
          status.numFilesWithErrors++
        }
        webviewView.webview.postMessage({
          type: 'status',
          status,
        })
      },
      start: () => {
        status.running = true
        webviewView.webview.postMessage({
          type: 'status',
          status,
        })
      },
      stop: () => {
        status.running = false
        status.numMatches = 0
        status.numFilesThatWillChange = 0
        status.numFilesWithMatches = 0
        status.numFilesWithErrors = 0
        webviewView.webview.postMessage({
          type: 'status',
          status,
        })
      },
      done: () => {
        status.running = false
        webviewView.webview.postMessage({
          type: 'status',
          status,
        })
      },
    }

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
      vscode.Uri.joinPath(this._extensionUri, 'out', 'SearchReplaceView.js')
    )
    const webpackOrigin = '0.0.0.0:8378' // Use a nonce to only allow a specific script to be run.

    const nonce = getNonce()

    const csp = [
      `default-src 'none'`,
      `img-src ${`vscode-file://vscode-app`} ${webview.cspSource} 'self'`,
      `font-src ${webview.cspSource} 'self'`,
      ...(isProduction
        ? [
            `script-src 'nonce-${nonce}'`,
            `style-src ${webview.cspSource} 'self' 'unsafe-inline'`,
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
