# Client profiles and native evidence

`clientProfiles` contains Java 1.20.4, 1.21.1, 1.21.11, 26.1, 26.1.1, 26.1.2, 26.2 and 26.3. Named exports are `java1204Profile`, `java1211Profile`, `java12111Profile`, `java261Profile`, `java2611Profile`, `java2612Profile`, `java262Profile`, and `java263Profile`. Version/protocol values come from the official jars' version.json. This is a fixed release set, not a promise of automatic future-version compatibility. Custom profiles are supported.

Unmodified official clients 1.20.4, 1.21.1, 1.21.11, 26.1, 26.2 and 26.3 were launched in separate offline test sessions at 854×480, default font, GUI scale 2. They connected to a local status-only server. No account credentials were read. Versioned screenshots and hash manifests live in tests/fixtures/client. The OnlineServerEntry class files in 26.1, 26.1.1 and 26.1.2 are byte-identical; those original captures did not separately launch the patch releases; the 2026-10-23 verification below does.

Browser tests on Linux compare absolute foreground masks for the white server name, bold gold first MOTD line and green second line against every native capture. These included Latin cases match exactly. The uncolored red incompatible-version sample also matches in the 1.21.11/26.x references. The original text-only assertion excludes the old 1.20.4 version-field position; the complete-menu checks below now cover it. Native 1.21.1 hover confirms the white default and trailing “… and 41 more …”.

At scale 2, old row content starts at (126,72), while the selection outline starts at (122,68), size 610×72. In the modern captures the content starts at (126,74), and the outline at (122,70). Modern content width is 301 GUI pixels inside a 305-pixel selection frame; old content width is 305. Menu title, list and footer positions are profile data.

An independently created 64×64 icon matches the native displayed pixels. The transparent icon is checked after actual browser upload/crop/normalization: alpha 0,64,128,255 remains intact. Every composited pixel matches the native selected-row icon in 26.1. Unselected transparent areas expose the actual backdrop.

The bundled font is an independently recreated OFL font from IdreesInc/Minecraft-Font, with documented advance correction. See assets/java-1.21.1/provenance.json and THIRD_PARTY_NOTICES.md. All profiles keep verified:false: these references do not establish every glyph, decoration, wrapping case, resource pack or browser.

Default dirt, panorama, button and placeholder-icon graphics are original approximations, not extracted Mojang textures. The background families follow the client changes; the supplied panorama is a generic illustration, not each release's original scene. A host can supply per-version resources through context.assetProvider, including its own panorama image, button textures, fallback icon and font family. No Mojang game files are included in the npm archive. See embedding.md for configuration and rights boundaries.

## Complete-menu reference checks (2026-10-23)

`tests/fixtures/client/native-ui` adds independent unmodified-client sessions for all eight presets, including separate launches of 26.1.1 and 26.1.2. Each manifest identifies the client jar SHA-1, viewport, GUI scale, default resource pack and SHA-256 of every capture. Java 1.20.4 and 26.3 additionally cover GUI scales 1 (854×480) and 3 (1280×720); every preset covers scale 2 (854×480).

`native-menu-reference.spec.ts` checks menu/button and icon bounds, physical viewport sizing, selection geometry, incompatible-connection pixels and hover targets at these scales. At scale 2 it also compares title and enabled/disabled button-label foreground masks, compatible player counts and ping pixels, and incompatible-version placement for every preset. Hover checks use the same physical cursor coordinates as the native captures; they establish those targets and tooltip content rather than every hitbox boundary. Original button textures and panorama artwork are deliberately excluded from foreground comparisons. The 1.20.4 version text is six physical pixels farther right than 1.21.1 at GUI scale 2. Its selection outline also uses legacy centering and is shaded by the four-logical-pixel list-edge fade; browser/OpenGL interpolation may differ by one channel value.

