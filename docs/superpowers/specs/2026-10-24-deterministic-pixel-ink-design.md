# Deterministic bundled pixel ink

Issue #70 still observes Windows DirectWrite differences on normal/bold MOTD
glyphs. Reuse the independently licensed OFL cell data and the existing italic
canvas path for all supported bundled glyphs in renderText and inline fields.
Real text, advances, selection/caret, clipboard, composition, tokens and undo
remain owned by the existing DOM/ProseMirror paths. Unknown/non-grid glyphs and
custom fonts retain browser fallback. Menu titles/server-name text outside the
per-glyph path remain outside this change's raw-pixel claim.

Generalize the private renderer to ink.ts/pixelInkStyle/applyPixelInk. Cache keys
must include italic state. Use a generic mcp-pixel-glyph class for the paint path;
retain mcp-pixel-italic only for actual italic glyphs so existing internal tests
and style semantics remain meaningful. Non-italic uses zero shear; italic keeps
the verified native shear. Foreground and quarter-brightness shadows share the
same physical pixel masks and integer origin. Obfuscation refreshes masks as well
as text. Hidden overflow stays in source and never allocates bitmaps.

Replace the Windows foreground-fringe/shadow-anchor exceptions in native font
reference tests with full exact foreground/shadow masks for the eight captured
Java presets at GUI scale2. Verify actual Windows Chrome and Linux3engines.
Existing GUI1/3 and DPR2 mixed-style comparisons establish viewer/editor parity,
not independent native capture coverage. All API behavior and asset licensing
remain unchanged, with data: CSP requirement documented already.

This is the rendering portion of #70 only. An actual Windows Java-client capture
requires unavailable node_repl Computer Use support in this session and remains
open; do not close #70 or claim complete cross-platform native certification.
Keep every public profile verified:false. No Portal/merge/release/deployment.
