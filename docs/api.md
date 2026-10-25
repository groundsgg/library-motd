# Public API

`englishLabels`, `germanLabels`, `formatLabel`, `interpolateMessage` and
`formatDiagnostic` are pure core exports. `MessageKey`, `MessageParameters`,
`LabelOverrides` and `DiagnosticMessage` describe their contracts. All UI
adapters accept partial `labels` overrides. See [localization.md](localization.md)
for named parameters, live updates and structured diagnostic fallbacks.

`suggestImportAssistance(document, options)` returns detached gradient/alignment
proposals with measured color/position deviations, explicit tolerances and no
automatic application. See [import-assistance.md](import-assistance.md).

`normalizeStatusIcon(icon)` projects PNG data to its static/default 64×64 image
without a DOM or pixel decoder. Status evaluation, runtime templates and imports
share this projection; saved source stays unchanged. See [icon-animation.md](icon-animation.md).

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

Commands: `format {style,field?}`, `clear-format {styles,field?}`, `gradient {stops,field?}`, `align {line,align}`, `set-field {field,value}`, `replace-source {source,format?,field?}`, `replace-document {document,origin?}`, `undo`, `redo`. Gradient stops have hex colors and strictly increasing positions in [0,1]. Format styles include explicit false values. `clear-format` removes the named style keys from inherited selection paths (for example `styles: ["rainbow"]`), preserving other styles. At a caret it clears the stored formatting for future typing; selected text and line breaks are cleared atomically and support undo. Undo covers every document field; consecutive typing is grouped.

`EditorChange` contains origin (`visual`, `source`, `import`, `history`) and changedFields. Persist the document, not the handle or context. `update` with the acknowledged current document keeps history and selection; replacing the external document resets the editor baseline.

Context, label and permission updates retain the mounted text inputs and undo history. Updates during text composition are applied after composition ends. Context changes are detected even if the host updates the same context object, and changing an asset-provider function refreshes its resolved assets. Viewer and editor use the same persistent server-entry renderer; editor tools never change native row geometry.

`EditorOptions.toolbar` accepts `"fixed"` (default) or `"selection"`. The selection toolbar follows mouse/keyboard text selections; the Text tools action or `Alt+F10` also opens it at a caret. Updating placement keeps selection/history and emits no document change. Both placements share contextual color, gradient, placeholder, decoration and rainbow tools. Line alignment applies to the active MOTD line. Tools use anchored popovers, or modal bottom sheets below a 640 CSS-pixel viewport; Escape closes a popover without undoing its live edits. Saved selections expire if their text is replaced.

Source, image and import dialogs stage their changes until Apply; Cancel emits no change. A source Apply can update several enabled text fields in one history transaction with origin `source`. Import keeps its existing `changedFields` contract: all enabled imported fields are reported, including values that already match. Disabled fields are retained. Source/import/image drafts are invalidated by external document replacement; their Apply actions are disabled and an explanation stays visible. Export is read-only and never copies serialization diagnostics.

Document fields: `motd {text,alignments}`, version `automatic|when-incompatible|always`, icon `null|{pngBase64}`, players `{hidden,online,maximum}`, hover `inherit|disabled|custom`, and JSON-only extensions. Count rules are `inherit|fixed|offset|percent`; maximum also accepts `headroom` above the displayed online count. Values clamp to non-negative signed 32-bit integers.

`evaluatePlayerCounts(document, context)` returns resolved online/max values independently of whether the player field is hidden. Preview placeholders use those values. `serializeLegacyLines(text, target, options?)` exports separately styled client values for sample-player tooltips.

`EditorOptions.mapChange(next, change)` can enrich a document before validation/history/notification. Use it for JSON-only application intent in `extensions`. It runs for visual/source/import commits; undo/redo restores the previously mapped document. It must return a valid document. This keeps application metadata in the same undo transaction without coupling the library to an application.

`PreviewContext.assetProvider(profile)` returns optional `ClientAssets` for the selected version. `ClientAssets` accepts static or animated panorama backgrounds, defaultServerIcon, fontFamily and button texture URLs. The host owns their licenses, loading and lifetime. `PreviewBackground` also supports transparent or explicit custom backgrounds. `PanoramaBackground` accepts six face URLs, bounded motion, blur and dimming; `panoramaPose` exposes the DOM-free native camera pose. See [panoramas.md](panoramas.md) and embedding.md.

`FontProfile.layout: "java-ltr"` enables the measured Java ASCII-space wrapping
used by bundled profiles. Omission retains legacy grapheme wrapping for existing
custom profiles. `Glyph.suppressed` identifies a consumed soft-break delimiter
that remains available for source mapping. See [profiles.md](profiles.md) for
supported shaping and diagnostic boundaries.

`serializeText(..., { layout })` materializes measured visual lines and their
space-quantized alignment. Ordinary export preserves source whitespace/newlines.
Layout that would split a protected component or unresolved token returns
`protected-layout`; resolve values first or export without layout.
`evaluateStatus(document, context)` accepts optional
`context.motdLayout: { profile, width }` for aligned MOTD output. Without it the
existing 1.21.1/271-pixel layout is retained. DOM/React previews supply the width
of the displayed entry automatically, including narrow viewports.
