import * as vscode from 'vscode'
import { AstxRunner, TransformResultEvent } from './AstxRunner'
import { ASTX_RESULT_SCHEME } from './constants'

export default class TransformResultProvider
  implements vscode.TextDocumentContentProvider
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: Set<(uri: vscode.Uri) => any> = new Set()
  transformResults: Map<string, string> = new Map()

  constructor(private runner: AstxRunner) {
    runner.on('stop', () => {
      for (const rawUri of this.transformResults.keys()) {
        const uri = vscode.Uri.parse(rawUri)
        for (const listener of this.listeners) {
          listener(uri)
        }
      }
      this.transformResults.clear()
    })
    runner.on('result', (event: TransformResultEvent) => {
      const { file } = event
      const uri = vscode.Uri.parse(
        `${ASTX_RESULT_SCHEME}://${file.authority}${file.path}`
      )
      if (event.transformed) {
        this.transformResults.set(uri.toString(), event.transformed)
      }
      for (const listener of this.listeners) {
        listener(uri)
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDidChange(listener: (uri: vscode.Uri) => any): vscode.Disposable {
    this.listeners.add(listener)
    return new vscode.Disposable(() => this.listeners.delete(listener))
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.transformResults.get(uri.toString()) || ''
  }
}
