import * as vscode from 'vscode';
import * as path from 'path';
import { parseDictionaryFile, Dictionary, DictItem } from './dictionaryParser';

/** cspro.createProcedure — inserts a PROC template at the cursor. */
export async function createProcedure(): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Name of the new CSPro procedure',
    placeHolder: 'NEW_PROCEDURE',
    validateInput: (value) =>
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(value.trim())
        ? undefined
        : 'Use a valid identifier (letters, digits, underscore; not starting with a digit).'
  });
  if (!name) {
    return;
  }

  const template = `\nPROC ${name.trim().toUpperCase()}\n\n\t\n\nENDPROC\n`;

  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.languageId === 'cspro') {
    await editor.edit((edit) => {
      edit.insert(editor.selection.active, template);
    });
    vscode.window.showInformationMessage(`Inserted procedure ${name}.`);
  } else {
    const doc = await vscode.workspace.openTextDocument({
      language: 'cspro',
      content: template
    });
    await vscode.window.showTextDocument(doc);
  }
}

/** cspro.generateSqlFromDictionary — converts a .dcf to a CREATE TABLE script. */
export async function generateSqlFromDictionary(
  resource?: vscode.Uri
): Promise<void> {
  const dcfUri = resource ?? (await pickDictionaryFile());
  if (!dcfUri) {
    return;
  }

  const dict = parseDictionaryFile(dcfUri.fsPath);
  if (!dict || dict.records.length === 0) {
    vscode.window.showErrorMessage(
      'Could not parse a dictionary with records from the selected .dcf file.'
    );
    return;
  }

  const sql = dictionaryToSql(dict);
  const doc = await vscode.workspace.openTextDocument({
    language: 'sql',
    content: sql
  });
  await vscode.window.showTextDocument(doc);
}

async function pickDictionaryFile(): Promise<vscode.Uri | undefined> {
  const active = vscode.window.activeTextEditor?.document;
  if (active && active.fileName.toLowerCase().endsWith('.dcf')) {
    return active.uri;
  }
  const files = await vscode.workspace.findFiles('**/*.dcf', '**/node_modules/**', 200);
  if (files.length === 0) {
    vscode.window.showWarningMessage('No .dcf dictionary files found in the workspace.');
    return undefined;
  }
  const pick = await vscode.window.showQuickPick(
    files.map((f) => ({ label: path.basename(f.fsPath), description: f.fsPath, uri: f })),
    { placeHolder: 'Select a CSPro dictionary (.dcf) file' }
  );
  return pick?.uri;
}

function sqlType(item: DictItem): string {
  if (item.dataType === 'numeric') {
    return item.decimals > 0
      ? `decimal(${Math.max(item.length, item.decimals + 1)}, ${item.decimals})`
      : item.length > 9
        ? 'bigint'
        : 'integer';
  }
  return `varchar(${item.length || 20})`;
}

function toSqlName(name: string): string {
  return name
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

export function dictionaryToSql(dict: Dictionary): string {
  const lines: string[] = [];
  lines.push(`-- SQL schema generated from CSPro dictionary: ${dict.name}`);
  if (dict.label) {
    lines.push(`-- ${dict.label}`);
  }
  lines.push('');

  for (const record of dict.records) {
    const table = toSqlName(record.name);
    lines.push(`-- Record: ${record.name}${record.label ? ' (' + record.label + ')' : ''}`);
    lines.push(`CREATE TABLE ${table} (`);
    record.items.forEach((item, index) => {
      const isLast = index === record.items.length - 1;
      const def = `    ${toSqlName(item.name)} ${sqlType(item)}`;
      const comma = isLast ? '' : ',';
      // Comma must precede the comment so it is not commented out.
      lines.push(item.label ? `${def}${comma}  -- ${item.label}` : `${def}${comma}`);
    });
    lines.push(');');
    lines.push('');
  }

  return lines.join('\n');
}

/** cspro.revealSymbol — opens a file and jumps to a line. */
export async function revealSymbol(
  uri: vscode.Uri,
  line: number
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc);
  const pos = new vscode.Position(line, 0);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(
    new vscode.Range(pos, pos),
    vscode.TextEditorRevealType.InCenter
  );
}
