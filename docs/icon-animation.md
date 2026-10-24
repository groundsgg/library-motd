# Static Java server icons

Ordinary Java status icons are static 64×64 PNG images. This library does not
export GIF playback, APNG frame playback or a favicon animation timeline as a
native Java capability. PNG/JPEG uploads are normalized to 64×64 PNG; APNG
uploads use their static/default image and explain that choice.

An APNG contains a static PNG image as well as animation data. Its default image
can differ from the first animation frame. The library retains the default
image's compressed `IDAT` data and other PNG chunks, removing `acTL`, `fcTL` and
`fdAT`. It does not decode or recompress those pixels in core. This follows the
[PNG static-image fallback](https://www.w3.org/TR/png/#4Concepts.APNG), rather than
asking the browser to choose an animation frame.

```ts
import { normalizeStatusIcon, formatDiagnostic } from "@groundsgg/motd";

const result = normalizeStatusIcon({ pngBase64 });
if (result.value) {
  // Static/default 64×64 PNG, usable without DOM, React or Portal.
  const favicon = "data:image/png;base64," + result.value.pngBase64;
}
const notices = result.diagnostics.map((d) => formatDiagnostic(d));
```

`normalizeStatusIcon` returns `Outcome<IconValue>`. Static PNG bytes remain
identical. Removing animation metadata emits warning code
`animated-icon-static`, with a stable translation key and English/German text.
Invalid base64, unsupported dimensions or incomplete chunk framing return
`invalid-icon`; the existing limit is 131,072 base64 characters. This is bounded
structural validation and projection, not a full pixel decoder.

Saved source documents retain their original icon bytes. `evaluateStatus` and
`compileStatusTemplate` project them without modifying the document; ordinary
Java favicon output contains the static PNG only. `importStatus` stores the
projected icon and returns its notice. Inherited base favicons use the same
projection; unsupported inherited icons are omitted with an
`invalid-inherited-icon` warning, leaving the other status fields usable.

Viewer, editor, upload normalization and crop previews use the same static
pixels, including transparency. `normalizeIcon` also accepts `image/apng` and
retains its existing input-size, pixel-count and crop bounds. Conversion happens
before `ImageBitmap` decoding. Crop Apply remains one undoable transaction, and
source replacement/cancellation still invalidate pending uploads. No new
resource request, animation timer or reduced-motion exception is introduced:
ordinary status icons remain static with either animation preference.

Generic URLs supplied through host presentation assets are separate from status
favicon data. They do not establish native icon-animation support; the host owns
their resources and motion behavior. Modded clients or protocol extensions would
need a separate capability/model and verification before animated support.

## Native evidence and limits

The official 26.3 client JAR was independently SHA-1 checked as
`e877b6a07acd633fb3bb475002175cec036e7b87` on 2026-10-24. Its audited path is:

- `ServerStatus.Favicon` accepts the PNG data-URI prefix.
- `ServerData.validateIcon` checks PNG header data; final
  `FaviconTexture.upload` requires 64×64 pixels.
- `OnlineServerEntry` uploads the icon when its byte content changes.
- `NativeImage.read` validates the PNG header and calls
  `stbi_load_from_memory` for one RGBA image, which is uploaded as one texture.

That path has no favicon animation-frame scheduling. New status responses can
replace icon bytes; rotating replies do not themselves create an in-client
frame timeline. This is a source/bytecode audit of 26.3, not a claim that every
historical or modified client has been tested for animation behavior.

An isolated probe of the [STB decoder](https://github.com/nothings/stb/blob/013ac3beddff3dbffafd5177e7972067cd2b5083/stb_image.h)
decoded both original APNG fixtures to the red default image with center RGBA
`255,0,0,128` and a transparent corner. The browser fixture deliberately has a
blue animation, including a case where the default image is excluded from that
animation. See `tests/fixtures/icons/manifest.json` and
`tools/reference/status-icon-probe.c` for provenance and reproduction. This
decoder probe is not a complete client screen capture. No client JAR, extracted
game code or game image data is included in these fixtures or the npm package.
