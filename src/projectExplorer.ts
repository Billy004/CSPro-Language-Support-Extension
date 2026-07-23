import * as vscode from 'vscode';
import * as path from 'path';
import { getDictionaries, onDictionariesChanged } from './dictionaryStore';
import { parseLogicSymbols } from './logicParser';

type NodeType =
  | 'category'
  | 'file'
  | 'dictionary'
  | 'record'
  | 'item'
  | 'proc'
  | 'variable';

export class CsproTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: NodeType,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly resourceUri2?: vscode.Uri,
    public readonly gotoLine?: number
  ) {
    super(label, collapsibleState);
    this.contextValue = type;
    this.iconPath = iconForType(type);
    if (resourceUri2 && gotoLine !== undefined) {
      this.command = {
        command: 'cspro.revealSymbol',
        title: 'Reveal',
        arguments: [resourceUri2, gotoLine]
      };
    } else if (type === 'file' && resourceUri2) {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [resourceUri2]
      };
    }
  }
}

function iconForType(type: NodeType): vscode.ThemeIcon {
  switch (type) {
    case 'category':
      return new vscode.ThemeIcon('folder');
    case 'file':
      return new vscode.ThemeIcon('file-code');
    case 'dictionary':
      return new vscode.ThemeIcon('database');
    case 'record':
      return new vscode.ThemeIcon('list-tree');
    case 'item':
      return new vscode.ThemeIcon('symbol-field');
    case 'proc':
      return new vscode.ThemeIcon('symbol-method');
    case 'variable':
      return new vscode.ThemeIcon('symbol-variable');
  }
}

export class CsproProjectProvider
  implements vscode.TreeDataProvider<CsproTreeItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<CsproTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    onDictionariesChanged(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CsproTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CsproTreeItem): Promise<CsproTreeItem[]> {
    if (!element) {
      return [
        new CsproTreeItem(
          'Files',
          'category',
          vscode.TreeItemCollapsibleState.Expanded
        ),
        new CsproTreeItem(
          'Dictionaries',
          'category',
          vscode.TreeItemCollapsibleState.Expanded
        ),
        new CsproTreeItem(
          'Procedures',
          'category',
          vscode.TreeItemCollapsibleState.Collapsed
        ),
        new CsproTreeItem(
          'Variables',
          'category',
          vscode.TreeItemCollapsibleState.Collapsed
        )
      ];
    }

    if (element.type === 'category') {
      switch (element.label) {
        case 'Files':
          return this.getFiles();
        case 'Dictionaries':
          return this.getDictionaryNodes();
        case 'Procedures':
          return this.getSymbolNodes('proc');
        case 'Variables':
          return this.getSymbolNodes('variable');
      }
    }

    if (element.type === 'dictionary') {
      return this.getRecordsForDictionary(element.label);
    }

    if (element.type === 'record' && element.resourceUri2) {
      return this.getItemsForRecord(element.resourceUri2.fragment, element.label);
    }

    return [];
  }

  private async getFiles(): Promise<CsproTreeItem[]> {
    const files = await vscode.workspace.findFiles(
      '**/*.{ent,app,dcf,pff,fmf,pen,apc}',
      '**/node_modules/**',
      500
    );
    files.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return files.map(
      (uri) =>
        new CsproTreeItem(
          path.basename(uri.fsPath),
          'file',
          vscode.TreeItemCollapsibleState.None,
          uri
        )
    );
  }

  private getDictionaryNodes(): CsproTreeItem[] {
    return getDictionaries().map((dict) => {
      const item = new CsproTreeItem(
        dict.name || path.basename(dict.filePath),
        'dictionary',
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.description = dict.label;
      item.tooltip = dict.filePath;
      return item;
    });
  }

  private getRecordsForDictionary(dictName: string): CsproTreeItem[] {
    const dict = getDictionaries().find(
      (d) => (d.name || path.basename(d.filePath)) === dictName
    );
    if (!dict) {
      return [];
    }
    return dict.records.map((rec) => {
      // Encode the dictionary name in the fragment so children can find it.
      const uri = vscode.Uri.parse(`cspro-record:${rec.name}#${dictName}`);
      const item = new CsproTreeItem(
        rec.name,
        'record',
        vscode.TreeItemCollapsibleState.Collapsed,
        uri
      );
      item.description = rec.label;
      // Remove the auto-generated open command for synthetic URIs.
      item.command = undefined;
      return item;
    });
  }

  private getItemsForRecord(dictName: string, recordName: string): CsproTreeItem[] {
    const dict = getDictionaries().find(
      (d) => (d.name || path.basename(d.filePath)) === dictName
    );
    const record = dict?.records.find((r) => r.name === recordName);
    if (!record) {
      return [];
    }
    return record.items.map((it) => {
      const node = new CsproTreeItem(
        it.name,
        'item',
        vscode.TreeItemCollapsibleState.None
      );
      node.description = `${it.dataType}(${it.length})${
        it.label ? ' • ' + it.label : ''
      }`;
      return node;
    });
  }

  private async getSymbolNodes(
    kind: 'proc' | 'variable'
  ): Promise<CsproTreeItem[]> {
    const files = await vscode.workspace.findFiles(
      '**/*.{ent,app,apc}',
      '**/node_modules/**',
      200
    );
    const nodes: CsproTreeItem[] = [];
    for (const uri of files) {
      let doc: vscode.TextDocument;
      try {
        doc = await vscode.workspace.openTextDocument(uri);
      } catch {
        continue;
      }
      for (const sym of parseLogicSymbols(doc)) {
        const match =
          kind === 'proc'
            ? sym.kind === 'proc' || sym.kind === 'function'
            : sym.kind === 'variable';
        if (!match) {
          continue;
        }
        const node = new CsproTreeItem(
          sym.name,
          kind === 'proc' ? 'proc' : 'variable',
          vscode.TreeItemCollapsibleState.None,
          uri,
          sym.line
        );
        node.description = path.basename(uri.fsPath);
        nodes.push(node);
      }
    }
    nodes.sort((a, b) => a.label.localeCompare(b.label));
    return nodes;
  }
}
