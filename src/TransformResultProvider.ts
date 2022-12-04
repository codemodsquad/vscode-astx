import { CodeFrameError } from 'astx'
import * as vscode from 'vscode'
import { AstxRunner, TransformResultEvent } from './AstxRunner'
import { ASTX_RESULT_SCHEME } from './constants'

export default class TransformResultProvider
  implements vscode.TextDocumentContentProvider, vscode.FileDecorationProvider
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentListeners: Set<(uri: vscode.Uri) => any> = new Set()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decorationListeners: Set<(changed: vscode.Uri | vscode.Uri[]) => any> =
    new Set()
  results: Map<string, TransformResultEvent> = new Map()

  constructor(private runner: AstxRunner) {
    runner.on('stop', () => {
      const uris = [...this.results.keys()].map((raw) => vscode.Uri.parse(raw))
      for (const uri of uris) {
        for (const listener of this.contentListeners) {
          listener(uri)
        }
      }
      for (const listener of this.decorationListeners) {
        listener(uris)
      }
      this.results.clear()
    })
    runner.on('result', (event: TransformResultEvent) => {
      const { file } = event
      const uri = file.with({ scheme: ASTX_RESULT_SCHEME })
      this.results.set(uri.toString(), event)
      for (const listener of this.contentListeners) listener(uri)
      for (const listener of this.decorationListeners) listener(uri)
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDidChange(listener: (uri: vscode.Uri) => any): vscode.Disposable {
    this.contentListeners.add(listener)
    return new vscode.Disposable(() => this.contentListeners.delete(listener))
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const { transformed, error } = this.results.get(uri.toString()) || {}
    if (transformed) return transformed
    if (error) {
      if (error instanceof CodeFrameError) {
        return error.format({
          highlightCode: true,
          stack: true,
        })
      }
      return error.stack || error.message || String(error)
    }
    return ''
  }

  onDidChangeFileDecorations(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (uris: vscode.Uri | vscode.Uri[]) => any
  ): vscode.Disposable {
    this.decorationListeners.add(listener)
    return new vscode.Disposable(() =>
      this.decorationListeners.delete(listener)
    )
  }
  provideFileDecoration(
    uri: vscode.Uri
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const error = this.results.get(uri.toString())?.error
    if (error) {
      return new vscode.FileDecoration(
        '!',
        undefined,
        new vscode.ThemeColor('list.errorForeground')
      )
    }
    return new vscode.FileDecoration()
  }
}
