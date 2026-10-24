# Native Italic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Match native italic ink while preserving editable text.
**Architecture:** Reproducible OFL glyph cells and shared locally generated PNG
ink in CSS pseudo-elements; keep existing DOM text and ProseMirror semantics.
**Tech Stack:** TypeScript, CSS, fontkit, Vitest, Playwright.
**Spec:** ../specs/2026-10-24-native-italic-design.md

## Global Constraints

- One English PR for #68; no merge, release or Portal deployment.
- No Mojang assets; retain OFL provenance and license in the package.
- Custom font families and unsupported glyphs retain fallback behavior.
- Preserve source, selection, composition, atomic tokens and history.

## Review Focus

- Italic overhang must not change advances or clip ordinary mixed styles.
- Bold, decoration, gradient and rainbow combinations must share both hosts.
- Custom profile and asset-provider fonts must not inherit bundled silhouettes.
- Context updates and obfuscation must refresh displayed glyphs.
- Composition, clipboard and undo must operate on actual source text.

### Task 1: Native italic rendering

**Files:** tools/build-pixel-font.mjs, src/dom/font/, src/dom/render.ts,
src/dom/styles.css, src/dom/editor/effects.ts, src/dom/editor/controller.ts,
src/dom/animation.ts, tests/browser/native-font-reference.spec.ts.

- [x] Add native italic foreground/shadow comparisons and observe failure.
- [x] Generate reproducible licensed glyph cells; paint native shear silhouettes.
- [x] Integrate viewer, inline text, atomic values and obfuscation.
- [x] Verify native masks in all engines and Windows metrics.

### Task 2: Editing, compatibility and package verification

**Files:** tests/browser/native-italic.spec.ts, tests/tooling/,
docs/profiles.md, docs/limitations.md, tools/reference/README.md.

- [x] Add and run failing regressions for combined styles, tokens, custom fonts,
      selection, clipboard, composition, undo and context changes.
- [x] Fix failures without rewriting semantic source or transaction history.
- [x] Document verified scope; run quality, unit, browser and packed-consumer checks.
- [x] Obtain one fresh correctness review and resolve important findings with
      failing regressions and a green suite.
- [ ] Create an English PR, verify final CI and leave it open for the user.
