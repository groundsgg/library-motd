# Import assistance

**Server entry tools → Import assistance** analyzes the current document only
when requested. It never rewrites data during paste, source editing or server
import. Review a proposal's original/suggested server rows, read-only source
values and measured deviations, then choose Apply or Cancel. Apply is one undo
transaction; Cancel and Escape keep the complete original document.

The dialog proposes compact gradients for per-character colors and measured
center/right alignment for leading ASCII-space padding. Original whitespace
might be intentional: only explicit acceptance replaces it. Trailing spaces
remain. Choose one field/proposal at a time. Source views also cover custom
version and hover text that the selected client may hide in its row.

RGB and position tolerances default to zero. RGB deviation is the largest
absolute difference in any color channel (0–255). Position deviation is the
largest horizontal glyph-position difference in logical GUI pixels (0–4),
independent of CSS scale. Larger tolerances explicitly permit approximation.
Changing the document, measurement context or permissions invalidates the
dialog; close and reopen it to analyze the current state. Language changes
preserve focused controls. Set `features: { assistance: false }` to disable the
action; read-only, disabled and field permissions also apply.

## Pure core API

```ts
import { suggestImportAssistance, java1211Profile } from "@groundsgg/motd";

const proposals = suggestImportAssistance(document, {
  profile: java1211Profile,
  width: 271, // Actual logical MOTD text width, excluding the icon.
  colorTolerance: 0,
  positionTolerance: 0,
});
// After the host explicitly accepts one:
editor.execute({ type: "replace-document", document: proposals[0].candidate });
```

Each `ImportAssistanceProposal` includes `kind` (`gradient` or `alignment`),
`field` (`motd`, `version`, `hover`), detached full `original` and `candidate`
documents, `maximumColorError`, `maximumPositionError` and `removedPadding`
(the count of leading ASCII spaces replaced by alignment). The caller's input
is never mutated. Other document fields/extensions remain unchanged.

`ImportAssistanceOptions` requires `profile` and a positive finite `width`.
Tolerance values must be finite and within their documented bounds; invalid
options return no proposals. The DOM tool supplies its actual entry text width
and filters candidates by editable fields. Standalone core consumers must apply
their own permission and stale-result checks.

Analysis is conservative and bounded to 2,048 graphemes, 4,096 nodes and 32
group levels per field. These limits are checked before allocating flattened
glyphs. Fields with
placeholders, protected components, existing gradients/rainbows or obfuscated
text are skipped. Gradient compaction requires a single line, uniform non-color
style and fewer stops than characters. Alignment requires at most two explicit
MOTD lines, leading ASCII spaces and no wrapping, unsupported glyph/layout
diagnostics or nonfinite advances. It leaves existing alignment and trailing
whitespace intact. These omissions produce no proposal, not lossy fallback.
Font precision depends on the supplied profile's metrics; this API does not
inspect an arbitrary host font's rasterization.

`suggestSimplification(text, { tolerance })` remains available as the lower-level
color proposal API. It now also skips placeholders, preserving their semantic
identity rather than flattening their source spelling into text.
