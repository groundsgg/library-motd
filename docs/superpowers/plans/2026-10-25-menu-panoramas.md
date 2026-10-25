# Menu Panoramas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional native-perspective, independently configurable cubemap backgrounds.
**Architecture:** Pure pose/types plus one persistent owner-document DOM controller,
integrated into existing entry mounts. Sources come from explicit context or the
existing per-profile provider; static rendering is the error/offline fallback.
**Tech Stack:** TypeScript, CSS 3D, RAF, Vitest, Playwright, original PNG fixtures.
**Spec:** ../specs/2026-10-25-menu-panoramas-design.md

## Global Constraints

- No Grounds coupling, persisted asset URLs, game code/assets or runtime dependency.
- Preserve existing background strings, image objects, precedence and editor mounts.
- Defaults: 85° vertical FOV, 10° pitch, negative yaw 2°/second; verify native signs.
- Speed finite [-10,10], blur [0,32] CSS px default5, dimming [0,1] default1/3.
- Phase survives pause/speed/context changes; owner-window callbacks only.
- No merge, release or deployment under this feature implementation request.

## Review Focus

- Sources replaced during partial load must not show stale faces or errors.
- Provider returns equivalent new arrays on each render: no reload or clock reset.
- Clock pause/resume, hidden documents and reduced-motion changes must not jump.
- iframe ownership and destroyed/replaced mounts must not retain callbacks/listeners.
- Native calibration separates projection from blur/overlay artwork and verification scope.

### Task 1: Pure contract and native calibration

**Files:** src/core/model.ts, src/core/panorama.ts, src/index.ts,
tests/unit/panorama.test.ts, tools/reference/, tests/fixtures/client/native-panorama/.
**Interfaces:** `PanoramaSource`, `PanoramaMotion`, `PanoramaBackground`,
`panoramaPose(elapsedMs:number, initialYaw?:number):PanoramaPose`.

- [ ] Inspect native camera/motion/postprocess paths and independently capture
      original calibration resources. Record runtime/source/capture hashes privately
      and ship only original calibration output and reproducible maintainer tooling.
- [ ] Write RED tests for zero/90°/wrapped/reverse/nonfinite pose inputs and
      valid/invalid six-face settings; verify the expected failures.
- [ ] Implement the pure contract and safe settings; run all units/types/Node checks.
- [ ] Commit the independently testable core/calibration contract.

### Task 2: Persistent DOM cubemap and lifecycle

**Files:** src/dom/panorama.ts, src/dom/entry.ts, src/dom/styles.css,
tests/browser/panorama.spec.ts, tests/browser/iframe.spec.ts as needed.
**Consumes:** Task1 pose, source and settings.
**Produces:** private controller `update(background, context, sceneSize)`, `destroy()`.

- [ ] Write RED cases for six-face load, native projection probes and fallback.
- [ ] Implement the cube/perspective mapping and persistent resource controller.
- [ ] Write RED lifecycle cases: stale callbacks, equivalent arrays, independent
      instances/iframes, pause/resume/speed changes/live reduced motion/destroy.
- [ ] Implement bounded clock and ownership cleanup; retain editor source/caret/undo.
- [ ] Run targeted three-engine and actual Windows checks; commit the DOM feature.

### Task 3: Original demo, examples, docs and release validation

**Files:** tools/build-panorama-demo.mjs, assets/ui/panorama-demo/,
examples/shared/, examples/dom/, examples/react/, src/locales/, docs/panoramas.md,
docs/api.md, docs/embedding.md, tools/reference/README.md, package.json, CI.

- [ ] Generate and checksum original demo faces, with reproduction/license notes.
- [ ] Add RED example cases for demo selection/pause/speed and retained editing.
- [ ] Add localized controls and per-profile host-provider documentation.
- [ ] Run quality, units, full browser matrix, focused Windows, native calibration,
      Node/SSR, packed production consumer and example builds.
- [ ] One fresh whole-branch review; Important findings RED→GREEN plus full suite.
- [ ] Create one English Conventional Commit PR for #10, attach it and await green CI.
