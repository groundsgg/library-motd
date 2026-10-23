"""Rebuild the OFL derivatives with fontTools 4.60.1 (maintainer task only)."""

import hashlib
import json
from pathlib import Path

from fontTools import __version__
from fontTools.pens.basePen import NullPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont


root = Path(__file__).resolve().parents[1] / "assets" / "java-1.21.1"
if __version__ != "4.60.1":
    raise RuntimeError("Install fontTools==4.60.1 to reproduce these fonts")
for suffix in ("", "-Bold"):
    font = TTFont(root / f"Minecraft{suffix}.otf", recalcTimestamp=False)
    for name, (width, bearing) in font["hmtx"].metrics.items():
        font["hmtx"][name] = (width // 2 * 2, bearing)
    top = font["CFF "].cff.topDictIndex[0]
    glyphs = font.getGlyphSet()
    charstrings = {}
    for name in font.getGlyphOrder():
        pen = T2CharStringPen(font["hmtx"][name][0], glyphs, roundTolerance=0)
        glyphs[name].draw(pen)
        charstrings[name] = pen.getCharString(
            private=top.Private, globalSubrs=top.CharStrings.globalSubrs
        )
    for name, charstring in charstrings.items():
        top.CharStrings[name] = charstring
        charstring.draw(NullPen())
        assert charstring.width == font["hmtx"][name][0], name
    font.save(root / f"GroundsPixel{suffix}.otf")

provenance_path = root / "provenance.json"
provenance = json.loads(provenance_path.read_text())
provenance["modification"] = (
    "hmtx and CFF charstring advances aligned to even font units, removing the "
    "original half-unit spacing; CFF charstrings rebuilt without glyph hints, "
    "preserving outlines; generated with tools/build-fonts.py and fontTools 4.60.1"
)
for file in provenance["files"]:
    file["sha256"] = hashlib.sha256((root / file["name"]).read_bytes()).hexdigest()
provenance_path.write_text(
    json.dumps(provenance, indent=2) + "\n", encoding="utf-8", newline="\n"
)
