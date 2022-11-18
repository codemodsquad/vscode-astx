import { IpcMatch } from 'astx/node'
import { TreeItem } from 'vscode'
import { TreeNode } from './TreeNode.js'
import FileNode from './FileNode.js'
import * as vscode from 'vscode'
import path from 'path'
import { ASTX_RESULT_SCHEME } from '../constants.js'

type MatchNodeProps = {
  match: IpcMatch
}

function indexOfMatch(s: string, rx: RegExp, fromIndex = 0): number {
  rx = new RegExp(rx)
  rx.lastIndex = fromIndex
  return rx.exec(s)?.index ?? -1
}

export default class MatchNode extends TreeNode<MatchNodeProps> {
  constructor(
    public readonly props: MatchNodeProps,
    public readonly parent: FileNode
  ) {
    super(props, parent)
  }
  getTreeItem(): TreeItem {
    const { source, transformed } = this.parent.props
    const { start, end, startLine, startColumn, endLine, endColumn } =
      this.props.match.node.location
    if (start == null || end == null || startColumn == null) {
      throw new Error(`missing complete location information`)
    }
    const from = indexOfMatch(source, /\S/g, start - startColumn)
    const to = indexOfMatch(source, /\r\n?|\n/gm, from)
    const item = new TreeItem({
      label: this.parent.props.source.substring(from, to),
      highlights: [[start - from, Math.min(end - from, to - from)]],
    })
    item.command = {
      title: 'show match',
      command: transformed ? 'vscode.diff' : 'vscode.open',
      arguments: [
        this.parent.props.file,
        ...(transformed
          ? [
              vscode.Uri.parse(
                `${ASTX_RESULT_SCHEME}://${this.parent.props.file.authority}${this.parent.props.file.path}`
              ),
              path.basename(this.parent.props.file.fsPath),
            ]
          : []),
        ...(startLine != null &&
        startColumn != null &&
        endLine != null &&
        endColumn != null
          ? [
              {
                selection: new vscode.Range(
                  startLine - 1,
                  startColumn,
                  endLine - 1,
                  endColumn
                ),
              },
            ]
          : []),
      ],
    }
    return item
  }
}
