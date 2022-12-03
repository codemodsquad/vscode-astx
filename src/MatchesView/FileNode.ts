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
  getTreeItem(): TreeItem {
    const { file, matches, error } = this.props
    const result = new TreeItem(
      path.basename(file.path),
      matches.length
        ? TreeItemCollapsibleState.Expanded
        : TreeItemCollapsibleState.Collapsed
    )
    const dirname = path.dirname(vscode.workspace.asRelativePath(file))
    if (dirname !== '.') result.description = dirname
    if (error) result.tooltip = error.stack || error.message
    return result
  }
  getChildren: () => TreeNode[] = once((): TreeNode[] => {
    const { error, matches } = this.props
    if (error) {
      const message = (error.stack || error.message).split(/\r\n?|\n/gm)
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
