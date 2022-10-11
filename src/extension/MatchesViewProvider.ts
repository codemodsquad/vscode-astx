import * as vscode from 'vscode'
import { FileNodeProps } from './MatchesView/FileNode'
import { TreeNode } from './TreeNode'
import { TransformResultEvent, AstxRunner } from './AstxRunner'
import WorkspaceFolderNode from './MatchesView/WorkspaceFolderNode'
import { throttle } from 'lodash'

export class MatchesViewProvider implements vscode.TreeDataProvider<TreeNode> {
  static viewType = 'astx.MatchesView'

  matches: Map<string, FileNodeProps[]> = new Map()
  errors: Map<string, FileNodeProps[]> = new Map()

  private fireChange = throttle(() => this._onDidChangeTreeData.fire(), 250)

  constructor(private workspaceRoot: string, private runner: AstxRunner) {
    runner.on('stop', () => {
      this.matches.clear()
      this.errors.clear()
      this.fireChange()
    })
    runner.on('result', (event: TransformResultEvent) => {
      const workspaceFolder =
        vscode.workspace.getWorkspaceFolder(event.file)?.name || '<other>'
      if (event.matches?.length) {
        let forFolder = this.matches.get(workspaceFolder)
        if (!forFolder) {
          this.matches.set(workspaceFolder, (forFolder = []))
        }
        forFolder.push(event)
      } else if (event.error) {
        let forFolder = this.errors.get(workspaceFolder)
        if (!forFolder) {
          this.errors.set(workspaceFolder, (forFolder = []))
        }
        forFolder.push(event)
      }
      this.fireChange()
    })
    // eslint-disable-next-line no-console
    runner.on('error', (error: Error) => console.error(error.stack))
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
    for (const [name, files] of this.matches.entries()) {
      nodes.push(new WorkspaceFolderNode({ name, files }))
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
