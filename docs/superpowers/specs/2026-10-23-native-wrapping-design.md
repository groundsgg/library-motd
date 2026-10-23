# Native Java MOTD wrapping

Issue #7 makes the preview, inline editor and explicit layout export use the
same measured line breaks. User authorization: continue the proposed issue #7
work, with one conventional branch and English PR. Existing viewer/editor APIs,
source documents, placeholders and protected components remain reusable outside
the Portal. No release or deployment is part of this change.

## Approach

Use the shared TypeScript layout engine rather than browser word breaking.
CSS-only wrapping cannot represent Java's consumed single ASCII-space delimiter
or guarantee agreement with export. A separate bitmap editor would replace the
existing accessible editing surface and is outside this issue. Keep ProseMirror
and apply display-only soft breaks, leaving source, selection and history intact.

Bundled profiles opt into `font.layout: "java-ltr"`; omitted custom-profile values
retain the old grapheme wrapping. Native Java wraps at the last ASCII space
before overflow (including the overflowing space), removes that one delimiter
from displayed lines, and splits an oversized word while always consuming at
least one nonzero-width grapheme. Source graphemes and hidden additional lines
remain present. Newlines remain explicit source boundaries.

The capability is left-to-right grapheme layout. Supported custom grapheme
metrics are honored; unsupported complex shaping and bidirectional input get
explicit warnings. Browser fallback glyphs are not certified as native shaping.
Actual ICU bidi/shaping with complete native fonts is outside this capability.

## Verification and constraints

Capture whitespace, long words, explicit newlines and clipping in all eight real
Java presets, with vanilla resources and GUI scale 2. Preserve jar and screenshot
hashes and exact status descriptions. Only cropped development references enter
git; no runtime game files or Mojang font assets enter npm. Compare supported
ASCII pixel masks against both viewer and editor, retain the documented Windows
antialiasing boundary, and test source preservation, atomic tokens, alignment,
resizing, formatting, undo and composition behavior.

Explicit layout export materializes the measured visual lines and per-line
space padding without silently flattening protected/dynamic constructs. Ordinary
serialization continues to preserve source. Unsupported protected layout must
return an actionable diagnostic rather than alter token contents.
