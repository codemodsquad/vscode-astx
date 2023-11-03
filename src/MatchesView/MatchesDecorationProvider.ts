import * as vscode from 'vscode'
import { AstxExtension } from '../extension'
import { TransformResultEvent } from '../AstxRunner'
import { ASTX_RESULT_SCHEME } from '../constants'

export default class MatchesDecorationProvider
  implements vscode.FileDecorationProvider
{
  private filesWithErrors: Set<string> = new Set()

  constructor(private extension: AstxExtension) {
    const { runner } = extension
    runner.on('stop', () => {
      const files = [...this.filesWithErrors].map((s) => vscode.Uri.parse(s))
      this.filesWithErrors.clear()
      this._onDidChangeFileDecorations.fire(files)
    })
    runner.on('result', (event: TransformResultEvent) => {
      const file = event.file.with({ scheme: ASTX_RESULT_SCHEME })
      if (event.error) {
        this.filesWithErrors.add(file.toString())
      } else {
        this.filesWithErrors.delete(file.toString())
      }
      this._onDidChangeFileDecorations.fire(file)
    })
  }

  private _onDidChangeFileDecorations: vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  > = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>()

  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event

  provideFileDecoration(
    uri: vscode.Uri
  ): vscode.ProviderResult<vscode.FileDecoration> {
    return this.filesWithErrors.has(uri.toString())
      ? { color: new vscode.ThemeColor('charts.red') }
      : {}
  }
}
