import { TreeItem } from 'vscode'

export abstract class TreeNode<P = any> {
  getChildren(): TreeNode[] | Promise<TreeNode[]> {
    return []
  }

  constructor(public readonly props: P, public readonly parent?: TreeNode) {}

  abstract getTreeItem(): TreeItem | Promise<TreeItem>

  resolveTreeItem?(item: TreeItem): TreeItem | Promise<TreeItem>
}
