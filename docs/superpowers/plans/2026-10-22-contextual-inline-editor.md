# Contextual Inline Server-List Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every existing server-entry feature reachable through direct editing or contextual tools, with a separate viewer and configurable fixed or selection toolbar, then adopt it in the Portal.

**Architecture:** Preserve the schema-1 document and public preview/editor APIs. Extract a persistent shared entry renderer and editor controller, then attach instance-owned toolbars, popovers, and modal draft tools. The Portal consumes the published library and owns only its application settings and persistence.

**Tech Stack:** TypeScript, DOM, ProseMirror, optional React; existing Vitest and Playwright Chromium/Firefox/WebKit suites. Library Node minimum remains `22.14.0`; Portal uses its existing Node 24 toolchain and Next.js integration.

**Spec:** [Approved design](../specs/2026-10-22-contextual-inline-editor-design.md).

## Global Constraints

- Keep `createPreview` / `ServerListPreview` as the viewer APIs and `createEditor` / `ServerListEditor` as the editor APIs.
- Add `toolbar?: "fixed" | "selection"`; omitting it selects `fixed`.
- Keep `ServerListDocument` schema version 1, existing commands, `EditorChange`, `mapChange`, feature flags, labels, `readOnly`, and `disabled`.
- Updated examples and Portal choose `row` explicitly; existing callers that omit presentation keep their current full-list default.
- Toolbar placement, open tools, selected text, and dialog drafts are transient UI state.
- Original Mojang assets are not added to the package; retain the existing explicit host asset provider.
- Track independently reviewable implementation slices as English GitHub issues and use a separate PR for each feature or fix, with conventional branches and commits.
- No backend API, persistence, runtime-template, Forge, or proxy changes are required for this interface redesign.
- Any eventual Portal publication uses the desired commit's Cloudflare Worker version and direct Live activation, preserving bindings, secrets, and environment flags. It does not create a Portal release or tag.

## Review Focus

1. Controlled acknowledgements, context changes, or toolbar switches during selection/composition must not reset an input view or apply formatting to a different field; test in Tasks 1 and 2.
2. Automatic version mode, hidden players, incompatible clients, and inherited/disabled hover must keep their enabled editing actions reachable without showing fictional client content; test in Task 3.
3. Scaled previews inside a scrolled container or an iframe must keep tools positioned within the owning viewport, including keyboard-only and touch input; test in Task 2.
4. A stale image decode or server import resolving after cancellation, permission changes, document replacement, or destruction must never overwrite the active document; test in Tasks 4 and 5.
5. Portal preview changes must not save example values or erase application extension metadata, and locked actions must remain locked through every new entry point; test in Task 6 and the library boundary suites.

## Execution and review boundaries

The approved spec lives on `docs/contextual-inline-editor`, commit `5ecaff8`, in the isolated checkout `/home/lukas/grounds/.worktrees/library-motd-inline-editor-design`. The shared checkout `/home/lukas/grounds/library-motd` is used by other work: do not change its branch, index, or files. At execution, inspect attached worktrees, fetch current main, and reuse or create an isolated implementation checkout as appropriate. Do the same for Portal; its old `feat/server-list-editor` checkout is reference material, not an up-to-date implementation base.

Create one English GitHub issue for each task below, cross-reference dependencies, and record the returned issue numbers in the implementation tracking copy. For each task, substitute its actual issue number into the stated branch name and put `Closes #<number>` in its PR. Start dependent work from merged prerequisites; if prerequisites await merge, explicitly stack the next PR on its predecessor and retarget after merge. Do not merge PRs or activate a Worker merely to advance this plan.

Before code, read the approved spec and relevant current tests. Use the existing locked dependencies; no new editor engine or UI framework is planned. Install with `npm ci` in the implementation checkout if dependencies are missing. Run focused tests after the corresponding change, then run the complete existing checks on each PR's final head. A browser installation failure is an environment blocker, not a passing test or product regression.

## File and interface map

