import { TreeItem } from 'vscode'
import { TreeNode } from './TreeNode'
type LeafTreeItemNodeProps = {
  item: TreeItem
}

export default class LeafTreeItemNode extends TreeNode<LeafTreeItemNodeProps> {
  getTreeItem(): TreeItem {
    return this.props.item
  }
}
