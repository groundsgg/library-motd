# Browser verification

The full browser suite runs in Chromium, Firefox and Playwright WebKit on
Ubuntu 24.04 for every pull request and before a release. The initial matrix
verification passed 31 tests per engine (93 cases in total). CI installs
all three engines and their system dependencies; `CI` limits concurrency to two
workers. A browser failure blocks the shared validation and publishing jobs.

A focused Chromium job on Windows also checks regular/bold baselines, mixed
and fully bold two-line MOTDs, descenders, and the React formatting toggle.
Windows uses different font metrics from Linux; passing the Ubuntu matrix
alone does not establish correct Windows text geometry.

```sh
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
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

The paste boundary test supplies an explicit clipboard-data property on its
synthetic event. Firefox discards `ClipboardEvent` constructor-supplied data;
this harness difference is separate from handling a real user paste. These
checks do not exercise OS clipboard permission prompts or a real IME.

## Pixel comparisons

Native reference fixtures and geometry assertions are unchanged. The supplied
opaque icon and the existing text-pixel masks are compared exactly in every
engine. Uploaded PNG alpha values must remain exact as well.

For the transparent-icon screenshot, Chromium matches the native capture
exactly. Other engines may differ by at most two 8-bit RGB channel values on
partially transparent pixels because canvas premultiplication and compositing
round differently. Fully transparent and opaque pixels, and all screenshot
alpha channels, still require exact equality. A profile geometry or font
failure must not be hidden by this narrowly scoped image tolerance.

## Limits

Playwright WebKit is an automated engine check, not a test of the shipping
Safari application on macOS/iOS. OS-specific fonts, native clipboard workflows,
real Japanese input methods and assistive technology still require manual
verification. Browser coverage does not establish native Minecraft fidelity for
unverified glyphs, UI regions or client versions; those limits remain in
[profiles.md](profiles.md) and [limitations.md](limitations.md).
