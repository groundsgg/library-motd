# Client profile and provenance

Reference: official Minecraft Java 1.21.1 client, offline test session, default font, 854×480 window, GUI scale 2, local status-only test server at 127.0.0.1:25596. No account credentials were read. Screenshots are in `tests/fixtures/client/java-1.21.1`; native game assets remain outside the repository and npm package.

The browser test compares absolute foreground masks for the white server name, bold gold first MOTD line and green second line against the independent native screenshot. The masks and positions match exactly. The native player hover confirms the trailing “… and 41 more …” behavior.

The bundled font is an independently recreated OFL font from IdreesInc/Minecraft-Font, with documented horizontal advance correction. See `assets/java-1.21.1/provenance.json` and THIRD_PARTY_NOTICES.md. The renderer uses the same advances for alignment, layout and text.

The profile keeps `verified:false`: the reference proves the included Latin text case, not every decoration, glyph, icon, incompatible version, wrapping scenario or resource pack. Missing glyphs produce diagnostics and a fallback advance. Custom profiles supply font advances, supported glyph predicate and geometry. Modern Unicode fonts and resource packs need their own profiles and evidence.
