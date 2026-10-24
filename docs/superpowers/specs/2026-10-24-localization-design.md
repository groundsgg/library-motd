# Complete standalone localization

Issue #18 completes localization for the public viewer, editor and diagnostics.
Keep `labels` as a partial string-map override; add complete exported English
and German catalogs and pure template/diagnostic formatters usable without DOM,
React or the Portal. Named parameters allow translated word order.

Diagnostics retain their stable `code`, `path`, severity and English `message`.
Add a stable message key and separate named parameters for built-in messages.
Unknown host diagnostics retain their supplied text.

Private DOM label references bind translated text nodes and attributes to an
instance-scoped resolver. Update bindings in place when options change, including
open overlays, titles, input labels and live statuses. Never translate document
content or replace a focused control to change language. Use weak node references
and clear bindings on destroy. Existing label keys remain usable; new parameterized
keys preserve legacy overrides where their meaning overlaps.

Localize every built-in user-facing string, including crop controls, enum
choices, dynamic alignment/gradient labels and errors. User-supplied content,
format identifiers, server data and host error details remain data. Provide
catalog documentation and language controls in both standalone examples.

Verify complete catalogs, interpolation, stable diagnostics, custom overrides,
literal text escaping, two independent instances and live language changes in
open tools. Selection, focus, pending drafts and undo must survive. One English
PR for #18, Conventional Commit/branch; no merge, release or Portal deployment.
