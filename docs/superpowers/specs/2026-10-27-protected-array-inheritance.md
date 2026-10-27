# Protected component-array inheritance

Issue #23 still has a concrete boundary bug: a protected first JSON component
does not lend its style to later array entries. The native Java 26.3 component
codec and styled visitor confirm that the first entry is the parent: red/bold
`A`, explicit non-bold `B`, and plain `C` display red with bold true/false/true.
The parent's insertion metadata also reaches B and C. This was checked against
the locally installed official client (SHA-1
`e877b6a07acd633fb3bb475002175cec036e7b87`), using its actual codec and visitor;
this is a semantic probe, not a new native screenshot certification.

Preserve that dependent array as one existing JSON opaque atom when its first
parsed entry is opaque. The inert display projection can then evaluate known
literal colors and boolean decorations across the original array boundary.
Keep the original full array JSON, its order and literal fallback; surrounding
components remain independently editable. Nested arrays retain this boundary.
Untouched source bytes, persistence, same-format subtree preservation, source
offsets, undo and protected-layout guards must continue to work.

Alternatives: copying known root styles to an editable wrapper would lose
unknown inherited metadata after export; extending the public persisted schema
for arbitrary native inheritance is disproportionate to this correction. The
existing opaque representation preserves the dependency without either risk.
The tradeoff is that dependent entries within this array use source editing.

Reuse the first parsed atom's raw/fallback values while protecting an enclosing
array, rather than rewalking its nested first child. Keep depth limits and the
bounded styled projection. No actions, HTML, resource requests, contextual
translation/selector/NBT evaluation, new public API, dependency or release change.
Previously persisted documents that already lost the boundary cannot be
reconstructed reliably; reimport their JSON source to recover it.

The importer also tolerates empty component arrays, which the measured native
codec rejects. Such arrays can flatten one source subtree into multiple parsed
nodes. Track which array boundaries were actually preserved during this parse;
only reuse an atom's raw/fallback when it owns the complete first subtree.
Otherwise retain that first subtree directly. Keep all visible text and source
shape for these tolerated inputs, without claiming native style semantics.
