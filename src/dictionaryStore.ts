import * as vscode from 'vscode';
import { Dictionary, parseDictionaryFile } from './dictionaryParser';

export interface DictItemRef {
  name: string;
  label: string;
  dataType: 'numeric' | 'alpha';
  dictionary: string;
}

let dictionaries: Dictionary[] = [];
const changeEmitter = new vscode.EventEmitter<void>();
export const onDictionariesChanged = changeEmitter.event;

/** Scans the workspace for .dcf files and parses them into memory. */
export async function refreshDictionaries(): Promise<void> {
  dictionaries = [];
  const files = await vscode.workspace.findFiles('**/*.dcf', '**/node_modules/**', 200);
  for (const file of files) {
    const dict = parseDictionaryFile(file.fsPath);
    if (dict) {
      dictionaries.push(dict);
    }
  }
  changeEmitter.fire();
}

export function getDictionaries(): Dictionary[] {
  return dictionaries;
}

/** Flattened list of all item names across all parsed dictionaries. */
export function getDictionaryItemNames(): DictItemRef[] {
  const refs: DictItemRef[] = [];
  const seen = new Set<string>();
  for (const dict of dictionaries) {
    for (const rec of dict.records) {
      for (const item of rec.items) {
        const key = item.name.toLowerCase();
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        refs.push({
          name: item.name,
          label: item.label,
          dataType: item.dataType,
          dictionary: dict.name || 'dictionary'
        });
      }
    }
  }
  return refs;
}
