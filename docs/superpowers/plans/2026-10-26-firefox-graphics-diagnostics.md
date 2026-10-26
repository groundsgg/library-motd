# Firefox Graphics Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain bounded graphics/host evidence when panorama WebGL initialization fails in #90.

**Architecture:** A page observer records native context outcomes without changing renderer code. An auto Playwright fixture attaches bounded evidence on unexpected failure. A CI-only setup writes a startup host baseline under the existing Xvfb display without initializing GL.

**Tech Stack:** Playwright fixtures, browser WebGL events, Node filesystem/child-process APIs, Mesa glxinfo, GitHub Actions artifacts.

**Spec:** `docs/superpowers/specs/2026-10-26-firefox-graphics-diagnostics.md`

## Global Constraints

- At most 32 graphics observations; at most 16 KiB per artifact.
- Each external query has a two-second timeout and 16 KiB output limit.
- Native host collection is enabled only on Linux GitHub Actions.
- No arbitrary messages, URLs, source text or machine/user identifiers.
- Preserve native getContext receiver, arguments, return and exceptions.
- No production changes, preference overrides, assertion retries or weaker checks.
- Keep #90 and release #67 open; preserve the running preview.

## Review Focus

- Unavailable native queries produce null values and fixed categories, never guessed zero values.
- Graphics observation preserves native API behavior and never prevents loss/error events.
- Repeated events cannot grow the attachment or leak arbitrary status messages.
- Failure attachment/collector errors cannot mask the original assertion failure.
- Local runs and startup capture must not silently initialize a new GL context or inspect unrelated host data.

### Task 1: Add graphics and runner observations

**Files:** Create `tools/graphics-observer.mjs`, `tools/linux-graphics-diagnostics.mjs`, `tools/graphics-setup.mjs`, `tests/browser/graphics-diagnostics.ts`, `tests/browser/graphics-diagnostics.spec.ts`, `tests/tooling/linux-graphics-diagnostics.test.mjs`. Modify the two panorama spec imports, `playwright.config.ts`, `.github/workflows/ci.yml`, `docs/browser-verification.md`.

**Interfaces:** `installGraphicsObserver()` and `readGraphicsObserver()` run inside the page. `collectGraphicsSnapshot({probeGlx?:boolean})` returns allowlisted host data. `encodeGraphicsDiagnostics(value)` returns bounded JSON or a fixed omission marker. The fixture uses normal Playwright `use`/testInfo attachment behavior and never changes test status.

- [ ] Write tests for numeric Linux parsers, GLX classification, native collection guard and encoding bounds. Observe missing-module RED.
- [ ] Implement the read-only collector and bounded page observer.
- [ ] Test real native WebGL return identity/capabilities and bounded synthetic event filtering in each engine. Verify actual GLX under Linux CI.
- [ ] Add an auto diagnostic fixture to the two panorama suites. Exercise a deliberately failing Firefox case locally and inspect the retained attachment and nonzero exit.
- [ ] Wire Linux CI startup snapshot and explicit hidden-file upload. Install mesa-utils for failure probes; do not run GLX during startup capture.
- [ ] Run tooling, lint, types, formatting, unit/SSR and the focused panorama matrix under software OpenGL.
- [ ] Commit with Conventional Commits, open a PR referencing #90, and obtain independent review. Inspect actual CI startup data; merge only after all checks pass.

The subsequent #23 improvement has its own design and PR after this change is integrated.
