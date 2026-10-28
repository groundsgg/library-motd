import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  createFontGlyphSource,
  decodeBitmapGlyphs,
  decodeUnihexGlyphs,
} from "../../src/fonts/index.js";
import { runtimeGlyphQuads } from "../../src/dom/font/runtime-geometry.js";

const reference = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/client/native-runtime-geometry/26.3/manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const image = { width: 4, height: 4, pixels: new Uint8Array(64) };
for (const p of reference.inputs.bitmap.pixels)
  image.pixels.set(p.rgba, (p.y * 4 + p.x) * 4);
const bitmap = decodeBitmapGlyphs(
  reference.inputs.bitmap.definition,
  image,
).value!;
const unihex = decodeUnihexGlyphs({}, [
  new TextEncoder().encode(reference.inputs.unihex.text),
]).value!;
const sources = {
  bitmap: createFontGlyphSource([{ type: "bitmap", glyphs: bitmap }]).value!,
  unihex: createFontGlyphSource([{ type: "unihex", glyphs: unihex }]).value!,
};

it("rebuilds the original native bitmap input without any game texture", () => {
  expect(createHash("sha256").update(image.pixels).digest("hex")).toBe(
    reference.inputs.bitmap.rgbaSha256,
  );
});

for (const sample of reference.observations)
  it(`matches executed native CPU quads ${sample.provider} bold=${sample.bold} italic=${sample.italic} shadow=${sample.shadow}`, () => {
    const glyph =
      sources[sample.provider as keyof typeof sources].glyphFor(65)!;
    const quads = runtimeGlyphQuads(
      glyph,
      { bold: sample.bold, italic: sample.italic },
      reference.inputs.render.x,
      reference.inputs.render.y,
      sample.shadow,
    );
    expect(quads.flatMap((q) => q.points)).toEqual(
      sample.vertices.map((v: { xyz: number[] }) => v.xyz.slice(0, 2)),
    );
    expect(quads.map((q) => q.shadow)).toEqual(
      sample.vertices
        .filter((_: unknown, i: number) => i % 4 === 0)
        .map(
          (v: { argb: number }) =>
            v.argb === reference.inputs.render.shadowArgb,
        ),
    );
  });

it("keeps an explicit space free of textured quads", () => {
  const glyph = createFontGlyphSource([
    { type: "space", advances: { " ": 4 } },
  ]).value!.glyphFor(32)!;
  expect(runtimeGlyphQuads(glyph, { bold: true }, 0, 0, true)).toEqual([]);
});
