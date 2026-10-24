# Deterministic Pixel Ink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make supported per-glyph bundled foreground/shadow masks independent of OS antialiasing.
**Architecture:** Generalize the verified licensed italic cell rasterizer to all
bundled glyphs; preserve native text and editor behavior underneath its paint.
**Tech Stack:** TypeScript, local Canvas PNG masks, ProseMirror, Playwright.
**Spec:** ../specs/2026-10-24-deterministic-pixel-ink-design.md

## Global Constraints

- Use existing independently licensed OFL data; no extracted Mojang fonts.
- Preserve text/advances/selection/caret/clipboard/composition/tokens/undo.
- Custom/unsupported font fallback remains; do not allocate hidden overflow masks.
- Pixel claims limited to independent captures; keep verified:false.
- Windows Java-client capture remains open in #70 due unavailable Computer Use node_repl.
- One English PR referencing #70; no merge/release/deployment.

## Review Focus

- Normal/italic cache entries must not collide when glyph/style/scale otherwise match.
- Obfuscation must refresh visual paint while retaining native advances and source.
- Invisible overflow or atom fallbacks must not create painted third lines.
- Custom fonts or unsupported outlines must not disappear behind transparent text.
- Per-glyph decoration merging must not break caret, composition, selection or undo.

### Task 1: Generalize paint and strict Windows references

**Files:** src/dom/font/italic.ts → ink.ts, src/dom/render.ts,
src/dom/editor/effects.ts, src/dom/entry.ts, src/dom/styles.css,
tests/browser/native-font-reference.spec.ts, tests/browser/pixel-ink.spec.ts.

- [x] Add strict full Windows mask assertions and normal-ink behavior tests;
      observe current antialias/missing paint path RED.
- [x] Generalize renderer/cache/classes and animated updates, retaining fallback.
- [x] Verify targeted native masks, editing, fallback and hidden overflow on3engines
      plus actual Windows Chrome; commit.

### Task 2: Complete validation and bounded evidence

**Files:** docs/profiles.md, docs/embedding.md, tools/reference/README.md,
.github/workflows/ci.yml.

- [x] Document exact captured scope and remaining Windows-client/menu-label gaps.
- [x] Full quality/unit/browser/package/examples and Windows suite.
- [x] One fresh whole-feature review; Important fixes RED→GREEN plus green suite.
- [ ] English PR referencing #70, final CI green, leave open.
