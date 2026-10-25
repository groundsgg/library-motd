# Optional rotating menu panoramas

Issue #10 adds a standalone panorama renderer to the existing DOM viewer/editor
and React adapters. Server documents and status exports retain their current
meaning. Hosts supply resources per client profile; Grounds is not required.

The user has delegated sequential issue implementation. API and implementation
choices below are builder decisions using the issue's existing acceptance
criteria, rather than new preferences attributed to the user.

## Approach

Use a six-face CSS 3D cube with a perspective camera, not a horizontally moving
flat background. This supports ordinary cross-origin image URLs without a
WebGL/CORS dependency, preserves the existing DOM/iframe ownership model and
allows static offline fallbacks. A WebGL renderer would add context loss and
cross-origin texture restrictions; sliding the existing SVG would not implement
native perspective. CSS filtering may approximate native postprocessing, which
must be documented separately from measured projection/rotation.

## Resource and motion contract

Extend `PreviewBackground` with `PanoramaBackground`:

- `panorama.faces`: exactly six nonempty URL strings, in native `panorama_0`
  through `panorama_5` order. Document face orientation after the native probe.
- `panorama.fallbackImageUrl?`: static image while loading or after failure;
  omission uses the existing original panorama illustration.
- `panorama.overlayImageUrl?`: optional host-owned native-style overlay.
- `motion?`: `initialYaw` in degrees (default 0), `speed` multiplier (default 1),
  `paused` (default false). Speed changes retain the current phase. Negative
  finite speed reverses this optional preview motion. Invalid/nonfinite numeric
  options use safe defaults; constrain absolute speed to 10.
- `blur?`: nonnegative CSS-pixel radius, default 5, maximum 32.
- `dimming?`: black overlay opacity, default 1/3, clamped to [0,1].

Existing strings and `{imageUrl}` remain unchanged. `assetProvider(profile)`
can return the new object as `background`. Explicit context backgrounds retain
their existing precedence over provider backgrounds.

Expose a DOM-free `panoramaPose(elapsedMs, initialYaw?)` helper returning yaw,
pitch and vertical FOV. Time is native-speed accumulated time, including negative
time for reverse playback. The audited 26.3 code uses vertical FOV 85°, pitch
10° and negative yaw at 2°/second at speed 1. Verify signs and face orientation
with an independently launched client using original calibration textures.

## Persistent lifecycle

Each entry owns one persistent panorama controller. It loads six images once
per changed source, swaps in the cube only when all are ready, and keeps the
static fallback for invalid/missing resources. Old requests cannot publish
after source replacement or destroy. No host object URL is revoked.

The animation uses the owning window's requestAnimationFrame. It pauses without
advancing phase when `context.animations` is false, motion is paused, reduced
motion is enabled, the document is hidden, or the panorama is not active.
Media-query changes apply live. Unrelated document/context updates do not reload
resources or reset phase. Destroy cancels frames and removes all owned listeners
and nodes. Instances, including same-origin iframes, own independent state.

The backdrop is decorative and cannot receive input, selection or accessibility
focus. Editor mounts, source selection, history and pinned tools survive
presentation updates. Row presentation keeps its existing background behavior.

## Evidence and examples

Create original redistributable demo faces and calibration data; no extracted
Mojang textures, fonts, binaries or runtime dependencies enter the package.
Keep game runtimes and decompilation private. Native 26.3 calibration must check
FOV, pitch, orientation, rotation rate and explicitly separated dimming/blur.
Do not mark every profile verified or claim arbitrary host overlays match.

Both examples expose the original rotating demo and pause/speed controls, with
English/German labels. A host-provider example shows per-version sources. The
existing bundled static illustration remains the fallback and the default for
the legacy `panorama` string.

## Validation and limits

Meaningful unit cases cover finite/wrapped/reverse poses and source/settings
validation. Browser cases cover projection probes, loading/failure/late events,
pause/resume/reduced motion, speed changes, unrelated updates, isolation, iframe
ownership, destroy and retained editing/history. Include focused Windows CI,
Node/SSR import and packed consumer checks. Full browser CI must pass before
the PR is ready. One fresh whole-branch review follows implementation.

The separate Windows native-client verification (#70), real IME/assistive pass
(#17) and original-resource rights/hosting decision (#9) remain separate work.
