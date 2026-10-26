# Browser verification

The full browser suite runs in Chromium, Firefox and Playwright WebKit on
Ubuntu 24.04 for every pull request and before a release. The initial matrix
verification passed 31 tests per engine (93 cases in total). CI installs
all three engines and their system dependencies; `CI` limits concurrency to two
workers. A browser failure blocks the shared validation and publishing jobs.
Failed cases retain a Playwright trace and screenshot in the existing CI report
artifacts. The input-bounds, native-italic and native-composition suites also attach
`native-selection-events.json`: the last 256 focus, keyboard, input, composition
and selection events, including bounded selection text, endpoints and timing.
Endpoints include rendered field offsets so identical per-glyph text nodes can
be distinguished. Native composing flags and the pixel-rendering fallback mode
are recorded alongside them.
These observers do not alter input or selection. Open a retained trace with
`npx playwright show-trace path/to/trace.zip`; inspect its JSON attachment to
compare native event ordering with the failed assertion. Passing cases discard
their traces and do not attach the event history. Tests are not automatically
retried; intermittent failures still block validation.

Cases that require an exact source caret establish it explicitly before native
typing or selection. A programmatic focus followed immediately by `Control+End`
can race ProseMirror's delayed focus correction before the native selection
notification arrives. The affected overflow/placeholder/italic fixtures use
the existing rendered-range helpers; native shortcut, arrow, deletion, clipboard
and undo assertions remain unchanged. This avoids relying on an unverified
starting caret rather than retrying a failed edit or changing production input.

Composition completion also verifies that deferred document/access recovery
restores supported pixel-glyph painting. A back-to-back lifecycle case keeps the
newer preedit on live text until its own end. Native Chromium CDP cases run on
Linux and Windows; they remain automated lifecycle checks, not physical IME or
screen-reader certification.

Linux CI uses Xvfb with software OpenGL so Firefox can create a real WebGL
context. Without an X11 display its headless build correctly uses the static
fallback, which does not exercise the animated panorama renderer.

A focused Chromium job on Windows also checks regular/bold baselines, mixed
and fully bold two-line MOTDs, descenders, and the React formatting toggle.
Supported per-glyph bundled text uses locally generated pixel masks to avoid
OS antialiasing differences. The Windows job checks complete native reference
foreground/shadow masks at GUI scale 2 as well as editing behavior. Custom fonts
and text outside that renderer retain browser rasterization. Passing the Ubuntu
matrix alone does not establish correct Windows text geometry or certify an
actual Windows Java client; that capture remains outstanding in #70.

```sh
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
# Linux without a display (including panorama GPU checks):
xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 npm run test:browser
# One engine, for diagnosis:
npm run test:browser -- --project=firefox
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` overrides only the Chromium executable. It does
not change the Firefox or WebKit executable. A local Vite server is reused;
CI starts an isolated one.

## Covered behavior

Every engine exercises DOM editing and React controlled echoes, focus and
unmount/remount, selection formatting and undo, source validation, properties,
icon upload/crop/corrupt input, alpha preservation, asset providers, local-only
editing, synthetic composition and lifecycle/late-import boundaries. Menu
geometry and the six existing Java text-reference comparisons run in each
engine too.

Panorama coverage includes native 26.3 projection probes, moving rows, pause and
speed changes, CORS authorization, GPU loss and static fallbacks. Twenty rows
verify that independent previews share one document's GPU context. The Windows
Chromium job also runs these panorama and example cases.

The paste boundary test supplies an explicit clipboard-data property on its
synthetic event. Firefox discards `ClipboardEvent` constructor-supplied data;
this harness difference is separate from handling a real user paste. These
checks do not exercise OS clipboard permission prompts or a real IME.

## Pixel comparisons

Native reference fixtures and geometry assertions are unchanged. The supplied
opaque icon and the existing text-pixel masks are compared exactly in every
engine. Uploaded PNG alpha values must remain exact as well.

Selected bundled glyphs also retain their foreground/shadow pixels at DPR 1
and 2, including bold, italic, decorations and placeholder text. A controlled
transparent highlight isolates the ink comparison; a separate case requires
the native selection background to remain visible. Custom-font and synthetic
preedit cases keep their live browser foreground. These run on Windows Chromium
as well as the full three-engine matrix.

For the transparent-icon screenshot, Chromium matches the native capture
exactly. Other engines may differ by at most two 8-bit RGB channel values on
partially transparent pixels because canvas premultiplication and compositing
round differently. Fully transparent and opaque pixels, and all screenshot
alpha channels, still require exact equality. A profile geometry or font
failure must not be hidden by this narrowly scoped image tolerance.

## Limits

Panorama projection compares two original native calibration bands. Interior
samples permit at most two RGB channel values of difference; samples on texture
face boundaries are excluded because cube-edge filtering differs across engines.
These checks do not certify the native blur shader or arbitrary panorama artwork.

Playwright WebKit is an automated engine check, not a test of the shipping
Safari application on macOS/iOS. OS-specific fonts, native clipboard workflows,
real Japanese input methods and assistive technology still require manual
verification. Browser coverage does not establish native Minecraft fidelity for
unverified glyphs, UI regions or client versions; those limits remain in
[profiles.md](profiles.md) and [limitations.md](limitations.md).
