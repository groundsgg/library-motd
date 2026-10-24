# Native static server-icon projection

Issue #13 is a feasibility study, not a promise of animated Java status icons.
Audit of official26.3 client SHA1 e877b6a07acd633fb3bb475002175cec036e7b87:
ServerStatus.Favicon requires a PNG data URI; ServerData validates the PNG header;
FaviconTexture requires64x64; OnlineServerEntry uploads one NativeImage only when
icon bytes change; NativeImage validates PNG and calls STB stbi_load_from_memory
for one RGBA image. There is no favicon animation-frame model in that path.

W3C PNG3 specifies that APNG retains a static/default IDAT image which may differ
from the animation's first frame. A browser img can show the animation instead;
that must not misrepresent ordinary Java status. Do not implement GIF/APNG frame
playback as native support. Host-provided presentation assets remain separate.

Add pure normalizeStatusIcon(icon):Outcome<IconValue>. Reuse bounded PNG chunk
inspection for validation, retain the static/default IDAT and every other
non-animation chunk byte-for-byte, remove acTL/fcTL/fdAT including their CRCs,
and return a translated stable warning when animation metadata was removed.
Do not decode/recompress pixels or change alpha. Static PNG bytes stay identical.
Invalid icon shape/base64/size/chunk framing remains invalid-icon. Status icons
remain64x64 with existing131072base64-character limit. Scanner accepts arbitrary
positive PNG dimensions privately for existing upload/crop normalization.

Saved source documents retain their original icon bytes. evaluateStatus and
compileStatusTemplate project static icons without mutating source; importStatus
stores the projected native icon and returns the notice. Inherited base favicons
also project to static; unsupported inherited favicon data is omitted with a
warning instead of blanking the entire MOTD. Never export unsupported animated
image data as an ordinary Java favicon.

normalizeIcon and its crop preview decode the PNG static/default image before
Canvas/ImageBitmap can choose an animation frame. Preserve existing PNG/JPEG,
size/pixel/crop bounds, cancellation/generation guards and one-step undo. No new
network request or runtime dependency. Supply English/German diagnostics.

Tests use original red/blue/transparent APNG fixtures, including default image
excluded from animation. Verify raw pixel/alpha preservation and unchanged source,
core Node exports, browser viewer/editor/crop agreement, diagnostics, stale upload
handling and all three engines plus Windows. Document audited26.3 scope and the
absence of broader mod/extension or historical-client animation certification.
One English PR for #13 stacked on #77; no merge/release/Portal deployment.

Sources: https://www.w3.org/TR/png/#4Concepts.APNG and official26.3 client bytecode
kept in private tooling only; no Mojang code or assets redistributed.
