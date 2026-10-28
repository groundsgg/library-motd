import { createDocument, parseText } from "../../src/index.js";
import {
  createFontGlyphSource,
  decodeBitmapGlyphs,
  decodeUnihexGlyphs,
} from "../../src/fonts/index.js";

// Original synthetic letter shapes, not extracted game assets.
const pixels = new Uint8Array(5 * 8 * 4);
for (const [y, row] of [14, 17, 17, 31, 17, 17, 17, 0].entries())
  for (let x = 0; x < 5; x++)
    if (row & (1 << (4 - x))) pixels.set([255, 255, 255, 255], (y * 5 + x) * 4);
const bitmap = decodeBitmapGlyphs(
  { height: 8, ascent: 7, chars: ["A"] },
  { width: 5, height: 8, pixels },
).value!;
const unihex = decodeUnihexGlyphs({}, [
  new TextEncoder().encode(
    "0042:" +
      "7C".repeat(2) +
      "42".repeat(4) +
      "7C".repeat(2) +
      "42".repeat(6) +
      "7C".repeat(2),
  ),
]).value!;
export const runtimeFontExample = createFontGlyphSource([
  { type: "bitmap", glyphs: bitmap },
  { type: "unihex", glyphs: unihex },
  { type: "space", advances: { " ": 4 } },
]).value!;
export const runtimeFontDocument = createDocument(
  parseText(
    "<aqua>AB <b>AB</b></aqua><newline><gold><i>AB</i> <u>AB</u></gold>",
    "minimessage",
  ).value!,
);
