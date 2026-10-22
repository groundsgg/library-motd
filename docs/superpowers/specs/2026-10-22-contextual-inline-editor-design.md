# Contextual inline server-list viewer and editor

Status: proposed specification for review. The interaction concept was agreed in conversation on 2026-10-22; this document defines its implementation boundaries. It does not describe already shipped behavior.

## Purpose and agreed experience

Applications need both a display-only Minecraft server entry and an editor that feels like editing that same entry. The current long properties form makes the Portal integration cumbersome. The compact server-entry composition shown in the user's MOTD Studio screenshot is the visual direction; the existing client profiles remain the authority for Minecraft geometry and behavior.

The agreed design provides:

- Separate viewer and editor components sharing the same rendering and status evaluation.
- Compact row presentation in the updated examples and Portal, with full client presentation available explicitly.
- A configurable formatting toolbar: permanently above the entry or attached to text selection.
- Direct text editing and contextual controls for every existing document feature.
- Anchored popovers for settings, dialogs for larger tasks, and bottom sheets for contextual tools on narrow screens.
- Standalone DOM and optional React usage, independent of Grounds services or Portal components.

The two interactive design variants illustrate toolbar placement only. Their approximate font styling, simulated data, simplified controls, and browser formatting commands are not implementation or client-fidelity references.

## Public interfaces and compatibility

Keep `createPreview` / `ServerListPreview` as the viewer APIs and `createEditor` / `ServerListEditor` as the editor APIs. A viewer never mounts editable text, upload triggers, editor handles, or configuration panels. It retains actual client tooltip and animation behavior.

Add this optional property to `EditorOptions`, shared unchanged by the React adapter:

```ts
toolbar?: "fixed" | "selection";
```

Omitting it selects `fixed`. Both placements expose identical commands, formatting state, accessibility, and feature gating. Updating the placement on a live editor preserves its document, selection, undo history, and active field. A host may offer a preference switch and persist it independently; the library does not write preferences to storage.

Continue to use `PreviewContext.presentation: "row" | "server-list"`. Updated examples and Portal choose `row` explicitly; existing callers that omit presentation keep their current full-list default. Given the same document, context, and assets, the viewer and editor have the same Minecraft content geometry. Editor chrome surrounds or overlays the scene without consuming Minecraft text width.

Keep `ServerListDocument` schema version 1, existing commands, `EditorChange`, `mapChange`, feature flags, labels, `readOnly`, and `disabled`. Toolbar placement, open tools, selected text, and dialog drafts are transient UI state. No backend API, persistence, runtime-template, Forge, or proxy changes are required for this interface redesign.

## Editing surfaces

| Target              | Direct interaction                                                                      | Contextual or larger tools                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| MOTD                | Edit the existing text at its client position.                                          | Formatting, colors, gradients, placeholders, and per-line alignment.                                            |
| Version text        | Edit custom version text at its actual right-hand position when displayed.              | Automatic, when-incompatible, and always modes; reach hidden custom text through the version tool.              |
| Player count        | Activate the visible online/maximum area.                                               | Inherited, fixed, offset, percentage, maximum headroom, and hidden-player rules, with evaluated example values. |
| Player hover        | Pin the player tooltip for direct rich-text editing.                                    | Inherit, custom, or disabled mode; format and insert placeholders using the same text tools.                    |
| Icon                | Show an upload affordance on hover and keyboard focus; support file selection and drop. | Local upload/crop dialog, replacement, and reset using existing normalization and alpha handling.               |
| Source and transfer | Open through a compact tools menu outside the game content.                             | Source editing, import where an adapter exists, and export with explicit formats.                               |

All currently supported formatting remains available: color, bold, italic, underline, strikethrough, obfuscation, gradients, and supported rainbow operations. Compact toolbar space must not remove existing commands. Less frequent formatting can live in its labeled overflow menu.

Per-line alignment follows the active MOTD line. A gradient popover edits multiple colors and stop positions against a saved selection. Placeholders use existing protected nodes and literal preview resolution; no additional network resolver is introduced.

Custom version text and player counts share client-controlled space. Tools must explain which field is currently visible instead of drawing both as if the client did so. The hover for a native incompatibility symbol is client-generated and is not offered as editable server text.

Hidden player counts, inherited hover, automatic version mode, or an incompatible client must not make settings unreachable. A compact accessible entry-tools menu outside the scene always offers enabled fields. Editing unavailable hover/version content uses a clearly identified editing surface; the viewer continues to show the actual client result. Entering text for an inactive rule requires explicitly selecting the appropriate custom mode.

## Toolbar and overlay behavior

The fixed toolbar remains above the entry. The selection toolbar appears near a nonempty selection in the active text field, including keyboard selections. Position it within the available viewport and update it on scroll or resize without modifying the text selection. A visible text-tools action and `Alt+F10` provide keyboard access, including a collapsed caret where stored formatting and placeholder insertion are useful.

Track the active field and selection using ProseMirror positions, not DOM ranges or browser formatting commands. Toolbar focus, color pickers, popovers, and responsive transitions must not retarget a command to a different field. Opening a tool creates no history entry and emits no document change.

Only one primary tool overlay is open per editor. The selection toolbar yields to an open settings popover. A pinned editable player tooltip is a text surface and can have its formatting toolbar; passive tooltips must not obscure the active tool. Each editor owns its overlays so multiple independent editors can coexist.

