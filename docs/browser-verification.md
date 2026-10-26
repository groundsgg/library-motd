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

The Windows GitHub Actions job additionally uploads `windows-resource-diagnostics`
for seven days, including passing runs. Its numeric JSONL snapshots contain TCP
state counts across the runner and for fixture port 4173, aggregate process
working/private bytes and handles for the test runner and fixture connection
owners, and available/committed/commit-limit/pool memory counters. The initial
sample also records configured IPv4/IPv6 dynamic TCP port ranges. It records no
addresses, individual connections, process names/arguments, test titles or
environment. Missing measurements are `null` with fixed error categories.

The reporter samples at suite start/end, after unexpected failures and at test
starts at most once per 15 seconds. Queries never overlap; each has an eight
second timeout and a 16 KiB output limit. The artifact is capped at 120 samples
and 128 KiB, with a final summary. Collection is read-only, enabled only on
Windows GitHub Actions, and does not change retries, assertions or test status.
Compare observations with the retained failing trace; a high `TimeWait` count
alone does not establish port exhaustion or explain `ERR_NO_BUFFER_SPACE` (#89).

Windows test Chromium temporarily disables `TcpPortRandomizationWin`, following
[Playwright's upstream fix](https://github.com/microsoft/playwright/pull/43605)
for the [Windows loopback socket bug](https://issues.chromium.org/issues/572515601).
Playwright 1.64.1 is still the stable version. Its complete disabled-feature list
is preserved in one replacement argument; simply appending another
`--disable-features` argument would discard its defaults. A real CDP command-line
check compares against an unmodified launch and fails if defaults drift or any
other launch switches change. Remove the helper when a stable Playwright update
includes the upstream fix. This affects test browsers only, changes no OS setting,
and adds no assertion retries, skips or weaker image comparisons. The mitigation
does not certify every previous resource failure's exact cause.

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

Linux GitHub Actions also retains `graphics-startup-diagnostics` for seven days.
This single startup snapshot records memory, the test process's file descriptor
count and resource limits, installed Mesa/Xvfb versions and whether the expected
display/software-rendering environment is present. It does not create a GL
context or retain display addresses, process arguments or environment values.
After the native API observer tests, the same artifact also retains separate
GLX worker observations for each engine, with timestamps and unique filenames.
Writes publish complete JSON files atomically; startup removes only prior
generated GLX records. These are best effort: utility installation,
query timeout/missing-command/output-limit/format errors and file-write failures
cannot fail browser rendering checks. Only fixed capabilities or a fixed reason
are retained, never raw command output. Native WebGL and panorama assertions
remain required and unchanged; no new skips or retries are introduced.

The panorama suites observe native WebGL calls and creation/loss events. On an
unexpected failure, `graphics-diagnostics.json` joins the retained test trace:
at most 32 events, attempt/outcome counts, numeric capabilities, classified
renderer and fixed known failure codes/blocked-path flags. Arbitrary driver
messages are excluded. Linux CI adds a fresh host snapshot and a read-only
`glxinfo -B` probe with a two-second/16 KiB limit; only booleans, a renderer
category and numeric GL version are retained. Each JSON artifact is capped at
16 KiB; missing queries use null values and fixed categories. Diagnostic errors
never replace test status. There are no new retries, preferences or weakened
ready-state assertions. These observations support #90's investigation; they
do not establish its cause. A separate failed GLX probe and a Firefox policy
refusal are distinct observations even when they occur on the same runner.

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
and all three Linux engines.

Protected JSON literal fixtures also compare viewer/editor color, bold, italic,
underline and actual glyph widths, while their one atomic editor boundary and
raw click/hover metadata survive neighboring edits, undo and persistence. HTML-like
literal text remains data; context-dependent components remain unresolved. The
private styled projection does not change canonical flattening or ordinary
export. Explicit layout export uses its corrected widths and retains protected
break refusal.

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
