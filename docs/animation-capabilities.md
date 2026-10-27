# MOTD animation capabilities and timing

The viewer targets the selected **Vanilla Java client profile**. It displays
one supplied server-status snapshot with the client behavior that profile
supports. It does not offer an optional simulation of server-supplied MOTD
frames, scrolling, blinking, moving gradients or rainbow phase playback.
Static gradient/rainbow phase and native obfuscated text remain available;
see [inline effects](inline-effects.md).

## Viewer contract

| Content or effect                           | Viewer behavior                                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOTD, version, player data and servericon   | Display the supplied snapshot. A host can provide a new snapshot; the viewer does not invent repeated status requests or a refresh cadence.        |
| Gradient and rainbow                        | Render the chosen phase as ordinary static text colors. Do not advance the phase automatically.                                                    |
| Obfuscated text (`§k`)                      | Reproduce the client-side effect using the selected profile's glyph metrics. Native timing and rasterization still need profile-specific evidence. |
| Menu panorama                               | Reproduce the selected profile's client-owned background motion when configured. This is independent of status-response updates.                   |
| Servericon animation                        | Use the static/default PNG image. GIF/APNG playback is not a native Java status-icon capability; see [server icons](icon-animation.md).            |
| MOTD frame timelines, scrolling or blinking | Outside the Vanilla viewer's scope, including an opt-in preview-only mode.                                                                         |

Pause/reduced-motion settings can freeze supported client effects without
changing source documents. A host can select different text for each actual
status request, but that does not animate a response already cached by a client.
The standalone core remains independent of Portal services and network polling.

Vanilla fidelity is the target, not a claim that every client version, custom
font or resource pack is already pixel-verified. Keep profile evidence,
approximation diagnostics and [known limits](limitations.md) explicit. Unknown
context-dependent components must not be replaced with invented game data.

## What the native client demonstrated

An isolated official Java 26.3 client (protocol 777) displayed a local status
response containing FRAME A. Future responses were changed to FRAME B without
refreshing the list. After 65.941 seconds the row still displayed A, and the
fixture had received no second status request. Clicking Refresh produced the
second request and displayed B.

That first case advertised an incompatible protocol. A compatible-protocol
control then displayed FRAME C with native 42/500 and completed green ping bars.
Future responses were changed to FRAME D. After 109.790 seconds the row still
displayed C, with no new status request. Refresh produced the fourth total
request and displayed D.

The audited 26.3 status-response handler stores the received description in the
row's server data and rejects a second unrequested status response on the same
connection. The status record has a text description, not a frame-duration or
scroll timeline. Together these observations support snapshot display and
per-request frame selection for this measured vanilla path.

These intervals do not establish every possible wait duration, historical or
modded clients, Windows Java or Bedrock. They do not promise automatic repolling
or a viewer frame rate. Panorama rotation is a separate client-owned menu effect;
it does not establish continuously changing server-supplied MOTDs.

The repository's [session manifest](https://github.com/groundsgg/library-motd/blob/main/tests/fixtures/client/native-timing/26.3/manifest.json)
records exact responses, client hash, timing and private capture checksums.
Runtime files and full screenshots remain outside the repository/npm package.
See the repository's [reference procedure](https://github.com/groundsgg/library-motd/blob/main/tools/reference/README.md#motd-status-timing-session-2026-10-25)
to repeat the experiment with an authorized local client. The research manifest
and maintainer tools are not installed with the npm package.

## Snapshot selection and export

A host may choose a different static document for each real ping, including
server-side gradient/rainbow phase choices. Resolve placeholders and player
rules with the supplied context; do not persist live counts into the document
or assume that one proxy's count represents the whole network.

An ordinary Java status export contains one description and icon snapshot.
It must not invent timeline protocol fields, export CSS as native animation or
promise that a Vanilla client will continuously update an already displayed
response. Client-owned obfuscation and panorama motion do not establish support
for arbitrary server-supplied animation.

## Scope decision

The native timing investigation in #12 remains valid research evidence. The
preview-only animation proposals [#11](https://github.com/groundsgg/library-motd/issues/11)
and [#84](https://github.com/groundsgg/library-motd/issues/84) are not planned for
the Vanilla-faithful viewer. Their timeline-model sketches are not exported
APIs or pending viewer features. A custom/modded client would require a separate
explicit target, contract and verification rather than changing Vanilla behavior.
