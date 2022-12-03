import { TreeItem, TreeItemCollapsibleState } from 'vscode'
import { TreeNode } from './TreeNode'
import FileNode, { FileNodeProps } from './FileNode'
import { once } from 'lodash-es'

type LeafTreeItemNodeProps = {
  item: TreeItem
}

export default class LeafTreeItemNode extends TreeNode<LeafTreeItemNodeProps> {
  getTreeItem(): TreeItem {
    return this.props.item
  }
}
