import { CodeFrameError } from 'astx'
import * as vscode from 'vscode'
import { TransformResultEvent } from './AstxRunner'
import { ASTX_REPORTS_SCHEME, ASTX_RESULT_SCHEME } from './constants'
import { AstxExtension } from './extension'

export default class TransformResultProvider
  implements vscode.TextDocumentContentProvider, vscode.FileDecorationProvider
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentListeners: Set<(uri: vscode.Uri) => any> = new Set()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decorationListeners: Set<(changed: vscode.Uri | vscode.Uri[]) => any> =
    new Set()
  results: Map<string, TransformResultEvent> = new Map()

  constructor(private extension: AstxExtension) {
    const { runner } = extension
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
      const uri = file.with({ scheme: 'file' })
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
    const result = this.results.get(uri.with({ scheme: 'file' }).toString())
    switch (uri.scheme) {
      case ASTX_RESULT_SCHEME: {
        const transformed = result?.transformed
        if (transformed) return transformed
        const error = result?.error

        if (error) {
          if (error instanceof CodeFrameError) {
            return error.format({
              highlightCode: true,
              stack: true,
            })
          }
          return error.stack || error.message || String(error)
        }
        break
      }
      case ASTX_REPORTS_SCHEME: {
        return (result?.reports || [])
          ?.map((report) => JSON.stringify(report, null, 2))
          .join('\n')
      }
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
