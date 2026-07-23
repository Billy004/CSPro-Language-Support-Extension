import * as vscode from 'vscode';
import { isKnownFunction, allKeywords } from './metadata';
import { parseLogicSymbols } from './logicParser';
import { getDictionaryItemNames } from './dictionaryStore';

const CALL_RE = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

interface BlockFrame {
  keyword: string;
  line: number;
}

/**
 * Lightweight validator: checks for unbalanced block keywords
 * (if/endif, do/enddo, for/endfor) and calls to unknown functions.
 */
export class CsproDiagnostics {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('cspro');
  }

  dispose(): void {
    this.collection.dispose();
  }

  clear(document: vscode.TextDocument): void {
    this.collection.delete(document.uri);
  }

  validate(document: vscode.TextDocument): void {
    if (document.languageId !== 'cspro') {
      return;
    }
    const config = vscode.workspace.getConfiguration('cspro');
    if (!config.get<boolean>('diagnostics.enable', true)) {
      this.collection.delete(document.uri);
      return;
    }
    const checkUnknown = config.get<boolean>('diagnostics.unknownFunctions', true);

    const diagnostics: vscode.Diagnostic[] = [];
    const stack: BlockFrame[] = [];

    // Names that are legitimately callable but not built-in functions:
    // user PROCs, user functions, and dictionary items.
    const localNames = new Set<string>();
    for (const sym of parseLogicSymbols(document)) {
      localNames.add(sym.name.toLowerCase());
    }
    for (const item of getDictionaryItemNames()) {
      localNames.add(item.name.toLowerCase());
    }
    const keywordSet = new Set(allKeywords().map((k) => k.toLowerCase()));

    for (let i = 0; i < document.lineCount; i++) {
      const rawLine = document.lineAt(i).text;
      const line = this.stripComments(rawLine);
      const lower = line.toLowerCase();

      // --- Block balancing ---
      this.trackBlocks(lower, i, stack, diagnostics, document);

      // --- Unknown function calls ---
      if (checkUnknown) {
        CALL_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = CALL_RE.exec(line)) !== null) {
          const name = match[1];
          const nameLower = name.toLowerCase();
          if (
            keywordSet.has(nameLower) ||
            localNames.has(nameLower) ||
            isKnownFunction(name)
          ) {
            continue;
          }
          const startCol = match.index;
          const range = new vscode.Range(i, startCol, i, startCol + name.length);
          const diag = new vscode.Diagnostic(
            range,
            `Unknown CSPro function '${name}'.`,
            vscode.DiagnosticSeverity.Warning
          );
          diag.source = 'cspro';
          diag.code = 'unknown-function';
          diagnostics.push(diag);
        }
      }
    }

    // Any unclosed blocks left on the stack.
    for (const frame of stack) {
      const closer = this.expectedCloser(frame.keyword);
      const lineText = document.lineAt(frame.line).text;
      const range = new vscode.Range(
        frame.line,
        0,
        frame.line,
        lineText.length
      );
      const diag = new vscode.Diagnostic(
        range,
        `Missing ${closer} for '${frame.keyword}'.`,
        vscode.DiagnosticSeverity.Warning
      );
      diag.source = 'cspro';
      diag.code = 'missing-close';
      diagnostics.push(diag);
    }

    this.collection.set(document.uri, diagnostics);
  }

  private stripComments(line: string): string {
    return line.replace(/\/\/.*$/, '');
  }

  private expectedCloser(keyword: string): string {
    switch (keyword) {
      case 'if':
        return 'ENDIF';
      case 'do':
        return 'ENDDO';
      case 'for':
        return 'ENDFOR';
      default:
        return 'END';
    }
  }

  private trackBlocks(
    lower: string,
    lineNo: number,
    stack: BlockFrame[],
    diagnostics: vscode.Diagnostic[],
    document: vscode.TextDocument
  ): void {
    // Opening keywords. 'if' only opens a block when followed by 'then'
    // on the same line; a one-line `if x then y;` still needs endif in CSPro.
    if (/^\s*if\b/.test(lower) && /\bthen\b/.test(lower)) {
      stack.push({ keyword: 'if', line: lineNo });
    } else if (/^\s*do\b/.test(lower)) {
      stack.push({ keyword: 'do', line: lineNo });
    } else if (/^\s*for\b/.test(lower)) {
      stack.push({ keyword: 'for', line: lineNo });
    }

    // Closing keywords.
    const closeIf = /\bendif\b/.test(lower);
    const closeDo = /\benddo\b/.test(lower);
    const closeFor = /\bendfor\b/.test(lower);

    if (closeIf) {
      this.popExpecting(stack, 'if', lineNo, diagnostics, document, 'ENDIF');
    }
    if (closeDo) {
      this.popExpecting(stack, 'do', lineNo, diagnostics, document, 'ENDDO');
    }
    if (closeFor) {
      this.popExpecting(stack, 'for', lineNo, diagnostics, document, 'ENDFOR');
    }
  }

  private popExpecting(
    stack: BlockFrame[],
    keyword: string,
    lineNo: number,
    diagnostics: vscode.Diagnostic[],
    document: vscode.TextDocument,
    closer: string
  ): void {
    const top = stack[stack.length - 1];
    if (top && top.keyword === keyword) {
      stack.pop();
    } else {
      const lineText = document.lineAt(lineNo).text;
      const idx = lineText.toLowerCase().indexOf(closer.toLowerCase());
      const col = idx >= 0 ? idx : 0;
      const range = new vscode.Range(lineNo, col, lineNo, col + closer.length);
      const diag = new vscode.Diagnostic(
        range,
        `Unexpected ${closer} — no matching opening statement.`,
        vscode.DiagnosticSeverity.Warning
      );
      diag.source = 'cspro';
      diag.code = 'unmatched-close';
      diagnostics.push(diag);
    }
  }
}
