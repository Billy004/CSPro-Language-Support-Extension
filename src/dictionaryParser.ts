import * as fs from 'fs';

export interface DictItem {
  name: string;
  label: string;
  start: number;
  length: number;
  decimals: number;
  dataType: 'numeric' | 'alpha';
  lineNumber: number;
}

export interface DictRecord {
  name: string;
  label: string;
  items: DictItem[];
  lineNumber: number;
}

export interface Dictionary {
  name: string;
  label: string;
  records: DictRecord[];
  filePath: string;
}

/**
 * Parses a CSPro .dcf dictionary file. The .dcf format is an INI-like
 * structure of [Dictionary] / [Record] / [Item] sections with key=value pairs.
 */
export function parseDictionaryFile(filePath: string): Dictionary | undefined {
  let text: string;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
  return parseDictionaryText(text, filePath);
}

export function parseDictionaryText(text: string, filePath = ''): Dictionary | undefined {
  const lines = text.split(/\r?\n/);

  const dict: Dictionary = {
    name: '',
    label: '',
    records: [],
    filePath
  };

  type Section = 'none' | 'dictionary' | 'record' | 'item' | 'level' | 'other';
  let section: Section = 'none';
  let currentRecord: DictRecord | undefined;
  let currentItem: DictItem | undefined;

  const flushItem = () => {
    if (currentItem && currentRecord) {
      currentRecord.items.push(currentItem);
    }
    currentItem = undefined;
  };
  const flushRecord = () => {
    flushItem();
    if (currentRecord) {
      dict.records.push(currentRecord);
    }
    currentRecord = undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (line === '') {
      continue;
    }

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      const header = sectionMatch[1].toLowerCase();
      if (header === 'dictionary') {
        flushRecord();
        section = 'dictionary';
      } else if (header === 'level') {
        flushRecord();
        section = 'level';
      } else if (header === 'record') {
        flushRecord();
        section = 'record';
        currentRecord = { name: '', label: '', items: [], lineNumber: i };
      } else if (header === 'item') {
        flushItem();
        section = 'item';
        currentItem = {
          name: '',
          label: '',
          start: 0,
          length: 0,
          decimals: 0,
          dataType: 'alpha',
          lineNumber: i
        };
      } else {
        // ValueSet, Value, Relation, etc. — skip contents.
        flushItem();
        section = 'other';
      }
      continue;
    }

    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();

    if (section === 'dictionary') {
      if (key === 'name') {
        dict.name = value;
      } else if (key === 'label') {
        dict.label = value;
      }
    } else if (section === 'record' && currentRecord) {
      if (key === 'name') {
        currentRecord.name = value;
      } else if (key === 'label') {
        currentRecord.label = value;
      }
    } else if (section === 'item' && currentItem) {
      switch (key) {
        case 'name':
          currentItem.name = value;
          break;
        case 'label':
          currentItem.label = value;
          break;
        case 'start':
          currentItem.start = parseInt(value, 10) || 0;
          break;
        case 'len':
          currentItem.length = parseInt(value, 10) || 0;
          break;
        case 'decimal':
          currentItem.decimals = parseInt(value, 10) || 0;
          break;
        case 'datatype':
          currentItem.dataType = /num/i.test(value) ? 'numeric' : 'alpha';
          break;
        case 'contenttype':
          if (/numeric/i.test(value)) {
            currentItem.dataType = 'numeric';
          }
          break;
      }
    }
  }

  flushRecord();
  return dict.name || dict.records.length > 0 ? dict : undefined;
}
