# Protected Array Inheritance Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct protected-first JSON component-array display and roundtrip semantics for #23.

**Architecture:** Preserve dependent arrays using the existing opaque node. Reuse the existing bounded inert style projection; do not expand the persisted schema.

**Tech Stack:** TypeScript, Vitest, existing DOM/React Playwright fixtures.

**Spec:** `docs/superpowers/specs/2026-10-27-protected-array-inheritance.md`

## Global Constraints

- Preserve raw arrays and unknown inherited metadata without executing actions.
- Surrounding components remain editable; dependent entries remain one source-editable atom.
- Keep parsing depth limits, bounded display projection and linear reads of nested first children.
- No new public API, dependency, package publication or Portal deployment.

## Review Focus

- Explicit false decorations override the first component only locally.
- Nested protected arrays retain their outer array shape and inheritance.
- Source edits, persistence and undo never flatten or drop inherited metadata.
- A protected later entry must not swallow unrelated editable siblings.
- Deep protected-first arrays do not reintroduce repeated child traversal.

### Task 1: Preserve and display dependent arrays

**Files:** `src/core/text/json.ts`, `tests/unit/json-protected-array.test.ts`, `tests/unit/json-array-work.test.ts`, `tests/browser/protected-preview.spec.ts`, `docs/limitations.md`, `docs/formats.md`.

**Interfaces:** Existing `parseJsonText(value: JsonValue, maxDepth?: number): TextDocument`; existing opaque `raw` and `fallback`; no public interface change.

- [ ] Write failing regressions for the native A/B/C colors/decorations, raw-preserving adjacent export and persistence, nested arrays, inherited outer styles, protected later entries, depth rejection and bounded nested-array reads. Verify failures against unmodified parsing.
- [ ] When an array's first parsed node is opaque, retain the complete dependent array as one opaque atom. Reuse the first atom's raw/fallback and process only remaining entries to construct the enclosing raw/fallback.
- [ ] Run focused and full unit tests; verify expected literal styles, source boundaries and original JSON preservation.
- [ ] Extend the actual viewer/editor browser fixture to verify array styles, one inert atom, surrounding edit/undo and saved-document rendering across Chromium/Firefox/WebKit.
- [ ] Document source-editing and old persisted-boundary limitations. Run unit, types, lint, format, build, packed consumers, examples and relevant browser checks.
- [ ] Commit with a Conventional Commit, obtain independent whole-branch review, open a separate PR for #23 and merge only after current-head checks pass. Keep contextual/native/manual verification items open.
