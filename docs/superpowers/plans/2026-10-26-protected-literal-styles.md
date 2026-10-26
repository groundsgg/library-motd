# Protected Literal Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display known JSON literal styles inside protected atoms without changing their source or export semantics.

**Architecture:** A private projection strips unsupported metadata, reuses parseJsonText, and maps derived styles onto canonical opaque glyphs. Only layout and editor display use it. Weak identity caching avoids repeated parsing while respecting source mutations.

**Tech Stack:** TypeScript, existing JSON parser and glyph layout, Vitest, DOM/React Playwright suites.

**Spec:** `docs/superpowers/specs/2026-10-26-protected-literal-styles.md`

## Global Constraints

- No public schema/API, canonical flattenText or atomic source boundary changes.
- Ordinary serialization/reduction is unchanged; explicit layout materialization uses corrected metrics and retains protected-break guards.
- Only literal text, extra, arrays, valid named/RGB colors and boolean decorations participate.
- Limit projection to 65,536 raw characters, depth 128 and 32,768 visited values.
- Apply styles only when original text, grapheme boundaries and offsets agree exactly.
- Keep protected approximation diagnostics; unknown dynamic components remain unresolved.
- No HTML/action interpretation, resource fetching or persisted preview data.
- Keep release #67 open and preserve the running preview.

## Review Focus

- Explicit false and component-array style inheritance must match the existing JSON parser.
- Custom fallback or changed raw values must not receive stale cached styles.
- Malformed/deep/oversized raw values fail closed without a new layout exception.
- Combining marks/surrogate boundaries must not change atomic offsets or editor geometry.
- Display-only styles must never alter same-format raw export, lossy reduction or undo.

### Task 1: Add the private projection and renderer integration

**Files:** Create `src/core/text/display.ts`, `tests/unit/protected-style-preview.test.ts`. Modify `src/core/layout/layout.ts`, `src/dom/editor/effects.ts`, `tests/browser/protected-preview.spec.ts`, `docs/browser-verification.md`, `docs/limitations.md`.

**Interfaces:** Internal `flattenDisplayText(document: TextDocument): StyledChar[]` preserves canonical glyph text/IDs/offsets/opaque owners and changes only display styles/colors. It is not re-exported by src/index.ts. The cached projector reuses parseJsonText after stripping unsupported fields and validating limits.

- [ ] Write failing unit cases for styled action-bearing literals, nested false/array inheritance, inherited outer styles, unchanged canonical/export output, cache mutations, unknown dynamic siblings, malformed/bounded/mismatched input and split graphemes. Observe the gray-style RED before implementation.
- [ ] Implement the private projection and route layout/editor display through it. Keep canonical flattenText and serialized nodes untouched.
- [ ] Run focused unit tests; verify exact source mapping and source snapshots remain unchanged after rendering.
- [ ] Extend the real DOM editor/viewer fixture with styled protected literals and verify matching colors/metrics, inert actions, one atom and raw-preserving neighbor edit/undo/persistence.
- [ ] Run unit, lint/type/format/build/SSR, focused browser tests across three engines, packed consumer checks and examples. Obtain independent review before merge.
- [ ] Rebase onto integrated #90 diagnostics if necessary, open a separate Conventional Commit PR referencing #23, inspect Linux/Windows CI and merge green. Keep context-dependent unresolved cases documented separately.
