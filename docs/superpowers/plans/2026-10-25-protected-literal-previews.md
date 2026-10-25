# Protected literal previews Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Show literal descendants of protected JSON components while keeping actions inert and raw exports intact.

**Architecture:** A private depth-bounded fallback walker in the JSON parser feeds existing opaque nodes. Layout reports a localized approximation warning without changing serialization or the public model.

**Tech Stack:** TypeScript, Vitest, Playwright, existing DOM/React adapters.

**Spec:** `docs/superpowers/specs/2026-10-25-protected-literal-previews-design.md`

## Global Constraints

- Universal, offline operation; no external fetches, assets or dependencies.
- Preserve the complete raw subtree and unchanged source bytes.
- Do not execute or interpret event payloads, HTML, translations or host data.
- Respect the caller's `maxDepth`; retain explicit cross-format loss diagnostics.

## Review Focus

- Deep protected descendants must respect parsing limits.
- Event payload text must never leak into the visible fallback.
- Dynamic components must remain visibly unresolved, including between literal siblings.
- Browser text must remain literal, inert and atomic through a neighboring edit and undo.
- Saved/reloaded documents must retain warnings; English/German labels must agree.

### Task 1: Safe fallback, diagnostics and integrated verification

**Files:** Modify `src/core/text/json.ts`, `src/core/layout/layout.ts`, `src/locales/en.ts`, `src/locales/de.ts`, `docs/formats.md`; create `tests/unit/protected-preview.test.ts` and `tests/browser/protected-preview.spec.ts`.

**Interfaces:** Keep `parseText`, `TextNode` and serializers unchanged. `layoutText` adds warning code `protected-preview` with each opaque node's ID as path.

- [x] Add unit tests for literal `text` plus nested `extra`/arrays, empty roots with custom event payloads, unresolved components, literal HTML-like data, depth limits, exact roundtrip and neighboring edits.
- [x] Run the new unit file and observe missing descendant text/warnings.
- [x] Implement only the plain-text fallback walker and localized layout warning.
- [x] Run all unit tests, lint, typecheck and formatting.
- [x] Add browser coverage for viewer/editor parity, inert action/HTML data, protected atomicity, neighboring edit/undo and persisted localized warning.
- [ ] Run the browser cases in all engines and the standard CI suite.
- [ ] Commit, obtain fresh whole-branch review, create an issue-scoped PR, and merge after green current-head CI under existing authorization.
