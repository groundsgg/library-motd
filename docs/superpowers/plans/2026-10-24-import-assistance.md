# Opt-in Import Assistance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Review gradient/alignment proposals and explicitly accept one undoable change.
**Architecture:** Pure conservative proposals; instance-local overlay with detached
before/after previews and source views, baseline validation and existing history.
**Tech Stack:** TypeScript, DOM/React adapters, Vitest, Playwright.
**Spec:** ../specs/2026-10-24-import-assistance-design.md

## Global Constraints

- No automatic fidelity reduction, whitespace removal or network request.
- Preserve protected subtrees/placeholders, source on rejection, and permissions.
- Analysis bounded to 2048 graphemes/field; color tolerance0–255,
  position0–4GUIpixels, both default0; skip unsupported alignment layouts.
- Reuse the editor overlay/history and per-instance English/German localization.
- One PR for #15; no merge/release/Portal deployment.

## Review Focus

- Stale proposals must not overwrite external document/context/permission updates.
- Placeholder/protected source and existing effects must never become literal text.
- Padding recognition must compare actual glyph positions and retain trailing spaces.
- Multiple/iframe instances must own their controls and release preview lifetimes.
- Limits and unknown/custom fonts must not cause crashes or misleading exactness.

### Task 1: Conservative pure proposals

**Files:** src/core/text/simplify.ts, src/core/text/import-assistance.ts,
src/index.ts, tests/unit/import-assistance.test.ts, tests/unit/simplify.test.ts.
**Interface:** suggestImportAssistance(document, {profile,width,colorTolerance?,positionTolerance?})
returns ImportAssistanceProposal[] as specified; existing simplification API stays compatible.

- [x] Add RED tests for exact gradient simplification, placeholder protection,
      color-tolerance bounds, long-input skips, alignment center/right two-line
      padding, bold advances, trailing spaces, effects/protected/wrapping exclusions.
- [x] Implement proposal generation and source-preserving no-op paths.
- [x] Run all units/types and commit the pure contract.

### Task 2: Review/apply editor workflow

**Files:** src/dom/editor/import-assistance.ts, src/dom/editor/index.ts,
src/locales/en.ts, src/locales/de.ts, src/dom/styles.css,
tests/browser/import-assistance.spec.ts.
**Interface:** mountImportAssistance(mount:ToolMount):ToolHandle uses existing
entry-menu contributions, overlay controller, createPreview and replace-document.

- [ ] Add failing browser cases for opt-in behavior, before/after/source/metrics,
      Apply+one-step Undo, Cancel, permissions/staleness, language, iframe ownership.
- [ ] Implement conservative dialog with per-proposal selection and input bounds;
      retain controls on language changes and destroy all preview instances.
- [ ] Run all engines and existing transfer/status/text regressions; commit.

### Task 3: Documentation, final review and PR

**Files:** docs/import-assistance.md, docs/api.md, README.md, package.json,
.github/workflows/ci.yml.

- [ ] Document public API, units and conservative omissions; include docs in package.
- [ ] Full quality/unit/browser/package/example checks and Windows cases.
- [ ] One fresh whole-feature review; Important fixes RED→GREEN plus suite.
- [ ] Create English PR for #15, verify CI, leave open.
