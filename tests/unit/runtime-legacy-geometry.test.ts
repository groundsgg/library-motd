import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createFontGlyphSource,
  decodeBitmapGlyphs,
  decodeUnihexGlyphs,
} from "../../src/fonts/index.js";
import { clientProfiles } from "../../src/profiles/clients.js";
import {
  planRuntimeGlyph,
  rasterizeRuntimeGlyph,
} from "../../src/dom/font/runtime-raster.js";

const reference = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/client/native-runtime-geometry/1.21.1/manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const image = { width: 4, height: 4, pixels: new Uint8Array(64) };
for (const pixel of reference.inputs.bitmap.pixels)
  image.pixels.set(pixel.rgba, (pixel.y * 4 + pixel.x) * 4);
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
const cases = [
  ...reference.observations.map((sample) => ({
    sample,
    render: reference.inputs.render,
  })),
  ...reference.roundingProbe.observations.map((sample) => ({
    sample,
    render: reference.roundingProbe.render,
  })),
];
for (const { sample, render } of cases)
  it(`matches native1.21.1 ${sample.provider} x=${render.x} bold=${sample.bold} italic=${sample.italic} shadow=${sample.shadow} effects=${sample.effects}`, () => {
    const glyph =
      sources[sample.provider as keyof typeof sources].glyphFor(65)!;
    expect(glyph.advance).toBe(sample.metrics.advance);
    expect(glyph.boldOffset).toBe(sample.metrics.boldOffset);
    expect(glyph.shadowOffset).toBe(sample.metrics.shadowOffset);
    const advance = sample.bold
      ? sample.metrics.boldAdvance
      : sample.metrics.advance;
    const layers = sample.shadow
      ? ["shadow-ink", "shadow-effects", "foreground-ink", "foreground-effects"]
      : ["foreground-ink", "foreground-effects"];
    const expected = [];
    // Native effect quads use BL/BR/TR/TL. Normalize to the software sampler's
    // TL/BL/BR/TR convention; preserve exact positions and pass ordering.
    for (let i = 0; i < sample.vertices.length; i += 4) {
      const vertices = sample.vertices.slice(i, i + 4);
      const effect = Math.abs((vertices[0].xyz[2] % 0.03) - 0.01) < 0.000001;
      const points = vertices.map((v: { xyz: number[] }) => v.xyz.slice(0, 2));
      expected.push({
        points: effect ? [points[3], points[0], points[1], points[2]] : points,
        shadow: vertices[0].argb === render.computedShadowArgb,
        texture: !effect,
      });
    }
    const observed = layers.flatMap((layer) =>
      [0, 1].flatMap((index) => {
        const x = Math.fround(render.x + Math.fround(index * advance));
        return planRuntimeGlyph(
          glyph,
          {
            bold: sample.bold,
            italic: sample.italic,
            underlined: sample.effects,
            strikethrough: sample.effects,
          },
          x,
          render.y,
          advance,
          sample.shadow,
          1,
          { left: -100, top: -100, right: 200, bottom: 200 },
          1048576,
          { geometry: "java-1.21.1", layer },
        ).value!.draws;
      }),
    );
    expect(observed).toEqual(expected);
  });

it("keeps native fractional shadow edges on the correct physical pixel", () => {
  const glyph = sources.unihex.glyphFor(65)!;
  const x = reference.roundingProbe.render.x,
    clip = { left: 0, top: 0, right: 20, bottom: 20 };
  const plan = planRuntimeGlyph(
    glyph,
    { underlined: true },
    x,
    0,
    2,
    true,
    1,
    clip,
    1048576,
    { geometry: "java-1.21.1", layer: "shadow-effects" },
  ).value!;
  const raster = rasterizeRuntimeGlyph(
    glyph,
    glyph.bitmap!.pixels().value!,
    { underlined: true },
    x,
    0,
    2,
    "#ffffff",
    true,
    1,
    clip,
    1048576,
    plan,
  ).value!;
  expect([...raster.pixels.slice(0, 4)]).toEqual([63, 63, 63, 255]);
});

it("opts only independently calibrated built-in profiles into runtime geometry", () => {
  expect(
    clientProfiles
      .filter((p) => p.font.runtimeGlyphGeometry)
      .map((p) => [p.id, p.font.runtimeGlyphGeometry]),
  ).toEqual([
    ["java-1.21.1", "java-1.21.1"],
    ["java-26.3", "java-26.3"],
  ]);
});
