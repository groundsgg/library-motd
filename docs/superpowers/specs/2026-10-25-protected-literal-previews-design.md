# Protected literal previews

Issue #23 has a concrete first case: `tests/unit/protected-export.test.ts`
already preserves a JSON `text` component with a click event and an `extra`
child, but the preview drops that child. PaperMC Adventure issue
[#1335](https://github.com/PaperMC/adventure/issues/1335) also contains a real
component with an empty literal root, `extra` children and a custom callback
payload. These cases need literal display, not callback interpretation.

Keep the existing opaque node and its entire raw JSON. Derive only a plain-text
fallback from string components, arrays, literal `text` and recursive `extra`.
Do not inspect event payloads, HTML, translation arguments or other metadata.
Unknown contents display `[unsupported component]`; their literal siblings remain
visible. Local styles inside protected trees remain approximate. No model or
export API change is needed, and unchanged JSON retains its original bytes.

Respect `maxDepth` while walking visible descendants. Render fallback text using
the existing text-node path, never HTML. Add a localized `protected-preview`
layout warning for every opaque node so a saved document still advertises the
limitation after import. Existing cross-format loss diagnostics remain binding.

Priorities and dependencies:

| Input                                         | This change                                          | Required for richer display                        |
| --------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Literal text with actions or unknown metadata | Plain literal text and `extra`; actions remain inert | Separate supported style semantics                 |
| Translation, including fallback/with          | Unresolved marker                                    | Explicit language catalog and formatting semantics |
| Keybind                                       | Unresolved marker                                    | Client key mapping and language                    |
| Score, selector, NBT                          | Unresolved marker                                    | Authorized host resolution and game context        |
| Custom font or object/sprite                  | Protected approximation                              | Authorized assets and matching metrics             |
| Unknown MiniMessage                           | Existing protected fallback                          | Concrete tag-specific semantics                    |

Universal, offline operation, raw subtree preservation and inert actions are
required. This is a bounded improvement, not native certification of arbitrary
components. Sources: [Adventure components](https://docs.papermc.io/adventure/text/)
and [JSON serialization](https://docs.papermc.io/adventure/serializer/json/).
