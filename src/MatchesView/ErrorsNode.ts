import { TreeItem, TreeItemCollapsibleState } from 'vscode'
import { TreeNode } from './TreeNode'
import FileNode, { FileNodeProps } from './FileNode'
import { once } from 'lodash-es'

type ErrorsNodeProps = {
  errors: FileNodeProps[]
}

function compareFiles(a: FileNodeProps, b: FileNodeProps): number {
  return a.file < b.file ? -1 : a.file > b.file ? 1 : 0
}

export default class ErrorsNode extends TreeNode<ErrorsNodeProps> {
  getTreeItem(): TreeItem {
    return new TreeItem('Errors', TreeItemCollapsibleState.Collapsed)
  }
  getChildren: () => FileNode[] = once((): FileNode[] => {
    return this.props.errors
      .sort(compareFiles)
      .map((props) => new FileNode(props))
  })
}
