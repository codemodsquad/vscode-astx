import { IpcMatch } from 'astx/node'
import { Uri, TreeItem, TreeItemCollapsibleState } from 'vscode'
import * as vscode from 'vscode'
import { TreeNode } from './TreeNode'
import MatchNode from './MatchNode'
import path from 'path'
import { once } from 'lodash-es'

export type FileNodeProps = {
  file: Uri
  source: string
  transformed?: string
  matches: readonly IpcMatch[]
  error?: Error
}

export default class FileNode extends TreeNode<FileNodeProps> {
  getTreeItem(): TreeItem {
    const result = new TreeItem(
      path.basename(this.props.file.path),
      TreeItemCollapsibleState.Expanded
    )
    const dirname = path.dirname(
      vscode.workspace.asRelativePath(this.props.file)
    )
    if (dirname !== '.') result.description = dirname
    return result
  }
  getChildren: () => MatchNode[] = once((): MatchNode[] =>
    this.props.matches.map(
      (match) =>
        new MatchNode(
          {
            match,
          },
          this
        )
    )
  )
}
