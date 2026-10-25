# Composition Paint Recovery Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore deterministic glyph paint after deferred composition recovery without clearing a newer preedit session.

**Architecture:** A private WeakMap associates each editor DOM node with its current composition owner. Completion skips dispatch on destroyed plugins but releases only its own paint marker. Existing source-caret helpers remove timing assumptions from recovery fixtures.

**Tech Stack:** TypeScript, ProseMirror, Playwright native Chromium CDP and cross-engine DOM lifecycle tests.

**Spec:** `docs/superpowers/specs/2026-10-25-composition-paint-recovery-design.md`

## Global Constraints

- Keep source/history, access revocation and generation checks unchanged.
- No public API, permission policy, keyboard workaround, sleeps or retries.
- A stale completion callback cannot end a newer composition's paint mode.
- CDP/synthetic tests are not physical IME certification.

## Review Focus

- Deferred document replacement must repaint supported glyphs after composition.
- Read-only, disabled and feature revocation must reject input and then resume rendering.
- Back-to-back sessions must keep preedit fallback until the latest session ends.
- Destroyed/reconfigured plugins must never dispatch late transactions.
- Recovery typing must use an explicitly established source caret.

### Task 1: Rendering ownership and recovery fixtures

**Files:** Modify `src/dom/editor/effects.ts`, `tests/browser/composition-native.spec.ts`, `tests/browser/selection-diagnostics.ts`, `.github/workflows/ci.yml`, `docs/browser-verification.md`.

- [x] Add native rendering regressions after replacement/revocation and a cross-engine back-to-back lifecycle case.
- [x] Run the new cases and confirm failures show browser-text fallback or prematurely restored masks.
- [x] Add private per-node composition ownership; guard late dispatch and release only matching owners.
- [x] Establish native fixture caret positions with existing helpers; retain edit/rejection assertions and diagnostics.
- [ ] Run all units, relevant cross-engine/native repetitions, lint, typecheck, format, package checks and current-head CI.
- [ ] Commit, obtain independent whole-branch review, create a separate PR and merge after green checks under existing authorization.
