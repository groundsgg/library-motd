# Native client reference tools

Read the maintained [verification guide](https://docs.grounds.gg/reference/development/motd/verification) and [client profile evidence](https://docs.grounds.gg/reference/development/motd/profiles) for the capture procedure and its limits.

- `status-server.py` serves a supplied status response on localhost and does not accept game logins.
- `CapturePanorama.java` is a capture helper for a dedicated Linux Xvfb display.
- `panorama-calibration.mjs` compares the original calibration faces.
- `status-icon-probe.c` exercises the decoder used in the favicon study.

Keep local client binaries, extracted resources, and private full-screen captures outside the checkout. Public fixture manifests under `tests/fixtures/client` record the exact input, client version, GUI settings, and capture checksums. Browser rendering tests and source/decoder audits do not replace an actual native client capture.