| File                                                                   | Responsibility                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/dom/entry.ts` (new)                                               | Shared persistent scene and field anchors, used by both preview and editor.                      |
| `src/dom/preview.ts`                                                   | Public viewer adapter and existing rendering helper compatibility exports.                       |
| `src/dom/editor/types.ts` (new)                                        | Existing editor public types, re-exported through their current entry points.                    |
| `src/dom/editor/controller.ts` (new)                                   | Document commits, commands, history, active field, persistent text views, update classification. |
| `src/dom/editor/index.ts`                                              | Public editor lifecycle and composition of the scene and enabled tools.                          |
| `src/dom/editor/overlays.ts` (new)                                     | Instance-owned popover/dialog positioning, responsive sheet behavior, focus, and disposal.       |
| `src/dom/editor/toolbar.ts`, `text-tools.ts` (new)                     | Both toolbar placements and rich-text contextual tools against saved selections.                 |
| `src/dom/editor/status-tools.ts` (new)                                 | Player rules, version modes, pinned rich-text player hover, and hidden-field access.             |
| `src/dom/editor/icon-tool.ts` (new)                                    | Upload/drop affordance and a cancellable local crop draft.                                       |
| `src/dom/editor/transfer-tools.ts` (new)                               | Source drafts, bounded adapter imports, and read-only format export.                             |
| `src/dom/properties.ts`, `properties.css`                              | Transitional properties controls, removed only as their replacements become available.           |
| `src/dom/styles.css`                                                   | Shared client styles plus scoped editor chrome; no global Portal selectors.                      |
| `src/react/index.tsx`                                                  | Thin unchanged lifecycle pattern and the additive toolbar option.                                |
| `examples/dom/`, `examples/react/`, `docs/api.md`, `docs/embedding.md` | Independent viewer/editor usage and both toolbar modes.                                          |

These internal contracts connect tasks; none is added to the public package exports:

```ts
type FieldSelection = {
  field: EditableField;
  from: number;
  to: number;
  generation: number;
};
type EditorEvent =
  "document" | "options" | "selection" | "composition" | "replace";

interface EntryHandle extends PreviewHandle {
  getAnchors(): {
    icon: HTMLElement;
    motd: HTMLElement;
    status: HTMLElement;
    ping: HTMLElement;
    playerHover: HTMLElement;
  };
  bindText(field: EditableField, content: HTMLElement | null): void;
}
function createEntry(host: HTMLElement, options: PreviewOptions): EntryHandle;

interface EditorController extends EditorHandle {
  getOptions(): EditorOptions;
  getGeneration(): number;
  getActiveField(): EditableField;
  getView(field: EditableField): EditorView | undefined;
  mountText(field: EditableField, host: HTMLElement): void;
  captureSelection(): FieldSelection | null;
  restoreSelection(selection: FieldSelection): boolean;
  insertPlaceholder(name: string, selection: FieldSelection): void;
  subscribe(listener: (event: EditorEvent) => void): () => void;
}
function createEditorController(options: EditorOptions): EditorController;

type OverlayClose = "dismiss" | "cancel" | "apply" | "replace" | "destroy";
interface OverlayController {
  open(options: {
    id: string;
    label: string;
    anchor: HTMLElement;
    content: HTMLElement;
    mode: "popover" | "dialog";
    onClose?: (reason: OverlayClose) => void;
  }): void;
  getOpenId(): string | null;
  close(reason: OverlayClose): void;
  destroy(): void;
}
function createOverlays(root: HTMLElement): OverlayController;

