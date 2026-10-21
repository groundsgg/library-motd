# Client profiles and native evidence

`clientProfiles` contains Java 1.20.4, 1.21.1, 1.21.11, 26.1, 26.1.1, 26.1.2, 26.2 and 26.3. Named exports are `java1204Profile`, `java1211Profile`, `java12111Profile`, `java261Profile`, `java2611Profile`, `java2612Profile`, `java262Profile`, and `java263Profile`. Version/protocol values come from the official jars' version.json. This is a fixed release set, not a promise of automatic future-version compatibility. Custom profiles are supported.

Unmodified official clients 1.20.4, 1.21.1, 1.21.11, 26.1, 26.2 and 26.3 were launched in separate offline test sessions at 854×480, default font, GUI scale 2. They connected to a local status-only server. No account credentials were read. Versioned screenshots and hash manifests live in tests/fixtures/client. The OnlineServerEntry class files in 26.1, 26.1.1 and 26.1.2 are byte-identical; the patch releases were not separately launched.

Browser tests compare absolute foreground masks for the white server name, bold gold first MOTD line and green second line against every native capture. These included Latin cases match exactly. The uncolored red incompatible-version sample also matches in the 1.21.11/26.x references. The old 1.20.4 version-field position is outside this pixel-exact assertion. Native 1.21.1 hover confirms the white default and trailing “… and 41 more …”.

At scale 2, old row content starts at (126,72), while the selection outline starts at (122,68), size 610×72. In the modern captures the content starts at (126,74), and the outline at (122,70). Modern content width is 301 GUI pixels inside a 305-pixel selection frame; old content width is 305. Menu title, list and footer positions are profile data.

An independently created 64×64 icon matches the native displayed pixels. The transparent icon is checked after actual browser upload/crop/normalization: alpha 0,64,128,255 remains intact. Every composited pixel matches the native selected-row icon in 26.1. Unselected transparent areas expose the actual backdrop.

The bundled font is an independently recreated OFL font from IdreesInc/Minecraft-Font, with documented advance correction. See assets/java-1.21.1/provenance.json and THIRD_PARTY_NOTICES.md. All profiles keep verified:false: these references do not establish every glyph, decoration, wrapping case, resource pack or browser.

Default dirt, panorama, button and placeholder-icon graphics are original approximations, not extracted Mojang textures. The background families follow the client changes; the supplied panorama is a generic illustration, not each release's original scene. A host can supply per-version resources through context.assetProvider, including its own panorama image, button textures, fallback icon and font family. No Mojang game files are included in the npm archive. See embedding.md for configuration and rights boundaries.
