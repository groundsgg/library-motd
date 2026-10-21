# Text formats

Supported format identifiers: `minimessage`, `legacy-ampersand`, `legacy-section`, `properties`, `json` (Minecraft text components). MiniMessage supports standard colors, decorations including false, reset, newline, gradients, phase and rainbow. Unknown constructs are protected atoms: their original raw source remains intact and cross-format export requires explicit loss reduction. The library does not execute click/hover commands or HTML.

Unedited same-format serialization returns original source bytes. After editing, serializers emit equivalent structured content. Legacy colors reset decorations as in Minecraft; RGB output uses Bukkit `§x` sequences or Adventure hex syntax. Targets declare `rgb` capability. Unsupported RGB or protected constructs return an error unless `{lossy:'reduce'}` is explicitly chosen. Properties supports escaping and optional ASCII encoding.

`{{players}}`, `{{max}}` and custom `{{name}}` placeholders insert literal text, never parser source. Unknown names remain visible with a diagnostic. Player placeholders use the displayed numbers after count rules.

Uneven gradient stops are expanded into per-character colors for native MiniMessage output. Adventure 5.2 fixture comparisons cover gradients, rainbow, explicit child colors and phase. Gradient simplification is an explicit suggestion and does not mutate the document.

Default text parser limits: see `ParseOptions` (length and nesting). Documents reject cycles, non-JSON values, excessive nesting, duplicate IDs, invalid rules and invalid 64×64 PNG structure. Image import additionally decodes and normalizes PNG/JPEG before applying it.

Aligned/uneven-gradient MiniMessage output preserves placeholder tokens and protected raw subtrees. Runtime consumers should resolve placeholders before measuring alignment. JSON export preserves native opaque objects after adjacent edits; protected JSON layout that cannot be evaluated returns an explicit diagnostic. Legacy tooltip lines are serialized independently so inherited color and decoration carry into every sample name.
