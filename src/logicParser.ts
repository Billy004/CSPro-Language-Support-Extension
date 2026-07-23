import * as vscode from 'vscode';

export interface LogicSymbol {
  name: string;
  kind: 'proc' | 'function' | 'variable';
  line: number;
  detail?: string;
}

const PROC_RE = /^\s*PROC\s+([A-Za-z_][A-Za-z0-9_]*)/i;
const FUNC_RE = /^\s*function\s+(?:numeric|alpha|string\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/i;
const VAR_RE = /^\s*(numeric|alpha|string|array)\s+([A-Za-z_][A-Za-z0-9_]*)/i;

/** Extracts PROC, function and variable declarations from CSPro logic text. */
export function parseLogicSymbols(document: vscode.TextDocument): LogicSymbol[] {
  const symbols: LogicSymbol[] = [];
  for (let i = 0; i < document.lineCount; i++) {
    const text = document.lineAt(i).text;

    // Skip line comments quickly.
    const stripped = text.replace(/\/\/.*$/, '');

    let m = PROC_RE.exec(stripped);
    if (m) {
      symbols.push({ name: m[1], kind: 'proc', line: i, detail: 'PROC' });
      continue;
    }

    m = FUNC_RE.exec(stripped);
    if (m) {
      symbols.push({ name: m[1], kind: 'function', line: i, detail: 'function' });
      continue;
    }

    m = VAR_RE.exec(stripped);
    if (m) {
      symbols.push({
        name: m[2],
        kind: 'variable',
        line: i,
        detail: m[1].toLowerCase()
      });
    }
  }
  return symbols;
}

export function toVsSymbolKind(kind: LogicSymbol['kind']): vscode.SymbolKind {
  switch (kind) {
    case 'proc':
      return vscode.SymbolKind.Method;
    case 'function':
      return vscode.SymbolKind.Function;
    case 'variable':
      return vscode.SymbolKind.Variable;
  }
}
