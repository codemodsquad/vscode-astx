import * as vscode from 'vscode'
import { FileNodeProps } from './FileNode'
import { TreeNode } from './TreeNode'
import { TransformResultEvent } from '../AstxRunner'
import WorkspaceFolderNode from './WorkspaceFolderNode'
import { throttle } from 'lodash-es'
import { AstxExtension } from '../extension'

export class MatchesViewProvider implements vscode.TreeDataProvider<TreeNode> {
  static viewType = 'astx.MatchesView'

  folders: Map<string, { files: FileNodeProps[] }> = new Map()

  private fireChange = throttle(() => this._onDidChangeTreeData.fire(), 250)

  constructor(private workspaceRoot: string, private extension: AstxExtension) {
    const { runner } = extension
    runner.on('stop', () => {
      this.folders.clear()
      this.fireChange()
    })
    runner.on('result', (event: TransformResultEvent) => {
      const workspaceFolder =
        vscode.workspace.getWorkspaceFolder(event.file)?.name || '<other>'
      let forFolder = this.folders.get(workspaceFolder)
      if (!forFolder) {
        this.folders.set(workspaceFolder, (forFolder = { files: [] }))
      }
      if (
        event.matches?.length ||
        event.reports?.length ||
        event.error ||
        event.transformed
      ) {
        forFolder.files.push(event)
      }
      this.fireChange()
    })
  }

  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeNode | undefined | null | void
  > = new vscode.EventEmitter<TreeNode | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<
    TreeNode | undefined | null | void
  > = this._onDidChangeTreeData.event

  getTreeItem(node: TreeNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return node.getTreeItem()
  }

  getChildren(element?: TreeNode): vscode.ProviderResult<TreeNode[]> {
    if (element) return element.getChildren()
    const nodes: WorkspaceFolderNode[] = []
    for (const [name, { files }] of this.folders.entries()) {
      nodes.push(
        new WorkspaceFolderNode({
          name,
          files,
        })
      )
    }
    return nodes.length === 1
      ? nodes[0].getChildren()
      : nodes.sort(({ props: { name: a } }, { props: { name: b } }) =>
          a < b ? -1 : a > b ? 1 : 0
        )
  }

  getParent(element: TreeNode): vscode.ProviderResult<TreeNode> {
    return element.parent
  }
}
