# Native italic glyphs

Issue #68 corrects the synthetic browser slant in the standalone viewer and
inline editor. Keep semantic text and font advances in the DOM; paint the
italic ink through locally generated PNG backgrounds on CSS pseudo-elements. Generate the binary glyph
cells from the existing independently recreated SIL OFL font, never game assets.

The official 26.3 BakedSheetGlyph bytecode uses a shear of `1 - y / 4`, relative
to the glyph's native top. Rasterize that shear at the preview's GUI scale;
foreground and quarter-brightness shadow use the same binary mask. Underline and
strikethrough remain horizontal. Bold uses the independently licensed bold face.
Custom font families, unsupported glyphs and non-pixel vector outlines keep their browser fallback.

CSS pseudo-elements avoid changing ProseMirror text, selections, clipboard,
composition or history. Larger tool text scales the silhouette with its font.
Obfuscation must refresh the silhouette when its displayed glyph changes.

Verify exact foreground and shadow masks against the existing independent
italic captures from all eight clients in Chromium, Firefox and WebKit, and
Windows Chromium. Test combined styles and real editing separately. Scope the
claim to the captured strings at GUI scale 2; other OS antialiasing remains #70.
No Portal change, release, merge or deployment is part of this fix.
