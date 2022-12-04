import { IpcMatch } from 'astx/node'
import { TreeItem } from 'vscode'
import { TreeNode } from './TreeNode'
import FileNode from './FileNode'
import * as vscode from 'vscode'
import path from 'path'
import { ASTX_RESULT_SCHEME } from '../constants'

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
    const { nodes } = this.props.match
    if (!nodes.length) {
      throw new Error(`missing matched nodes`)
    }
    const { start, startLine, startColumn } = nodes[0].location
    const { end, endLine, endColumn } = nodes[nodes.length - 1].location
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
              this.parent.props.file.with({ scheme: ASTX_RESULT_SCHEME }),
              path.basename(this.parent.props.file.path),
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
