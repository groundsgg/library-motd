# Standalone Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all built-in labels and diagnostics localizable without Portal.
**Architecture:** Pure catalogs/formatters and structured diagnostic metadata;
private DOM bindings update text and attributes without remounting controls.
**Tech Stack:** TypeScript, DOM/React adapters, Vitest and Playwright.
**Spec:** ../specs/2026-10-24-localization-design.md

## Global Constraints

- Preserve existing partial `labels` overrides and English defaults.
- Preserve diagnostic codes, source documents, focus, selection and history.
- No external localization dependency, Portal coupling, merge or publishing.
- Keep translated strings as literal text, never HTML.

## Review Focus

- Dynamic messages must carry parameters separately from stable message keys.
- Open dialog labels must update without replacing inputs or losing drafts.
- Plain source/server text must never be interpreted as translation keys.
- Multiple instances and iframe-owned controls must remain independent.
- Unknown host diagnostics must retain their supplied fallback text.

### Task 1: Catalogs and diagnostic contracts

**Files:** src/locales/, src/core/localization.ts, src/core/model.ts,
src/core/diagnostics.ts, core diagnostic call sites, src/index.ts,
tests/unit/localization.test.ts.

- [x] Write failing tests for catalog completeness, interpolation, partial
      overrides and structured, translated diagnostics.
- [x] Implement catalogs and pure formatters; migrate built-in diagnostics while
      retaining their English messages and stable codes.
- [x] Run unit/type/package import checks and commit the coherent contract.

### Task 2: Live DOM bindings and complete UI coverage

**Files:** src/dom/localization.ts, src/dom/render.ts, src/dom/editor/,
src/dom/entry.ts, src/dom/comparison.ts,
tests/browser/localization.spec.ts.

- [x] Add failing live-language tests for open tools, parameters, diagnostics,
      literal escaping, independent instances, focus, selection and undo.
- [x] Add explicit bindings and localize every built-in visible/accessibility
      string; preserve DOM controls and pending drafts during updates.
- [x] Verify all engines and existing English UI regressions.

### Task 3: Standalone examples, documentation and PR

**Files:** examples/dom/, examples/react/, docs/localization.md,
docs/api.md, docs/embedding.md, README.md, package.json.

- [x] Demonstrate both catalogs and document keys, parameters and fallback rules.
- [x] Run full quality/unit/browser/package/example checks.
- [ ] Obtain one fresh whole-branch review, resolve important findings with
      regressions, create the English PR and verify final CI; leave it open.
