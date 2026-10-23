# Third party notices

The bundled Minecraft and Minecraft-Bold fonts are by Idrees Hassan, distributed
under SIL Open Font License 1.1. The full license is included at
`assets/java-1.21.1/OFL.txt`. These are independently created fan fonts, not extracted
Mojang files. Source commit and SHA-256 hashes are recorded in `provenance.json`.

GroundsPixel and GroundsPixel-Bold are modified copies: their hmtx and CFF advance
widths are aligned to even font units to remove the original half-pixel spacing.
CFF charstrings are rebuilt without glyph hints, preserving their outlines.
`tools/build-fonts.py` reproduces the derivatives with fontTools 4.60.1. They remain
licensed under SIL OFL 1.1.

ProseMirror modules used by the optional DOM editor are MIT licensed.

Native Minecraft screenshots under tests/fixtures/client are comparison evidence, subject to Mojang/Microsoft rights and Minecraft Usage Guidelines; they are excluded from npm. assets/ui contains independently code-drawn MIT illustrations, not extracted Minecraft files.
