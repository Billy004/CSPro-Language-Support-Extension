import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface FunctionInfo {
  description: string;
  signature?: string;
  parameters?: string[];
  returns?: string;
}

export interface KeywordSets {
  control: string[];
  declaration: string[];
  storage: string[];
  constants: string[];
  operators: string[];
}

let functions: Record<string, FunctionInfo> = {};
let keywords: KeywordSets = {
  control: [],
  declaration: [],
  storage: [],
  constants: [],
  operators: []
};

/** Load the JSON metadata bundled with the extension. */
export function loadMetadata(context: vscode.ExtensionContext): void {
  functions = readJson(context, 'metadata', 'functions.json') ?? {};
  const kw = readJson<KeywordSets>(context, 'metadata', 'keywords.json');
  if (kw) {
    keywords = kw;
  }
}

function readJson<T = any>(
  context: vscode.ExtensionContext,
  ...segments: string[]
): T | undefined {
  try {
    const file = path.join(context.extensionPath, ...segments);
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch (err) {
    console.error(`CSPro: failed to read ${segments.join('/')}:`, err);
    return undefined;
  }
}

export function getFunctions(): Record<string, FunctionInfo> {
  return functions;
}

export function getFunctionInfo(name: string): FunctionInfo | undefined {
  return functions[name.toLowerCase()] ?? functions[name];
}

export function isKnownFunction(name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(functions).some((f) => f.toLowerCase() === lower);
}

export function getKeywords(): KeywordSets {
  return keywords;
}

export function allKeywords(): string[] {
  return [
    ...keywords.control,
    ...keywords.declaration,
    ...keywords.storage,
    ...keywords.constants,
    ...keywords.operators
  ];
}
