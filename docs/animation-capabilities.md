# MOTD animation capabilities and timing

Frames, scrolling, blinking and automatic gradient/rainbow playback are not
implemented public APIs. This document separates measured native behavior from
a proposed future playback model for #12. Static gradient/rainbow phase and the
existing obfuscated-text decoration remain available; see [inline effects](inline-effects.md).

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

## Keep the three behaviors distinct

| Behavior                  | Meaning                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| One status snapshot       | The existing status API evaluates one document with supplied context.                                                                            |
| Frame selection per ping  | A host may choose a different document for each actual status request. A client that already cached a response need not change.                  |
| Explicit preview playback | A future opt-in simulation could show timed frames, scrolling or blinking. It must be labeled as a simulation and must not imply native support. |

Native obfuscated text is a different mechanism: it is a text decoration whose
glyphs the client changes. It is not evidence that arbitrary frame lists, moving
CSS gradients or scrolling text are understood by the status protocol.

## Future model proposal — not an exported type

Keep sequence data independent of a static `ServerListDocument`, the Portal and
network transport. A possible sequence has:

| Data           | Proposed semantics                                                                 |
| -------------- | ---------------------------------------------------------------------------------- |
| Revision       | Version the sequence contract independently before public use.                     |
| Ordered frames | Each frame holds a `TextDocument` and a positive integer duration in milliseconds. |
| Loop mode      | Loop repeats at total duration; once holds the final frame after completion.       |
| Initial offset | Explicit position within the sequence; no hidden wall clock.                       |
| Sampling time  | A caller-supplied finite elapsed time selects exactly one frame.                   |

A public implementation must reject empty sequences and invalid durations,
bound frame count and total duration, and specify boundary behavior before
accepting input. Selection at a frame boundary should choose the following
frame. Sampling first chooses text, then resolves placeholders and player rules
with the supplied runtime context; live values never become saved frame data.
The library must not fetch a server or assume a player's current proxy. Hosts
supplying player counts still need network-wide presence data.

Server-side per-ping sampling and a preview playback clock are separate inputs.
A future preview must preserve document, selection, caret and undo during
playback and seeking. Pause, reduced motion, hidden instances and disposal stop
automatic playback; explicit deterministic sampling remains available. Scrolling
distance and blink visibility belong to the simulation output, not silently
inserted source characters or native protocol fields.

## Export boundary

An ordinary Java status export can contain the chosen frame at one supplied
time. A future timeline exporter would need an explicit diagnostic when timing,
scrolling or blinking cannot be represented by the selected target. It must not
silently advertise CSS playback as native MOTD animation, invent status fields
or promise client update frequency. A custom/modded target needs its own declared
capability and independent evidence.

This proposal does not change parsing, serialization, playback controls or the
current status/document APIs. Implementation and broader client verification
remain separate work. The opt-in playback proposal is tracked in
[#84](https://github.com/groundsgg/library-motd/issues/84).
