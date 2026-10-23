# Native Java Wrapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Match measured Java line breaking in viewer, editor and layout export.
**Architecture:** Keep source graphemes in the shared layout; mark consumed space
delimiters as suppressed and reuse visual line metadata in display decorations.
**Tech Stack:** TypeScript, ProseMirror, Vitest, Playwright, native Java references.
**Spec:** ../specs/2026-10-23-native-wrapping-design.md

## Global Constraints

- No Portal dependency, release, merge or deployment.
- Preserve source graphemes, protected nodes, placeholders and extra lines.
- Bundled `java-ltr` capability; custom profiles without it retain old wrapping.
- Diagnose unsupported shaping; do not claim complete native Unicode parity.
- All eight Java presets, vanilla resources, GUI scale 2; no game runtimes in git.

## Review Focus

- Delimiter spaces spanning style groups must break as one text stream.
- Empty lines and trailing newlines must retain their document boundaries.
- Atomic placeholder values may wrap visually without splitting the PM atom.
- Center/right padding must follow visual lines after soft wrapping.
- Width changes and IME must not rewrite source or create undo steps.

### Task 1: Shared line breaking and layout export

**Files:** src/core/layout/layout.ts, src/core/model.ts,
src/profiles/java-1.21.1.ts, src/core/text/serialize.ts,
tests/unit/wrapping.test.ts, tests/fixtures/client/native-wrapping/.
**Interfaces:** `layoutText(text, options): LayoutResult`; new optional
`Glyph.suppressed` identifies a retained source delimiter without displayed ink.

- [x] Capture independent native wrapping cases and record literal reference lines.
- [x] Write unit cases for word boundaries, repeated/leading spaces, exact width,
      long words, explicit newlines, style boundaries, custom graphemes, unsupported
      bidi/shaping, and hidden source lines. Observe expected failures.
- [x] Implement Java wrapping for `font.layout: "java-ltr"`, suppression metadata,
      and capability diagnostics; keep custom legacy wrapping unchanged.
- [x] Test and implement explicit layout export using visual line breaks/padding,
      with ordinary source preservation and protected-token safeguards.
- [x] Run `npm test`; expect all unit tests green. Commit conventional fix.

### Task 2: Viewer and inline editing use measured lines

**Files:** src/dom/render.ts, src/dom/editor/effects.ts,
src/dom/editor/alignment.ts (remove), src/dom/editor/controller.ts, src/dom/styles.css,
tests/browser/native-wrapping.spec.ts, tests/browser/comparison.spec.ts,
src/core/status/evaluate.ts, src/dom/entry.ts, src/dom/comparison.ts.
**Interfaces:** Consume `Glyph.line`, `x`, `suppressed`, source ranges and
`LayoutResult.lines[].padding`; preserve existing editor commands and PM nodes.

- [x] Add browser references for both hosts and atomic values, alignment, resize,
      retained delimiters/newlines, selection, undo and formatting. Observe failures.
- [x] Skip suppressed ink in viewer and use display decorations for deterministic
      inline soft breaks and padding, with composition guards and atomic node views.
- [x] Run targeted tests in Chromium/Firefox/WebKit and Windows Chromium when
      applicable; expect all new reference and editing regressions green.
- [x] Run full unit suite and commit conventional fix.

### Task 3: Documentation, package verification and PR

**Files:** docs/profiles.md, docs/limitations.md, docs/api.md,
tools/reference/README.md, .github/workflows/ci.yml if native Windows cases added.
**Interfaces:** Document capability and diagnostic boundaries without stronger
pixel-parity claims than the reference corpus supports.

- [ ] Update reference recipe, source/visual-line behavior and custom compatibility.
- [ ] Run full browser suite, unit suite, quality checks, packed consumer and
      examples; expect green checks with only existing documented skips/warnings.
- [ ] Obtain one fresh whole-branch correctness review, fix important findings
      with failing regression tests, then create an English PR closing #7.
- [ ] Verify actual CI at the final commit; leave PR open for the user to merge.
