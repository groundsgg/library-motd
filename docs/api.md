# Public API

`@groundsgg/motd` exports the types in `src/core/model.ts` and these functions:

| Function | Purpose |
| --- | --- |
| `createDocument(text?)` | New schema-1 document; no random runtime data |
| `validateDocument(value)`, `readDocument(json)` | Bounded JSON validation; `Outcome<T>` with value/null and diagnostics |
| `writeDocument(document)` | JSON serialization, rejects invalid documents |
| `parseText(source, format, options?)` | Parse MiniMessage, legacy, properties or JSON |
| `serializeText(text, target, options?)` | Format export; source fidelity or explicit lossy reduction |
| `flattenText(text)` | Styled graphemes and resolved effect colors |
| `resolveText(text, values)` | Literal, injection-safe placeholders |
| `layoutText(text, options)` | Pixel advances, alignments, overflow and missing glyph diagnostics |
| `suggestSimplification(text, options?)` | Non-destructive approximation with an error estimate |
| `evaluateStatus(document, context)` | Java status, count/version rules, icon and sample hover |
| `compileStatusTemplate(document)` | JSON-safe runtime template, no source or UI extensions |
| `importStatus(status)` | Validated document from supplied status data |
| `java1211Profile` | Bundled local font and Java geometry |

DOM exports `createPreview`, `createEditor`, `normalizeIcon` and associated public types. Both handles offer `update(options)` and idempotent `destroy()`. Preview exposes `getDiagnostics()`. Editor exposes `getDocument()`, `focus('motd'|'version'|'hover')`, and `execute(command)`.

Commands: `format {style,field?}`, `gradient {stops,field?}`, `align {line,align}`, `set-field {field,value}`, `replace-source {source,format?,field?}`, `replace-document {document,origin?}`, `undo`, `redo`. Gradient stops have hex colors and strictly increasing positions in [0,1]. Format styles include explicit false values. Undo covers every document field; consecutive typing is grouped.

`EditorChange` contains origin (`visual`, `source`, `import`, `history`) and changedFields. Persist the document, not the handle or context. `update` with the acknowledged current document keeps history and selection; replacing the external document resets the editor baseline.

Document fields: `motd {text,alignments}`, version `automatic|when-incompatible|always`, icon `null|{pngBase64}`, players `{hidden,online,maximum}`, hover `inherit|disabled|custom`, and JSON-only extensions. Count rules are `inherit|fixed|offset|percent`; maximum also accepts `headroom` above the displayed online count. Values clamp to non-negative signed 32-bit integers.
