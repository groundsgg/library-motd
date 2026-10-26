# Protected literal display styles

#23's first increment preserves JSON literals with action metadata and displays
their literal descendants. Its remaining concrete gap is visible formatting:
`{"text":"Click","color":"red","bold":true,"clickEvent":...}` renders as plain
gray despite retaining the complete JSON. Extend that existing case with an
inert styled projection for viewer and inline editor. Adventure #1335 remains
the motivating raw callback-payload example; the colored/decorated variants are
our controlled regressions, not additional production samples.

Keep the public document schema, opaque atom boundary and every raw subtree
unchanged. Build a private display projection from only literal text, extra,
arrays, valid named/RGB colors and boolean decorations. Discard action payloads
and other metadata from that projection. Reuse the existing JSON parser for
component-array inheritance and explicit false style resets. Unknown dynamic
components remain unsupported markers with literal siblings intact; no language
catalog, key mapping, scoreboard, selector or NBT context is invented.

Use the styled projection only for layout and editor display. Keep public
flattenText, ordinary serialization/reduction and source mapping unchanged.
Explicit layout materialization uses the corrected bold widths through the
existing layout API: padding or protected-break rejection may consequently
change. It must still refuse splitting or rewriting protected raw subtrees.
Map projected styles back onto the original opaque glyphs only if text,
grapheme boundaries and offsets agree exactly. Preserve inherited outer styles
unless a projected literal explicitly overrides them. Keep existing protected
approximation diagnostics, including after persistence.

Limit projection to 65,536 raw characters, depth 128 and 32,768 visited values.
Malformed/oversized/raw-fallback mismatches or changed grapheme boundaries fall
back to the previous plain display. Cache by opaque node identity plus raw and
fallback values using a WeakMap, with no persistent/global string cache. Never
interpret HTML, activate actions, fetch resources or modify source/undo history.

Alternatives: changing opaque nodes into editable groups risks source loss;
adding derived children to the persisted schema duplicates data. A private
display projection provides the bounded improvement without either change.
This does not certify arbitrary component rendering against the native client.

Source context: [Adventure callback-payload example](https://github.com/PaperMC/adventure/issues/1335),
the existing protected-export/preview fixtures and JSON parser inheritance tests.
