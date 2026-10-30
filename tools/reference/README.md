# Native client reference tools

Read the maintained [verification guide](https://docs.grounds.gg/reference/development/motd/verification) and [client profile evidence](https://docs.grounds.gg/reference/development/motd/profiles) for the capture procedure and its limits.

- `status-server.py` serves a supplied status response on localhost and does not accept game logins.
- `CapturePanorama.java` is a capture helper for a dedicated Linux Xvfb display.
- `CaptureObfuscation.java` records timestamped MOTD crops and foreground-mask hashes on an owned Xvfb `:96`; raw PNGs stay outside the checkout.
- `panorama-calibration.mjs` compares the original calibration faces.
- `status-icon-probe.c` exercises the decoder used in the favicon study.
- `export-vanilla-sprites.py` exports the curated catalog from explicitly supplied, hash-verified official client JARs into a new private directory outside the checkout. It requires Python/Pillow and never downloads assets. Start the loopback dev server with `MOTD_VANILLA_SPRITE_DIR` pointing at that private directory. Production builds do not serve or bundle it. See the maintained [sprite guide](https://docs.grounds.gg/reference/development/motd/sprites#local-maintainer-preview).

Keep local client binaries, extracted resources, and private full-screen captures outside the checkout. Public fixture manifests under `tests/fixtures/client` record the exact input, client version, GUI settings, and capture checksums. Browser rendering tests and source/decoder audits do not replace an actual native client capture.