Use nonmodal anchored popovers for colors, gradient stops, placeholders, alignment, player rules, and version rules. On narrow layouts, present their contents as a bottom sheet with appropriate dialog semantics. Large tools such as image cropping, source editing, and import use dialogs. Overlay placement belongs to private UI infrastructure, not a new public customization framework.

Popover changes apply immediately through existing commands and can be undone. Escape or clicking outside closes a nonmodal popover and keeps already applied changes. Modal draft tools use explicit Apply and Cancel; Escape cancels. A successful Apply validates and records one logical history transaction. Source errors or invalid crop/import data leave the committed document unchanged and keep an actionable error beside the draft.

Dialog focus stays inside the dialog; closing restores focus to its trigger or a surviving field action. Keyboard focus can move through a nonmodal popover and back to the editor. Use labeled native controls, established toolbar keyboard navigation, and real buttons rather than hover-only hit areas. Touch targets remain usable without increasing the Minecraft content scale.

## Internal responsibilities and state

Extract only the shared responsibilities needed by this change:

- A shared server-entry renderer owns client geometry, evaluated text, icon placement, tooltip anchors, and diagnostics. Private stable field mounts let the editor attach text input without duplicating the renderer.
- An editor controller owns the document, history, commands, active field, and ProseMirror views. Moving tool chrome must not recreate those views.
- Toolbar and tool modules consume the same command/controller interface. They do not mutate document nodes directly or repeat status evaluation.
- A per-instance overlay controller owns anchors, collision handling, responsive presentation, focus restoration, draft lifetime, and disposal.

Reuse the existing parser, serializer, glyph-effect decorations, player evaluation, source mapping, icon normalization, and import adapter. Introduce no second rich-text engine. A display-only consumer requires no editor initialization; core and React imports remain safe without browser globals at import time.

Acknowledging an emitted controlled document preserves selection, open-tool state, composition, and history. Switching toolbar placement, labels, or presentation must not emit document changes. Composition must finish before any text view is moved or replaced. Protected imported content retains its current source fidelity and editing boundaries.

Replacing the document externally retains the established baseline/history-reset semantics and closes document-bound tools. An external document replacement invalidates an open modal draft rather than applying it to the replacement document; explain the invalidation before dismissing or disabling its Apply action. Context-only updates recompute examples and diagnostics without saving those values into the document. Pending imports and image work must be cancelled or ignored when replaced or destroyed.

Feature flags apply to entry actions, toolbar commands, tools, imports, and imperative commands alike. Read-only and disabled editors never open mutating tools or commit draft changes. The viewer is the recommended API for display-only use. New labels use the existing label override mechanism; a complete localization overhaul remains separate.

## Portal and independent consumers

Ship the reusable behavior in the library first. DOM and React examples demonstrate both toolbar placements, the standalone viewer, compact rows, and explicit full-client presentation. No Portal dependency is added to the package.

The Portal wrapper then selects row presentation, passes its toolbar choice, and groups client/version compatibility, region, and example player inputs into a compact preview-settings control. These remain host-owned settings. Preserve the wrapper's `mapChange`, feature permissions, `readOnly`, and change callbacks.

The Portal must continue to label example player values accurately. Future live player data must be network-wide across all proxies and remains a separate integration task. Server name, ping, selected client profile, background, and example values never become saved server-status fields. Original Mojang assets are not added to the package; retain the existing explicit host asset provider.

## Verification and acceptance

1. For each toolbar placement, demonstrate typing, mouse and keyboard selection, formatting, placeholders, alignment, and undo/redo across MOTD, custom version text, and custom player hover. Preserve final per-glyph gradient/rainbow colors, protected source nodes, and supported composition behavior.
2. Verify every current player rule and hidden/inherited/custom mode is reachable through contextual tools, including states where its rendered field is absent. Validate conflicting client states without inventing editable native tooltip content.
3. Match viewer/editor row geometry for identical context using existing independent client references. Account for caret, selection, and edit hints separately; the design mockup cannot serve as the expected renderer output.
4. Verify live toolbar switching, controlled acknowledgements, external replacement, invalidated modal drafts, cancelled imports, multiple editors, and idempotent destruction. Ensure no UI-only update emits a document mutation.
5. Cover popover keyboard access, focus restoration, Escape behavior, touch operation, narrow widths, viewport collision handling, and modal Apply/Cancel in Chromium, Firefox, and WebKit. Retain the existing unit, Node/SSR, package, and browser checks. Record genuine OS IME and assistive-technology validation separately from synthetic browser events.
6. Verify icon alpha and normalization, contextual reset, rejected/cancelled files, and draft cancellation. Verify import and export preserve supported formats and report unsupported conversions without silent loss.
7. Confirm DOM/React parity, public types for the optional toolbar property, existing viewer API compatibility, both examples, and the Portal wrapper's persistence and permission tests.

The implementation is accepted when a compact entry can expose all existing enabled features through direct editing or contextual tools, the viewer remains free of edit controls, and switching toolbar placement changes only the editing UI. New animation systems, font/resource-pack support, Bedrock, live network presence, native-asset sourcing, and unrelated roadmap items remain outside this work.

## Delivery boundaries

Track independently reviewable implementation slices as English GitHub issues and use a separate PR for each feature or fix, with conventional branches and commits. Keep the library work and subsequent Portal adoption in their own repositories. This specification is a design artifact; implementation sequencing belongs in the reviewed implementation plan.

Any eventual Portal publication uses the desired commit's Cloudflare Worker version and direct Live activation, preserving bindings, secrets, and environment flags. It does not create a Portal release or tag. This specification does not itself trigger publication, deployment, or a package release.
