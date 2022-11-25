import * as vscode from 'vscode'
import { AstxRunner, TransformResultEvent } from './AstxRunner'

export default class TransformResultProvider
  implements vscode.TextDocumentContentProvider
{
  transformResults: Map<string, string> = new Map()

  constructor(private runner: AstxRunner) {
    runner.on('stop', () => {
      this.transformResults.clear()
    })
    runner.on('result', (event: TransformResultEvent) => {
      if (event.transformed) {
        this.transformResults.set(event.file.fsPath, event.transformed)
      }
    })
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const result = this.transformResults.get(uri.fsPath)
    if (!result) throw new Error(`unknown file: ${uri.fsPath}`)
    return result
  }
}
