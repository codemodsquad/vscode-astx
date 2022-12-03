import { CodeFrameError } from 'astx'
import { IpcMatch } from 'astx/node'
import { Uri, TreeItem, TreeItemCollapsibleState } from 'vscode'
import * as vscode from 'vscode'
import { TreeNode } from './TreeNode'
import MatchNode from './MatchNode'
import path from 'path'
import { once } from 'lodash-es'
import LeafTreeItemNode from './LeafTreeItemNode'

export type FileNodeProps = {
  file: Uri
  source: string
  transformed?: string
  matches: readonly IpcMatch[]
  error?: Error
}

export default class FileNode extends TreeNode<FileNodeProps> {
  get errorMessage(): string | null {
    const { error } = this.props
    if (!error) return null
    if (error instanceof CodeFrameError) {
      return error.format({
        highlightCode: true,
        stack: true,
      })
    }
    return error.stack || error.message || String(error)
  }
  getTreeItem(): TreeItem {
    const { file, matches } = this.props
    const result = new TreeItem(
      path.basename(file.path),
      matches.length
        ? TreeItemCollapsibleState.Expanded
        : TreeItemCollapsibleState.Collapsed
    )
    const dirname = path.dirname(vscode.workspace.asRelativePath(file))
    if (dirname !== '.') result.description = dirname
    const { errorMessage } = this
    if (errorMessage) result.tooltip = errorMessage
    return result
  }
  getChildren: () => TreeNode[] = once((): TreeNode[] => {
    const {
      errorMessage,
      props: { matches },
    } = this
    if (errorMessage) {
      const message = errorMessage.split(/\r\n?|\n/gm)
      return message.map(
        (line) => new LeafTreeItemNode({ item: new TreeItem(line) })
      )
    }
    return matches.map(
      (match) =>
        new MatchNode(
          {
            match,
          },
          this
        )
    )
  })
}
