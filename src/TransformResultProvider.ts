import { CodeFrameError } from 'astx'
import * as vscode from 'vscode'
import { TransformResultEvent } from './AstxRunner'
import { ASTX_REPORTS_SCHEME, ASTX_RESULT_SCHEME } from './constants'
import { AstxExtension } from './extension'

export default class TransformResultProvider
  implements vscode.TextDocumentContentProvider, vscode.FileDecorationProvider
{
  results: Map<string, TransformResultEvent> = new Map()

  constructor(private extension: AstxExtension) {
    const { runner } = extension
    runner.on('stop', () => {
      const uris = [...this.results.keys()].flatMap((raw) => [
        vscode.Uri.parse(raw).with({ scheme: ASTX_RESULT_SCHEME }),
        vscode.Uri.parse(raw).with({ scheme: ASTX_REPORTS_SCHEME }),
      ])
      this.results.clear()
      this._onDidChangeFileDecorations.fire(uris)
      for (const uri of uris) this._onDidChange.fire(uri)
    })
    runner.on('result', (event: TransformResultEvent) => {
      const { file } = event
      const uri = file.with({ scheme: 'file' })
      this.results.set(uri.toString(), event)
      const uris = [
        event.file.with({ scheme: ASTX_RESULT_SCHEME }),
        event.file.with({ scheme: ASTX_REPORTS_SCHEME }),
      ]
      for (const uri of uris) this._onDidChange.fire(uri)
      this._onDidChangeFileDecorations.fire(uris)
    })
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

  private _onDidChange: vscode.EventEmitter<vscode.Uri> =
    new vscode.EventEmitter<vscode.Uri>()

  readonly onDidChange = this._onDidChange.event

  private _onDidChangeFileDecorations: vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  > = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>()

  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event

  provideFileDecoration(
    uri: vscode.Uri
  ): vscode.ProviderResult<vscode.FileDecoration> {
    const error = this.results.get(
      uri.with({ scheme: 'file' }).toString()
    )?.error
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