type ToolMount = {
  root: HTMLElement;
  entry: EntryHandle;
  controller: EditorController;
  overlays: OverlayController;
};
type ToolHandle = { update(): void; destroy(): void };
function mountToolbar(options: ToolMount): ToolHandle;
function mountTextTools(options: ToolMount): ToolHandle;
function mountStatusTools(options: ToolMount): ToolHandle;
function mountIconTool(options: ToolMount): ToolHandle;
function mountTransferTools(options: ToolMount): ToolHandle;
```

`EntryHandle.bindText` overrides only text rendering, never status evaluation or geometry. The entry retains bound hosts across updates; dormant version/hover hosts remain available to their editing tool without making them visible in the real scene. Reparenting a bound view is deferred while it is composing. The controller maps saved selections through its own document transactions; external replacement advances `generation` and invalidates saved selections and drafts. A tool must refuse a stale selection rather than clamp it into unrelated text.

### Task 1: Preserve entry mounts and editor state across presentation updates

**Issue / PR:** Stable shared server-entry rendering and editor lifecycle. Branch `refactor/<issue-number>-stable-server-entry`; commit `refactor: preserve shared server-entry and editor state`.

**Files:** Create `src/dom/entry.ts`, `src/dom/editor/types.ts`, `src/dom/editor/controller.ts`, `tests/browser/editor-lifecycle.spec.ts`. Modify `src/dom/preview.ts`, `src/dom/editor/index.ts`, `src/dom/editor/schema.ts`, `tests/browser/host.html`, and `tests/browser/client-reference.spec.ts`.

**Interfaces:** Produce `createEntry`, `EntryHandle`, `createEditorController`, `EditorController`, `FieldSelection`, and `EditorEvent` from the map above. Keep public type exports and every existing `EditorHandle` method unchanged. Leave existing toolbar and properties controls available in this PR.

- [ ] Add a test-fixture `window.setEditorOptions(patch)` in `tests/browser/host.html` that merges options with the latest `window.doc`, keeps the existing `onChange`, and calls `window.editor.update`. Write failing lifecycle tests for context/label updates, controlled acknowledgement, multiple editors, preserved undo/selection, and external baseline replacement. Include these assertions after changing only context or labels:

  ```ts
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
  expect(
    await page.evaluate(
      () =>
        window.originalInput ===
        document.querySelector("#editor [data-editor-field=motd] .ProseMirror"),
    ),
  ).toBe(true);
  ```

- [ ] Run `npm run test:browser -- tests/browser/editor-lifecycle.spec.ts --project=chromium`; confirm the failures exercise destroyed/replaced input state rather than missing fixture setup.
- [ ] Implement the two private factories. Extract the current rendering/evaluation and commit/history code without changing schema or parser behavior. Snapshot supplied context/options rather than retaining mutable aliases; recognize in-place host context updates and asset-provider function identity changes. Keep public `renderText` and `applyTextStyle` imports working. Make `destroy()` release listeners, animation work, views, and subscriptions once.
- [ ] Add viewer/editor geometry assertions for the same document/context and existing independent client fixtures. Exercise update during synthetic composition and external replacement after typing; document that this does not verify a real OS IME. Run lifecycle, editor, React, inline-effects, boundaries, comparison, and client-reference browser specs in all three engines, then `npm run build && npm test && npm run test:node`. Require unchanged existing reference geometry and source-fidelity assertions.
- [ ] Inspect the diff, update `docs/api.md` with lifecycle guarantees, run `npm run lint && npm run format:check`, and open the task PR with the exact checks performed. Do not claim the UI redesign is complete.

### Task 2: Add configurable toolbars and contextual rich-text tools

**Issue / PR:** Configurable inline formatting tools. Branch `feat/<issue-number>-contextual-text-tools`; commit `feat: add configurable contextual text tools`. Depends on Task 1.

**Files:** Create `src/dom/editor/overlays.ts`, `toolbar.ts`, `text-tools.ts`, `tests/browser/editor-tools.spec.ts`. Modify `src/dom/editor/types.ts`, `controller.ts`, `index.ts`, `src/dom/index.ts`, `src/dom/styles.css`, `src/dom/properties.ts`, `src/dom/properties.css`, both example entry points and HTML where needed, `examples/shared/page.css`, `tests/browser/react-host.tsx`, `tests/package/react-ssr.test.mjs`, `docs/api.md`, and `docs/embedding.md`.

**Interfaces:** Add the public `EditorOptions.toolbar?: "fixed" | "selection"`. Produce `OverlayController`, `createOverlays`, `ToolMount`, `ToolHandle`, `mountToolbar`, and `mountTextTools`. Consume the controller's stable selection and placeholder insertion methods; placeholder insertion uses the existing atomic `token` node and creates no public command variant.

- [ ] Write failing tests named `defaults_to_fixed_toolbar`, `selection_toolbar_follows_keyboard_selection`, `switching_toolbar_preserves_selection_and_undo`, `popover_formats_original_field`, `tools_fit_scaled_scrolled_and_iframe_previews`, and `touch_sheet_keeps_keyboard_access`. Select a known word, open a gradient/color tool, apply formatting, and assert only that word changes. Assert UI-only switching produces no `onChange`, and `Alt+F10` plus the visible Text tools action reach the same toolbar at a collapsed caret.
- [ ] Run `npm run test:browser -- tests/browser/editor-tools.spec.ts --project=chromium`; expect missing toolbar placement/overlay behavior, with the Task 1 lifecycle tests still passing.
- [ ] Implement the overlay and text-tool factories. Use the root's `ownerDocument`/`defaultView`, keep coordinates outside the scaled game scene, and reposition on relevant scroll/resize. Below `640px` available viewport width, contextual popovers use a modal bottom sheet; retain content and saved selection when that presentation changes. Use labeled controls, keyboard toolbar navigation, focus return, per-instance disposal, one primary overlay, and the spec's Escape/Apply rules.
- [ ] Implement both placements with identical commands, selection formatting, active-line alignment, all existing decorations, colors, multistop gradients, supported rainbow controls, and placeholder insertion. A placeholder picker lists supplied context keys plus `players`/`max` and permits an explicitly typed name; unresolved values retain existing diagnostics. Remove only migrated formatting/layout controls from `mountProperties`. Demonstrate standalone viewer and editor with explicit row context and a toolbar selector in both DOM and React examples; retain an explicit full-client presentation option.
- [ ] Run the tool tests plus lifecycle, inline-effects, source/protected-content, boundary, and React tests in all engines. Add SSR coverage for both toolbar props and the existing viewer; run `npm run build && npm run test:node && npm run build:examples && npm run lint && npm run format:check`. Open the PR with keyboard and narrow-layout evidence; retain genuine OS IME/manual assistive checks as separate work.

### Task 3: Edit player rules, version rules, and player hover in context

**Issue / PR:** Contextual server-status editing. Branch `feat/<issue-number>-contextual-server-status`; commit `feat: edit server status and player hover in context`. Depends on Task 2.

**Files:** Create `src/dom/editor/status-tools.ts`, `tests/browser/status-tools.spec.ts`. Modify `src/dom/editor/index.ts`, `controller.ts`, `src/dom/entry.ts`, `src/dom/tooltips.ts`, `src/dom/styles.css`, `src/dom/properties.ts`, `tests/browser/properties.spec.ts`, `tests/browser/final-review.spec.ts`, `tools/verify-package.mjs`, and `docs/embedding.md`.

**Interfaces:** Produce `mountStatusTools(options: ToolMount): ToolHandle`; consume stable `status`, `ping`, and `playerHover` anchors, current document rules, and the shared rich-text controller. Public version, player, and hover rule types remain unchanged.

- [ ] Write failing tests for every current count mode, maximum headroom, player hiding, all version modes, custom hover editing/formatting, and fallback entry actions. Pin a custom tooltip, type more than two lines, and assert all source lines remain editable; only the MOTD has the two-visible-line layout constraint. Assert these persisted values for base `42/500` and ten places of headroom:

  ```ts
  expect(
    await page.evaluate(
      () =>
        window.api.evaluateStatus(window.doc, window.context).value.players.max,
    ),
  ).toBe(52);
  expect(await page.evaluate(() => window.doc.players.maximum)).toEqual({
    mode: "headroom",
    value: 10,
  });
  ```

- [ ] Run `npm run test:browser -- tests/browser/status-tools.spec.ts --project=chromium`; expect missing entry actions/pinned edit surfaces. Keep the existing status evaluator unit tests as the calculation reference.
- [ ] Implement count/version popovers and an accessible entry-tools menu. Keep hidden/automatic/incompatible fields reachable, require an explicit mode change before editing inactive custom text, and explain unavailable fields. Pin player hover as a proper editing surface rather than a passive `role=tooltip` containing focusable input. Respect native count/version exclusivity; never expose native incompatibility tooltip text as custom data.
- [ ] Route each edit through existing commands/history and apply feature/permission gating on every direct/fallback action. Keep the pinned field alive during toolbar operations and responsive updates, and close or invalidate it on external replacement. Remove only migrated status controls and the detached legacy hover editor. Adapt old property/final-review tests and the installed-package probe in `tools/verify-package.mjs` to open the contextual controls while preserving their original behavioral assertions.
- [ ] Run status-tools, properties, preview, boundaries, React, source, and inline-effects browser specs in all engines plus `npm test`, `npm run lint`, and `npm run format:check`. Include two independent editors, inherited/disabled hover, compatible/incompatible contexts, undo across fields, and read-only/disabled transitions. Open the task PR.

### Task 4: Make icon upload and cropping a cancellable inline tool

**Issue / PR:** Contextual server-icon upload and crop. Branch `feat/<issue-number>-inline-icon-dialog`; commit `feat: add contextual server-icon crop dialog`. Depends on Task 2; integrate with current merged status work before publishing.

**Files:** Create `src/dom/editor/icon-tool.ts`, `tests/browser/icon-tool.spec.ts`. Modify `src/dom/editor/index.ts`, `src/dom/styles.css`, `src/dom/properties.ts`, `tests/browser/properties.spec.ts`, `tests/browser/server-list-frame.spec.ts`, and `docs/embedding.md`. Reuse `src/dom/icon.ts` and existing alpha fixtures.

**Interfaces:** Produce `mountIconTool(options: ToolMount): ToolHandle`. Use existing `normalizeIcon(file: Blob, options?)` and `set-field` for `icon`; do not change `IconValue` or the document schema.

- [ ] Write failing tests for hover/focus upload discovery, keyboard activation, file drop, local crop preview, Apply/Cancel, reset, invalid images, and alpha. Before Apply and after Cancel, assert `window.doc.icon` is unchanged and no change event was emitted; after Apply, decode the stored PNG and assert `[64, 64]`. Verify one undo restores the complete previous icon.
- [ ] Run `npm run test:browser -- tests/browser/icon-tool.spec.ts --project=chromium`; expect missing draft/Cancel behavior rather than failures in the existing normalizer.
- [ ] Implement the local crop draft and existing pixel-style upload affordance at the real icon anchor. Preserve PNG alpha; keep existing PNG/JPEG input limits and diagnostics. Use explicit Apply/Cancel, abort or invalidate image work on newer uploads/external replacement/destroy, and gate both file-dialog and drop entry points while read-only, disabled, or feature-disabled. Release object URLs and image resources on every exit path.
- [ ] Add controlled delayed-decode cases: replace the document, revoke edit access, and destroy the instance before decode resolves. Assert no late icon commit, overlay, or change event. Adapt existing upload/reference tests to explicitly apply their crop draft. Remove the corresponding legacy icon form only when all replacement actions exist.
- [ ] Run icon-tool, properties, boundaries, assets, and client-reference browser specs in all engines; retain alpha-exact assertions and the already documented engine-specific RGB tolerance. Run unit icon tests, lint, and formatting, then open the task PR.

### Task 5: Move source, import, and export into focused tools

**Issue / PR:** Source and transfer dialogs for the inline editor. Branch `feat/<issue-number>-editor-transfer-dialogs`; commit `feat: add focused source and transfer dialogs`. Depends on Tasks 3 and 4 for removal of the remaining legacy properties panel.

**Files:** Create `src/dom/editor/transfer-tools.ts`, `tests/browser/transfer-tools.spec.ts`. Modify `src/dom/editor/index.ts`, `controller.ts`, `src/dom/styles.css`, `tools/build-assets.mjs`, `tests/browser/source.spec.ts`, `tests/browser/import.spec.ts`, `tests/browser/editor.spec.ts`, `tests/browser/final-review.spec.ts`, `tests/browser/boundaries.spec.ts`, `docs/api.md`, and `docs/embedding.md`. Remove `src/dom/properties.ts` and `properties.css` only after all migrated tests pass and their imports are removed.

**Interfaces:** Produce `mountTransferTools(options: ToolMount): ToolHandle`. Keep the current `ImportAdapter(address, signal): Promise<JavaStatus>`, optional `imports.timeoutMs`, source formats, command variants, and export serializers. Source Apply reports origin `source`; import Apply reports origin `import` and only enabled changed fields.

- [ ] Write failing tests for staged source edits, format changes, invalid source, Apply/Cancel, and export without mutation. Assert a valid draft emits zero changes until Apply, then one logical change; Undo restores the previous complete document. Preserve unknown/protected source constructs and reject unsupported format conversion without an explicit permitted reduction.
- [ ] Run `npm run test:browser -- tests/browser/transfer-tools.spec.ts --project=chromium`; expect missing draft boundaries and transfer dialog controls. Update existing tests' navigation to the tools, not their expected data semantics.
- [ ] Implement source drafts for enabled MOTD/version/custom-hover fields using existing parsers/serializers. Keep invalid drafts visible, preserve the committed document, and allow Cancel even when source is invalid. If the host replaces the document, show a draft-invalidated status, disable Apply, and provide Close. Export stays read-only; copied output must be successful serializer output, never a diagnostic string.
- [ ] Implement explicit adapter import as a staged result with Apply/Cancel. Preserve current timeout/default `10000ms`, request cancellation, stale-result guards, full-document validation, feature filtering, and no unsolicited requests. Show a nonempty adapter error without committing data. Cancel, replacement, permissions change, newer requests, and destruction must discard late responses. Remove the persistent source tabs/long properties form after every enabled feature is reachable via contextual tools or the entry menu. Update `tools/build-assets.mjs` to package the replacement CSS without reading the removed properties stylesheet.
- [ ] Run transfer-tools, source, import, editor, properties, boundaries, final-review, and React browser tests in all engines. Complete the library PR checks below on the final head; open this task's PR with independent demo evidence for both toolbar modes and the display-only viewer.

### Task 6: Adopt the compact contextual editor in Grounds Portal

**Issue / PR:** Adopt the contextual MOTD editor in Portal. Branch `feat/<issue-number>-contextual-motd-editor`; commit `feat: adopt contextual MOTD editing`. Repository `groundsgg/grounds-portal`; depends on the library tasks being merged and their package being published by the existing release workflow.

**Files:** Modify Portal `package.json`, `package-lock.json`, `src/components/network/network-server-list-editor.tsx`, `network-server-list-editor.test.tsx`, and `network-maintenance-page.test.tsx`. Add `src/components/network/network-server-list-preview-settings.tsx` for the compact host-owned preview settings control. Change parent page code only if necessary to preserve its existing adapter contract.

**Interfaces:** Keep `NetworkServerListEditor`'s document, context settings, `mapChange`, asset provider, and callbacks. Add an optional `toolbar?: "fixed" | "selection"` prop forwarded to the library, defaulting to `fixed`. Continue to render `ServerListPreview` for `preview=true`; do not turn the viewer into a read-only editor.

- [ ] Before writing Portal code, read its applicable `AGENTS.md` and relevant installed Next.js guides. Verify the actual published npm version contains the accepted library APIs and pin that exact version in both package files. Do not invent a version or consume an unpublished branch build in production.
- [ ] Write failing Portal tests for explicit row context, both toolbar props, viewer without editing controls, grouped preview settings, persistence-neutral client/region/example changes, read-only protection, and application `mapChange` metadata. Keep existing maintenance/save/conflict tests, and assert preview-only interactions call the save callback zero times.
- [ ] Run `npm test -- src/components/network/network-server-list-editor.test.tsx src/components/network/network-maintenance-page.test.tsx`; confirm failures identify missing contextual adoption rather than an unavailable dependency. Use mocks only for API transport or isolated wrapper-option assertions; keep integration coverage of actual editor behavior.
- [ ] Implement the compact settings component using the Portal's existing UI conventions and labels. Forward `toolbar`, use explicit row presentation for both viewer/editor, preserve feature permissions and `mapChange`, and keep example counts accurately labeled. No new live-data request, Forge change, proxy-local player assumption, or persisted preview state is introduced.
- [ ] Run the focused tests, `npm run lint`, and `npm run cf:build` with the repository's documented build environment. Review viewer/editor and both toolbar placements at desktop and narrow widths; check icon alpha and hidden-field access. Open the Portal PR with the exact pinned package version and checks. Deployment, if subsequently requested, follows the existing Cloudflare build/version flow and direct Live activation; no Portal release workflow or tag.

## Final PR checks and completion evidence

For each final library PR head, run `npm run build`, `npm run typecheck`, `npm test`, `npm run test:node`, `npm run test:release`, `npm run lint`, `npm run format:check`, `npm run build:examples`, `npm run test:package`, and `npm run test:browser`. Existing CI remains authoritative for its Node matrix and all three browser engines; record failures or missing engines honestly. Avoid repeatedly rerunning passing broad suites without another relevant change.

Record the real commands/results in each PR, attach every created PR to this chat, and retain Conventional Commit titles suitable for squash merge. Do not close an issue until its PR is merged. Package publishing follows existing release-please/npm/GitHub Packages workflows; the plan does not replace their security or release configuration.

The delivery is complete when both library adapters and Portal expose all approved tools, both toolbar modes pass the same interaction checks, the viewer has no editing chrome, all relevant existing references still pass, and the separately reviewed PRs are available. A production deployment is reported separately only after an actual Worker activation is verified.

## Plan self-review

- Every approved spec section maps to Tasks 1–6: stable viewer/rendering and state (1), toolbar/overlays/text tools (2), hidden-field and status editing (3), icon drafts (4), transfer drafts and form removal (5), independent examples (2) and Portal adoption (6).
- All five Review Focus conditions have named tests in the task that owns the behavior. Real OS IME and screen-reader results are not inferred from synthetic events.
- Internal factory names and types above are shared consistently by the task interfaces; only the optional toolbar setting and Portal forwarding prop extend public configuration.
- This document specifies future checks; no product implementation or passing product tests are claimed by the plan commit.
