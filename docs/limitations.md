# Known limits

- Java 1.21.1 is the initial profile. The native reference covers Latin two-line text and sample-player hover. Full profile validation remains pending; custom fonts, other clients and Bedrock are not claimed pixel exact.
- The preview wraps by glyph width. Minecraft word wrapping and complex-script shaping need additional profile work. Extra imported lines are retained and warned about; only two MOTD lines are visible.
- Gradients render per glyph in preview. While editing, CSS gradient presentation can differ slightly from the final per-glyph colors.
- Unknown MiniMessage/JSON constructs remain protected. Their visual fallback is approximate; cross-format export may require explicit reduction.
- IME-safe incremental updates are implemented, but an actual Japanese input method and Firefox have not yet been manually verified. Synthetic composition events alone are not considered proof.
- Count hover can be unreachable when players are hidden or the version is forced incompatible; diagnostics report this. Minecraft controls the final tooltip behavior.
- No automatic network ping/import or clipboard permission assumptions. The consuming application supplies transport, persistence, permissions and publication.
