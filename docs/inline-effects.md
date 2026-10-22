# Inline text effects

The editor and final preview use the same `resolveText` and `flattenText` color
calculation. Gradients interpolate by grapheme position, rather than CSS pixel
width; a wide `W` and narrow `i` each advance the gradient once. Multiple stops,
phase, rainbow direction, nested color overrides and line breaks follow the
existing core semantics. Resolved placeholder text participates in the same
calculation while the placeholder remains one protected editing token.

![Inline gradient example using bundled fonts](images/inline-gradient.png)

This Chromium example is a browser/editor reference using bundled fonts and
original assets, not a new native-client capture. The six gradient/rainbow
browser tests independently compare computed glyph colors with the existing
Adventure 5.2 fixtures in `tests/fixtures/text/adventure.json`. Additional cases
cover `WiWi`, two lines and a resolved player-count placeholder.

ProseMirror decorations carry display colors. They do not replace semantic
marks with individual character colors, change gradient boundaries or flatten
source exports. Token node views only render local text. Unknown constructs
retain their protected source fallback and roundtrip behavior.

During composition the decorations map with the existing transaction instead
of recalculating colors around the composing DOM. They refresh when composition
ends, without creating an undo entry. Disposal prevents a queued refresh from
using a destroyed editor. Synthetic composition and selection/undo tests cover
this boundary; they do not establish actual Japanese IME compatibility.
