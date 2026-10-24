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

Only the cropped references are checked in for these sessions. Their manifest checksums are verified against the capture files, and the source full-screen hashes are recorded for provenance. `native-font-reference.spec.ts` compares seven supported cases in both viewer and editor; the remaining Unicode/combining/missing/obfuscation captures document measured limitations and replacement behavior. They must not be used as proof of native parity for unsupported glyphs. The italic cases now compare exact foreground and shadow masks in all three engines and Windows Chromium; bitmaps are generated from independent OFL outlines. `node tools/build-pixel-font.mjs --check` verifies reproducibility, with no native images or game assets as input.

To regenerate the bundled derivatives, install `fontTools==4.60.1` in an isolated Python environment and run `python3 tools/build-fonts.py`. The original checked-in OFL fonts are the inputs. The script corrects both width tables, verifies every CFF advance against hmtx and updates derivative checksums while preserving source timestamps. Native game fonts are never inputs.

Windows browser validation additionally distinguishes DirectWrite antialiasing from the native foreground cell geometry. See `docs/profiles.md` for the literal coverage thresholds and shadow anchors; the Linux mask comparisons remain exact. This distinction is recorded rather than hiding the platform gap, which remains #70.

## Word-wrap sessions, 2026-10-23

The `native-wrapping` corpus uses another isolated launch of every preset and the
same status-only setup. Serve each manifest's exact JSON description. Mark case
readiness with the same generated favicon RGB `(20 + caseIndex * 15, 40, 220)`;
refresh until that icon is displayed, then move the pointer outside the row.
Crop at `[194,94,542,42]` for 1.20.4/1.21.1 and `[194,96,534,42]` for modern
clients. Those widths cover the entire 271/267-logical-pixel MOTD, including the
left decoration extent. Capture files and all eight runtime jars are checksum
verified. The Unicode-boundary capture documents unsupported shaping/fallback;
the other eight cases are compared against both display modes.

The Java 26.3 `StringSplitter.LineBreakFinder` bytecode independently confirms
that U+0020 is recorded before checking overflow, a single delimiter is consumed,
and the first nonzero-width character is accepted even when wider than the line.
The reference cases exercise those rules in all eight independently run clients.

The additional `native-wrapping-controls/26.3/` session used the same isolated
procedure for `M\r\nM`, `M\nM` and `M\rM`. Its manifest records the source JSON,
client hash and crop checksums. It establishes the CR control/LF boundary rather
than certifying browser fallback ink; see the documented `?` rendering limit.

## Deterministic per-glyph ink, 2026-10-24

The existing independently licensed OFL cell data now paints supported normal,
bold and italic glyphs through local PNG masks. Modern MOTD decoration shadows
are composed above glyph foreground, matching the captured native draw order;
old shadow-free MOTDs do not receive those pixels. Full foreground/shadow masks
replace the Windows threshold/anchor exceptions for all eight existing
GUI-scale-2 native-font sessions. Those sessions are still Linux Java clients.
Actual Windows Chrome and three Linux browser engines exercise the masks; an
actual Windows Java-client session remains outstanding in #70. Mixed styles at
GUI1–3/DPR1–2 compare viewer/editor parity, not new native client captures.
Unsupported/non-grid glyphs, custom fonts and text outside the per-glyph path
retain browser font rendering. No new game fonts or textures were added.
