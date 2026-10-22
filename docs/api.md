# Public API

`@groundsgg/motd` exports the types in `src/core/model.ts` and these functions:

| Function                                        | Purpose                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `createDocument(text?)`                         | New schema-1 document; no random runtime data                         |
| `validateDocument(value)`, `readDocument(json)` | Bounded JSON validation; `Outcome<T>` with value/null and diagnostics |
| `writeDocument(document)`                       | JSON serialization, rejects invalid documents                         |
| `parseText(source, format, options?)`           | Parse MiniMessage, legacy, properties or JSON                         |
| `serializeText(text, target, options?)`         | Format export; source fidelity or explicit lossy reduction            |
| `flattenText(text)`                             | Styled graphemes and resolved effect colors                           |
| `resolveText(text, values)`                     | Literal, injection-safe placeholders                                  |
| `layoutText(text, options)`                     | Pixel advances, alignments, overflow and missing glyph diagnostics    |
| `suggestSimplification(text, options?)`         | Non-destructive approximation with an error estimate                  |
| `evaluateStatus(document, context)`             | Java status, count/version rules, icon and sample hover               |
| `compileStatusTemplate(document)`               | JSON-safe runtime template, no source or UI extensions                |
| `importStatus(status)`                          | Validated document from supplied status data                          |
| `clientProfiles`, named Java profile exports    | Local font, protocol, background family and per-version geometry      |

DOM exports `createPreview`, `createEditor`, `normalizeIcon` and associated public types. Both handles offer `update(options)` and idempotent `destroy()`. Preview exposes `getDiagnostics()`. Editor exposes `getDocument()`, `focus('motd'|'version'|'hover')`, and `execute(command)`.

Commands: `format {style,field?}`, `gradient {stops,field?}`, `align {line,align}`, `set-field {field,value}`, `replace-source {source,format?,field?}`, `replace-document {document,origin?}`, `undo`, `redo`. Gradient stops have hex colors and strictly increasing positions in [0,1]. Format styles include explicit false values. Undo covers every document field; consecutive typing is grouped.

`EditorChange` contains origin (`visual`, `source`, `import`, `history`) and changedFields. Persist the document, not the handle or context. `update` with the acknowledged current document keeps history and selection; replacing the external document resets the editor baseline.

Context, label and permission updates retain the mounted text inputs and undo history. Updates during text composition are applied after composition ends. Context changes are detected even if the host updates the same context object, and changing an asset-provider function refreshes its resolved assets. Viewer and editor use the same persistent server-entry renderer; editor tools never change native row geometry.

`EditorOptions.toolbar` accepts `"fixed"` (default) or `"selection"`. The selection toolbar follows mouse/keyboard text selections; the Text tools action or `Alt+F10` also opens it at a caret. Updating placement keeps selection/history and emits no document change. Both placements share contextual color, gradient, placeholder, decoration and rainbow tools. Line alignment applies to the active MOTD line. Tools use anchored popovers, or modal bottom sheets below a 640 CSS-pixel viewport; Escape closes a popover without undoing its live edits. Saved selections expire if their text is replaced.

Document fields: `motd {text,alignments}`, version `automatic|when-incompatible|always`, icon `null|{pngBase64}`, players `{hidden,online,maximum}`, hover `inherit|disabled|custom`, and JSON-only extensions. Count rules are `inherit|fixed|offset|percent`; maximum also accepts `headroom` above the displayed online count. Values clamp to non-negative signed 32-bit integers.

`evaluatePlayerCounts(document, context)` returns resolved online/max values independently of whether the player field is hidden. Preview placeholders use those values. `serializeLegacyLines(text, target, options?)` exports separately styled client values for sample-player tooltips.

`EditorOptions.mapChange(next, change)` can enrich a document before validation/history/notification. Use it for JSON-only application intent in `extensions`. It runs for visual/source/import commits; undo/redo restores the previously mapped document. It must return a valid document. This keeps application metadata in the same undo transaction without coupling the library to an application.

`PreviewContext.assetProvider(profile)` returns optional `ClientAssets` for the selected version. `ClientAssets` accepts background, defaultServerIcon, fontFamily and button texture URLs. The host owns their licenses, loading and lifetime. `PreviewBackground` also supports transparent or explicit custom backgrounds. See embedding.md.
