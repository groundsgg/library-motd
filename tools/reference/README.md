# Client reference validation

Actual Java 1.21.1 captures were obtained on 2026-10-21 using a clean temporary game directory, Xvfb 854×480 and GUI scale 2. A local status-only server advertised protocol 767, online 42/max500, sample Ada, bold gold Grounds and green Welcome, 42 players. The native client was launched offline without an account token.

`tests/browser/client-reference.spec.ts` compares independent native and browser foreground pixel masks at known row positions. It passes for all three tested colors. Capture origin is (126,72); browser row origin is (0,0). Player tooltip adds “… and 41 more …”. See fixture manifest for capture hashes. Native game jars/assets are not distributed.

Broader glyph/decorations/compatibility/wrapping validation and actual IME verification are still outstanding; the public profile therefore remains explicitly unverified.

## Full-menu sessions, 2026-10-23

The `tests/fixtures/client/native-ui/<version>/scale-<n>/` corpus contains independently launched Java 1.20.4, 1.21.1, 1.21.11, 26.1, 26.1.1, 26.1.2, 26.2 and 26.3. All use vanilla resources and an isolated offline game directory. Runtime jars/libraries are checked against official metadata hashes and kept outside the repository; no account token or launcher account file is needed. Each manifest records the exact client jar hash, physical viewport and scale, and checksums for the captured screens.

To reproduce, launch the stated official client with `--username MotdReference --uuid 00000000000030008000000000000001 --accessToken 0`, a separate `--gameDir`, the vanilla asset index, and the manifest's physical `--width`/`--height`. Set `guiScale` to the manifest value, `lang:en_us`, `narrator:0` and `skipMultiplayerWarning:true` in that directory's `options.txt`. The Linux captures use Xvfb and software OpenGL; Java 21 runs the older clients and Java 25 runs 26.x.

Add one server named `Grounds Network` pointing at a local status-only fixture. It advertises `42/500`, player sample `Ada` with UUID `00000000-0000-0000-0000-000000000000`, and this description:

```json
{
  "text": "",
  "extra": [
    { "text": "Grounds", "color": "gold", "bold": true },
    { "text": "\nWelcome, 42 players", "color": "green" }
  ]
}
```

For incompatible captures advertise version name `1.21.1` with protocol `-1`. Wait until the status response is visibly rendered, move the pointer outside the controls and capture the menu. Select the row and capture again. Then advertise that client's actual protocol, refresh, wait for completed green ping bars, move the pointer away and capture the compatible menu. Hover the player count and connection icon for the two tooltip references. No login or game connection is accepted by the fixture. An initially captured 26.2 loading frame was rejected and replaced after explicitly waiting for its status response.

Native icon placement was independently checked against the local client's default-icon pixels; the default icon itself is not bundled as a library asset. The menu regression separates label/geometry/status comparisons from the intentionally approximate default artwork. Screenshot references and game runtimes are excluded from the npm package. See `docs/profiles.md` for the exact verification scope.

## Font sessions, 2026-10-23

`tests/fixtures/client/native-font/<version>/manifest.json` describes 11 additional cases for each of the eight clients. Use the same isolated-client procedure above with a fresh game directory, default resources, 854×480 and GUI scale 2. Serve each manifest case's exact `description` JSON, advertise version protocol `-1`, and refresh the list. The first line is gold and the second aqua, allowing foreground and quarter-brightness shadow masks to be separated from the backdrop. No server login is involved.

To prove readiness rather than capturing an earlier response, the fixture uses an independently generated 64×64 solid server icon with RGB `(20 + caseIndex * 15, 40, 220)` for zero-based case indices. Wait until its corresponding displayed pixel changes to that color after refreshing. Move the pointer outside the row. Crop the manifest's `[x,y,width,height]` region: `[194,94,440,42]` for 1.20.4/1.21.1 and `[194,96,440,42]` for the modern clients. This includes both text lines and the bottom descender/decoration shadow. Capture four successive obfuscation frames; their random glyphs are not deterministic snapshots. All frames in a case must show the matching icon before cropping.

Only the cropped references are checked in for these sessions. Their manifest checksums are verified against the capture files, and the source full-screen hashes are recorded for provenance. `native-font-reference.spec.ts` compares six supported cases in both viewer and editor; the remaining Unicode/combining/missing/italic/obfuscation captures document measured limitations and replacement behavior. They must not be used as proof of native parity for unsupported glyphs or synthetic italic.