These checks do not certify every glyph, wrapping case, resource pack, translated label, tooltip pixel, button texture or panorama. Profiles remain `verified: false`. The font checks below extend the evidence; complex layout and original asset sourcing remain separate work (#7 and #9).

Custom geometry can optionally set `statusRight` (status-text inset), `listFade` (legacy edge-fade height) and `selectionCenterRounding: "floor"`. Omitted values retain the standard status inset and selection centering without a list fade. Full-menu viewports retain their requested physical dimensions when GUI scaling produces fractional logical dimensions; compact row presentation keeps its existing dimensions.

## Font and decoration references (2026-10-23)

`tests/fixtures/client/native-font/<version>/` contains 11 cases from a separate official-client launch for each of the eight presets, at 854×480, GUI scale 2 and the vanilla default resource pack. Each manifest records the complete JSON status description, client SHA-1, crop coordinates, cropped-image SHA-256 and source-screenshot SHA-256. The 112 cropped screenshots cover ASCII, umlauts/Latin-1, Greek/Cyrillic/CJK/emoji/symbols, composed and decomposed accents, missing code points, bold, italic, underline, strikethrough, obfuscation and shadows. Runtime game files remain outside the repository; reference screenshots are excluded from npm.

`native-font-reference.spec.ts` compares the full gold/aqua foreground and quarter-brightness shadow masks for the ASCII, bold, Latin-1, underline, strikethrough and shadow cases. Both the viewer and inline editor are checked against each independent native reference in Chromium, Firefox and WebKit; the same cases run in Windows Chromium CI with the rasterization distinction below. This verifies those strings and styles at scale 2, not every glyph or combination. The measured corrections are:

- Bold adds one logical pixel to **every** advance, including spaces. `Ab iMW 42` advances 46 pixels normally and 55 pixels when bold. The bundled bold font already has a five-pixel space; layout now agrees with it.
- The tested 1.20.4 and 1.21.1 MOTDs have no shadow. The tested 1.21.11 and 26.x MOTDs have a shadow offset by (1,1), with each RGB channel divided by four and floored. `geometry.motdShadow` selects this behavior; omission preserves the old shadow-free MOTD. Gradient/rainbow shadows use each glyph's evaluated color.
- Underline quads sit at y=9 and strikethrough quads at y=4.5, with height 1 and an extra half-pixel of extent on each side of the browser glyph box. Native line shadows can cover glyph ink. Viewer and editor use the same quads while preserving the nine-pixel line advance. The clipping area includes the second line's descenders, underline and shadow; additional imported or wrapped glyphs are retained in the document and hidden according to the current layout. The editor follows the current glyph wrapping at word boundaries and inside displayed placeholder values, keeping placeholders atomic in its document. This prevents an extra DOM line from leaking into the expanded ink area; it does not implement the native word-breaking algorithm tracked in #7.
- Four independent obfuscation frames per client record changing glyphs. Browser tests verify replacement advance classes, stable positions/widths and unmodified spaces for regular and bold text. The replacement pool is limited to the bundled font. Random frames, native overhanging glyph outlines, cadence and the entire native replacement pool are **not** claimed pixel identical.

The Unicode references also establish limits rather than claiming additional bundled glyphs. `Ω Ж 中 😀`, arrows/checkmark/lightning, U+0378 and U+10FFFF are outside this font profile; browser fallback shapes and widths differ from the native client. For example, native missing-glyph advances are not represented by a universal six-pixel fallback. Decomposed `e`+U+0301 and `A`+U+0308 differ from their precomposed forms in the client. They remain atomic editor graphemes, but now produce `missing-glyph` warnings instead of being certified through NFC normalization. Exact custom-profile grapheme metrics take precedence; otherwise an NFC metric can only be an approximate width estimate.

Browser-synthesized italic rendering differs from the native textured slant, including its ink bounds and antialiasing. The captured italic cases are evidence of that gap; [#68](https://github.com/groundsgg/library-motd/issues/68) tracks the rendering correction. Resource-pack font import remains in #8. No additional Mojang font or texture data is bundled, and every preset remains `verified: false`.

Windows DirectWrite antialiasing differs from the native bitmap raster. At GUI scale 2 the Windows tests compare exact foreground **cell coverage** after excluding the softened fringe (gold R>200/G>130/B<40; aqua G>200/B>200/R<110), plus literal native shadow interior anchors and viewer/editor parity. They do not certify full raw-pixel equality of the antialiased edges or shadow masks. Linux Chromium/Firefox/WebKit retain exact foreground and shadow mask comparisons. [#70](https://github.com/groundsgg/library-motd/issues/70) tracks deterministic cross-platform rasterization and an actual Windows-client capture. The eight native sessions in this corpus ran on Linux with software OpenGL.

The font derivatives now align both `hmtx` and CFF charstring widths; correcting only `hmtx` left 191 regular and 190 bold glyph advances inconsistent, which Windows exposed as wider inline text. `tools/build-fonts.py` reproduces the OFL derivatives with fontTools 4.60.1, preserving outlines and rebuilding charstrings without glyph hints. This is a maintainer operation; npm consumers and ordinary package builds do not require Python.

## Word wrapping and text capabilities, 2026-10-23

All eight presets declare `font.layout: "java-ltr"`. The shared layout breaks at
the last U+0020 space when the next advance exceeds the line width; the overflowing
character may itself be that space. Exactly one delimiter space is suppressed in
the displayed line. Other leading, repeated and trailing spaces remain. With no
space available an oversized word splits at grapheme boundaries, consuming at
least one nonzero-width grapheme even in a very narrow viewport. Explicit empty
lines and a trailing newline are retained. Custom profiles omitting `font.layout`
keep the preceding glyph-by-glyph wrap behavior.

`tests/fixtures/client/native-wrapping/<version>/` records nine additional cases
from independent official-client sessions: ordinary words, overflowing spaces,
repeated spaces, leading spaces, long words, explicit empty/trailing lines,
trailing spaces, bold words and unsupported Unicode at a boundary. GUI scale is
2 with vanilla resources, 854×480, Linux software OpenGL. Each manifest records
exact JSON, client SHA-1, crop coordinates and screenshot checksums. The first
eight supported cases have foreground-mask regressions for viewer and inline
editor; Windows checks the same foreground coverage distinction documented above.
The Unicode case is evidence of the fallback boundary, not a parity assertion.

Source graphemes remain atomic, except that CRLF is split into the preserved CR
control and LF line boundary, matching the native client's distinction. Explicitly supported custom cluster metrics take
precedence over normalization estimates. LTR grapheme metrics do not implement
ICU contextual shaping or bidi ordering: input requiring those receives
`unsupported-text-layout`, alongside any `missing-glyph` diagnostics. Text and
direction-control characters are preserved. This capability does not certify
native Arabic, Hebrew, Indic, Thai or other complex-script rendering. The declared
script coverage permits Latin, Greek, Cyrillic, Han, Hiragana, Katakana, Hangul,
Common and Inherited graphemes; other scripts and every Unicode `Bidi_Control`
receive the layout diagnostic even when custom glyph metrics accept them.

An additional independent 26.3 session captured CRLF, LF and bare CR in
`native-wrapping-controls/26.3/`. It confirms that CR has a visible native control
glyph and LF breaks the line. The bundled DOM font cannot reproduce that control
glyph: CR uses a `?` display fallback and `missing-glyph` warning while source and
clipboard retain the original character. These three captures document the
unsupported glyph boundary; they do not certify the fallback as native ink.

Suppressed wrap delimiters remain in `LayoutResult.glyphs` with
`suppressed: true` and zero displayed advance. They are not emitted as viewer ink.
Inline soft breaks and quantized padding are display decorations: they do not
insert source newlines, split PM atoms or add undo steps. Imported lines beyond
the first two stay in the document with `hidden-lines` diagnostics.

Explicit layout export rejects empty or multiline protected fallbacks with
`protected-layout`, rather than dropping their raw component or duplicating its
internal newline. Ordinary same-format export still preserves the raw source.
