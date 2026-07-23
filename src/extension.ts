import * as vscode from 'vscode';
import { loadMetadata } from './metadata';
import {
  CsproCompletionProvider,
  CsproHoverProvider,
  CsproSymbolProvider
} from './providers';
import { CsproDiagnostics } from './diagnostics';
import { CsproProjectProvider } from './projectExplorer';
import { refreshDictionaries } from './dictionaryStore';
import {
  createProcedure,
  generateSqlFromDictionary,
  revealSymbol
} from './commands';

const CSPRO: vscode.DocumentSelector = { language: 'cspro' };

export function activate(context: vscode.ExtensionContext): void {
  loadMetadata(context);

  // --- Language feature providers ---
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      CSPRO,
      new CsproCompletionProvider(),
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split('')
    ),
    vscode.languages.registerHoverProvider(CSPRO, new CsproHoverProvider()),
    vscode.languages.registerDocumentSymbolProvider(
      CSPRO,
      new CsproSymbolProvider()
    )
  );

  // --- Diagnostics ---
  const diagnostics = new CsproDiagnostics();
  context.subscriptions.push(diagnostics);

  const validateOpen = () => {
    for (const doc of vscode.workspace.textDocuments) {
      diagnostics.validate(doc);
    }
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => diagnostics.validate(doc)),
    vscode.workspace.onDidChangeTextDocument((e) =>
      diagnostics.validate(e.document)
    ),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnostics.clear(doc)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cspro.diagnostics')) {
        validateOpen();
      }
    })
  );

  // --- Project explorer ---
  const treeProvider = new CsproProjectProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('csproProjectExplorer', treeProvider)
  );

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand('cspro.createProcedure', createProcedure),
    vscode.commands.registerCommand(
      'cspro.generateSqlFromDictionary',
      generateSqlFromDictionary
    ),
    vscode.commands.registerCommand('cspro.revealSymbol', revealSymbol),
    vscode.commands.registerCommand('cspro.refreshExplorer', async () => {
      await refreshDictionaries();
      treeProvider.refresh();
    })
  );

  // --- Watch dictionary files ---
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.dcf');
  const rescan = async () => {
    await refreshDictionaries();
    validateOpen();
  };
  watcher.onDidCreate(rescan);
  watcher.onDidChange(rescan);
  watcher.onDidDelete(rescan);
  context.subscriptions.push(watcher);

  // Initial scan.
  void refreshDictionaries().then(validateOpen);

  console.log('CSPro Language Support activated.');
}

export function deactivate(): void {
  // Nothing to clean up beyond disposables registered above.
}
