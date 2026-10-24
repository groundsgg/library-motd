# Opt-in import assistance

Issue #15 adds a deliberate Import assistance action to Server entry tools.
It analyzes the current document (including pasted/imported data) and presents
individual before/after candidates. Nothing runs or applies automatically.

A pure core suggestImportAssistance(document, options) returns detached proposals
with kind gradient/alignment, field motd/version/hover, original/candidate full
documents, maximumColorError (max RGB-channel difference, 0–255),
maximumPositionError (logical GUI pixels) and removedPadding (ASCII spaces).
Options require the measured profile and MOTD width; tolerances default to 0.
Only finite nonnegative tolerances are accepted; color max255, position max4.
Input analysis is bounded to 2048 graphemes per field, two explicit MOTD lines,
and no wrapped/unsupported glyph layout for alignment.

Gradient proposals compact per-character colors with fewer stops than glyphs,
preserving non-color style and exact visible text. Existing gradient/rainbow
intent, placeholders and protected subtrees are skipped, never flattened into
literal text. The existing public suggestSimplification must also preserve
placeholders rather than turning their spelling into plain text.

Alignment proposals recognize leading ASCII-space padding for center/right on
left-aligned MOTD lines. They remove padding only in the proposed candidate,
preserve trailing whitespace and static styles, and report the largest measured
position difference. They skip effects, placeholders, opaque constructs,
wrapped or unsupported layouts. The two candidate alignments are compared by
measured glyph positions; choose the closest within tolerance. No claim is made
that original whitespace was accidental. Accepting explicitly replaces it;
rejecting preserves the complete original source. Already aligned lines stay as
supplied. One proposal may contain both qualifying MOTD lines.

The editor dialog offers field/kind selection, bounded RGB/position tolerances,
passive before/after row previews and measured deviations/padding count. The
complete source forms are also visible in read-only textareas so hidden fields
can be compared. Apply changes the selected candidate through one ordinary
visual document transaction; Cancel/Escape changes nothing. Changes to document,
measurement context or field permission invalidate the draft. Language-only
updates preserve controls and selection. Read-only/disabled/feature restrictions
block analysis/apply, including programmatic clicks on stale controls. Cancel,
close and destroy release both preview instances. Dialog elements use the owning
document and existing overlay behavior. All labels ship in both catalogs.

Public API/docs describe conservative omissions, units, bounds and limitations.
One English PR, stacked on #75. No Portal changes, merge, release or deployment.
