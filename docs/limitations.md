# Known limits

- Bundled client profiles span the selected releases 1.20.4–26.3. Six actual client captures verify included Latin text cases, and modern references cover the uncolored version sample. Full profile validation remains pending; old version-field positioning, other glyphs, custom fonts and Bedrock are not claimed pixel exact.
- Default background/icon/button illustrations approximate the client appearance. Original release panoramas and game textures are not shipped. Host-provided assets allow separate configuration; they do not by themselves establish complete pixel accuracy or redistribution permission.
- The preview wraps by glyph width. Minecraft word wrapping and complex-script shaping need additional profile work. Extra imported lines are retained and warned about; only two MOTD lines are visible.
- Gradients render per glyph in preview. While editing, CSS gradient presentation can differ slightly from the final per-glyph colors.
- Unknown MiniMessage/JSON constructs remain protected. Their visual fallback is approximate; cross-format export may require explicit reduction.
- IME-safe incremental updates are implemented, but an actual Japanese input method and Firefox have not yet been manually verified. Synthetic composition events alone are not considered proof.
- Count hover can be unreachable when players are hidden or the version is forced incompatible; diagnostics report this. Minecraft controls the final tooltip behavior.
- No automatic network ping/import or clipboard permission assumptions. The consuming application supplies transport, persistence, permissions and publication.
