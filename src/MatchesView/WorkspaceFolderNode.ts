import { TreeItem, TreeItemCollapsibleState } from 'vscode'
import { TreeNode } from './TreeNode'
import FileNode, { FileNodeProps } from './FileNode'
import lodash from 'lodash'
const { once } = lodash
type WorkspaceFolderNodeProps = {
  name: string
  files: FileNodeProps[]
}

function compareFiles(a: FileNodeProps, b: FileNodeProps): number {
  return a.file < b.file ? -1 : a.file > b.file ? 1 : 0
}

export default class WorkspaceFolderNode extends TreeNode<WorkspaceFolderNodeProps> {
  getTreeItem(): TreeItem {
    return new TreeItem(this.props.name, TreeItemCollapsibleState.Expanded)
  }
  getChildren: () => FileNode[] = once((): FileNode[] => {
    const { files } = this.props
    const result: FileNode[] = files
      .sort(compareFiles)
      .map((props) => new FileNode(props))
    return result
  })
}
