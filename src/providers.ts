import * as vscode from 'vscode';
import {
  getFunctions,
  getFunctionInfo,
  getKeywords,
  FunctionInfo
} from './metadata';
import { parseLogicSymbols, toVsSymbolKind } from './logicParser';
import { getDictionaryItemNames } from './dictionaryStore';

const WORD_RE = /[A-Za-z_][A-Za-z0-9_]*/;

/** Builds a rich markdown block for a function. */
function functionDoc(name: string, info: FunctionInfo): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendCodeblock(info.signature ?? `${name}(...)`, 'cspro');
  md.appendMarkdown(`\n${info.description}`);
  if (info.returns) {
    md.appendMarkdown(`\n\n**Returns:** ${info.returns}`);
  }
  return md;
}

export class CsproCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // Functions
    const functions = getFunctions();
    for (const [name, info] of Object.entries(functions)) {
      const item = new vscode.CompletionItem(
        name,
        vscode.CompletionItemKind.Function
      );
      item.detail = info.signature ?? `${name}()`;
      item.documentation = functionDoc(name, info);
      item.insertText = new vscode.SnippetString(`${name}($0)`);
      items.push(item);
    }

    // Keywords
    const kw = getKeywords();
    const pushKeywords = (list: string[], kind: vscode.CompletionItemKind) => {
      for (const k of list) {
        const item = new vscode.CompletionItem(k, kind);
        items.push(item);
      }
    };
    pushKeywords(kw.control, vscode.CompletionItemKind.Keyword);
    pushKeywords(kw.declaration, vscode.CompletionItemKind.Keyword);
    pushKeywords(kw.storage, vscode.CompletionItemKind.TypeParameter);
    pushKeywords(kw.constants, vscode.CompletionItemKind.Constant);
    pushKeywords(kw.operators, vscode.CompletionItemKind.Operator);

    // Symbols declared in the current document
    for (const sym of parseLogicSymbols(document)) {
      const kind =
        sym.kind === 'variable'
          ? vscode.CompletionItemKind.Variable
          : vscode.CompletionItemKind.Function;
      const item = new vscode.CompletionItem(sym.name, kind);
      item.detail = sym.detail;
      items.push(item);
    }

    // Dictionary items discovered in the workspace
    for (const dictItem of getDictionaryItemNames()) {
      const item = new vscode.CompletionItem(
        dictItem.name,
        vscode.CompletionItemKind.Field
      );
      item.detail = `${dictItem.dictionary} • ${dictItem.label || dictItem.dataType}`;
      item.documentation = new vscode.MarkdownString(
        `Dictionary item from **${dictItem.dictionary}**` +
          (dictItem.label ? `\n\n${dictItem.label}` : '')
      );
      items.push(item);
    }

    return items;
  }
}

export class CsproHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const range = document.getWordRangeAtPosition(position, WORD_RE);
    if (!range) {
      return undefined;
    }
    const word = document.getText(range);

    const info = getFunctionInfo(word);
    if (info) {
      return new vscode.Hover(functionDoc(word, info), range);
    }

    // Dictionary item hover
    const dictItem = getDictionaryItemNames().find(
      (d) => d.name.toLowerCase() === word.toLowerCase()
    );
    if (dictItem) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(
        `**${dictItem.name}** — ${dictItem.dataType} (${dictItem.dictionary})`
      );
      if (dictItem.label) {
        md.appendMarkdown(`\n\n${dictItem.label}`);
      }
      return new vscode.Hover(md, range);
    }

    return undefined;
  }
}

export class CsproSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument
  ): vscode.DocumentSymbol[] {
    return parseLogicSymbols(document).map((sym) => {
      const range = document.lineAt(sym.line).range;
      return new vscode.DocumentSymbol(
        sym.name,
        sym.detail ?? '',
        toVsSymbolKind(sym.kind),
        range,
        range
      );
    });
  }
}
