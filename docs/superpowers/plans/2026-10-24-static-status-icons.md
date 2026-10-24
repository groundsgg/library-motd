# Static Status Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Match native static/default PNG icon display and avoid exporting APNG playback.
**Architecture:** Pure bounded chunk projection shared by status and DOM upload
paths; retain source bytes, static pixels/alpha and existing lifecycle guards.
**Tech Stack:** TypeScript, Uint8Array/PNG framing, Canvas/ImageBitmap, Vitest/Playwright.
**Spec:** ../specs/2026-10-24-static-status-icons-design.md

## Global Constraints

- Static/default PNG means IDAT image, not necessarily animation frame0.
- Keep64x64/status131072base64 limits and existing upload/crop limits.
- No image recompression in core, no runtime dependency or network request.
- Preserve source document, alpha, cancellation/permissions and undo contracts.
- Native evidence limited to audited26.3 path and independently generated fixtures.
- One English PR for #13; no merge/release/deployment.

## Review Focus

- Default image excluded from animation must not turn into the first animated frame.
- Unknown/color/palette/transparency chunks must survive removal unchanged.
- Truncated/oversized chunk framing and base64 must fail safely before allocation.
- Inherited favicons, runtime templates and imports must use the same projection.
- Crop decoding and late uploads must retain static pixels, source and lifecycle guards.

### Task1: Pure PNG projection and core contracts

**Files:** src/core/image/png.ts, src/core/image/icon.ts, src/core/document.ts,
src/core/status/evaluate.ts, import.ts, template.ts, src/index.ts,
src/locales/, tests/helpers/apng.ts, tests/unit/static-icons.test.ts.
**Interface:** normalizeStatusIcon(icon:IconValue):Outcome<IconValue>, no DOM.
Private inspectPng(bytes) returns dimensions/default bytes/animation marker/end.

- [x] RED tests for source-preserving status/template/import projection,
      inherited formats, byte/alpha identity, malformed limits and fallback-frame semantics.
- [x] Implement bounded scanner, shared validator, diagnostics and core integration.
- [x] Run all units/types/tooling/Node and commit the pure contract.

### Task2: Static viewer/upload/crop behavior and evidence

**Files:** src/dom/icon-source.ts, src/dom/icon.ts, src/dom/editor/icon-tool.ts,
tests/browser/static-icons.spec.ts, docs/icon-animation.md,
docs/api.md, README.md, package.json, .github/workflows/ci.yml.

- [x] RED browser proof of APNG/default-image mismatch; tests for viewer,
      upload/crop, diagnostics, transparency and unchanged source.
- [x] Share static PNG preparation in decoder and crop source; retain limits/guards.
- [x] Verify same decoder behavior using original APNG fixtures and STB API;
      document PNG formats/refresh/native-versus-host scope without new game assets.
- [x] Full quality/unit/browser/package/examples/Windows checks.
- [x] One fresh correctness review; Important findings RED→GREEN plus suite.
- [ ] English PR for #13 and final CI green; leave open.
