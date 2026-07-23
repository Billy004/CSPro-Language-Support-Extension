# CSPro Language Support

A Visual Studio Code extension that turns VS Code into a lightweight CSPro
development environment — syntax highlighting, autocomplete, navigation,
diagnostics, dictionary parsing and code generation.

## Features

| Area | What you get |
| --- | --- |
| **Syntax highlighting** | Keywords, functions, strings, comments (`//` and `{ }`), numbers and operators for CSPro logic. |
| **Autocomplete** | Built-in CSPro functions, keywords, snippets, symbols declared in the current file, and dictionary items found in the workspace. |
| **Hover help** | Function signature, description and return type on hover. Dictionary items show their type and label. |
| **Diagnostics** | Warns about unbalanced blocks (`if`/`endif`, `do`/`enddo`, `for`/`endfor`) and calls to unknown functions. |
| **Navigation** | Outline / breadcrumbs via document symbols (PROCs, functions, variables). |
| **CSPro Project explorer** | Activity-bar view listing files, dictionaries (records → items), procedures and variables. Click to jump. |
| **Dictionary parsing** | Reads `.dcf` files: dictionary, records, items, types, lengths and labels. |
| **Code generation** | `CSPro: Create Procedure` inserts a `PROC … ENDPROC` template. `CSPro: Generate SQL Schema from Dictionary` converts a `.dcf` into `CREATE TABLE` statements. |

## Supported files

`.ent` `.app` `.dcf` `.pff` `.fmf` `.pen` `.apc` `.ff` `.ffs` `.ffd`

## Getting started (development)

```bash
npm install
npm run compile
```

Then press **F5** in VS Code to launch an Extension Development Host with the
extension loaded. Open any `.ent`/`.app`/`.dcf` file to see it in action.

## Commands

- **CSPro: Create Procedure** — generate a new `PROC` block.
- **CSPro: Generate SQL Schema from Dictionary** — turn a `.dcf` into SQL.
- **CSPro: Refresh Project Explorer** — rescan the workspace.

## Settings

- `cspro.diagnostics.enable` — turn validation on/off (default: on).
- `cspro.diagnostics.unknownFunctions` — warn about unknown function calls (default: on).

## Project layout

```
src/                 TypeScript extension source
  extension.ts       Activation + wiring
  metadata.ts        Loads function/keyword metadata
  providers.ts       Completion, hover, document symbols
  diagnostics.ts     Block-balancing + unknown-function checks
  dictionaryParser.ts  .dcf parser
  dictionaryStore.ts   Workspace-wide dictionary cache
  logicParser.ts     Extracts PROC/function/variable symbols
  projectExplorer.ts CSPro Project tree view
  commands.ts        Procedure generator, DCF→SQL, reveal
syntaxes/            TextMate grammar
snippets/            Code snippets
metadata/            functions.json, keywords.json
```

## Roadmap

- **0.1** — Language detection, file association, basic highlighting ✅
- **0.2** — Function recognition, autocomplete, snippets ✅
- **0.3** — Dictionary parsing, variable suggestions, navigation ✅
- **1.0** — Full CSPro development environment (form parsing, go-to-definition across files, richer validation).

## License

MIT
