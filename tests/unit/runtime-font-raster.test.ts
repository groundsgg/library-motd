import { expect, it } from "vitest";
import {
  createFontGlyphSource,
  decodeBitmapGlyphs,
} from "../../src/fonts/index.js";
import { rasterizeRuntimeGlyph } from "../../src/dom/font/runtime-raster.js";

// A 7px design height, ascent 7, gives the original one-pixel cell a 7x7 quad.
const sample = (rgba: number[]) =>
  createFontGlyphSource([
    {
      type: "bitmap",
      glyphs: decodeBitmapGlyphs(
        { height: 7, ascent: 7, chars: ["A"] },
        { width: 1, height: 1, pixels: new Uint8Array(rgba) },
      ).value!,
    },
  ]).value!.glyphFor(65)!;
const clip = { left: 0, top: 0, right: 20, bottom: 20 };

it("applies the audited text alpha threshold and tint without changing source bytes", () => {
  for (const [alpha, expected] of [
    [25, 0],
    [26, 26],
    [128, 128],
    [255, 255],
  ]) {
    const g = sample([200, 100, 50, alpha]),
      pixels = g.bitmap!.pixels().value!;
    const result = rasterizeRuntimeGlyph(
      g,
      pixels,
      {},
      0,
      0,
      g.advance,
      "#ff8000",
      false,
      1,
      clip,
    );
    expect(result.diagnostics).toEqual([]);
    expect([...result.value!.pixels.subarray(0, 4)]).toEqual(
      expected ? [200, 50, 0, expected] : [0, 0, 0, 0],
    );
    expect([...pixels]).toEqual([200, 100, 50, alpha]);
  }
});

it("bounds oversized logical quads by the viewport without stretching the texture", () => {
  const g = sample([255, 255, 255, 255]);
  const result = rasterizeRuntimeGlyph(
    g,
    g.bitmap!.pixels().value!,
    {},
    0,
    0,
    g.advance,
    "#ffffff",
    false,
    2,
    { left: 0, top: 0, right: 2, bottom: 3 },
  );
  expect(result.value).toMatchObject({ width: 4, height: 6, left: 0, top: 0 });
  expect(
    [...result.value!.pixels]
      .filter((_, i) => i % 4 === 3)
      .every((a) => a === 255),
  ).toBe(true);
});

it("rejects work beyond the physical paint budget before allocation", () => {
  const g = sample([255, 255, 255, 255]);
  const result = rasterizeRuntimeGlyph(
    g,
    g.bitmap!.pixels().value!,
    {},
    0,
    0,
    g.advance,
    "#ffffff",
    false,
    1e8,
    clip,
  );
  expect(result.value).toBeNull();
  expect(result.diagnostics[0]?.code).toBe("font-runtime-limit");
});

it("honours the remaining viewer-wide pixel budget before allocating a frame", () => {
  const g = sample([255, 255, 255, 255]);
  const result = rasterizeRuntimeGlyph(
    g,
    g.bitmap!.pixels().value!,
    {},
    0,
    0,
    g.advance,
    "#ffffff",
    false,
    1,
    clip,
    0,
  );
  expect(result.value).toBeNull();
  expect(result.diagnostics[0]?.code).toBe("font-runtime-limit");
});

it("honors explicit native ARGB shadow tint and zero alpha", () => {
  const g = sample([255, 255, 255, 255]);
  for (const [shadowColor, want] of [
    [0, [0, 0, 0, 0]],
    [0x80112233, [17, 34, 51, 128]],
  ] as const) {
    const out = rasterizeRuntimeGlyph(
      g,
      g.bitmap!.pixels().value!,
      { shadowColor },
      0,
      0,
      g.advance,
      "#ffffff",
      true,
      1,
      clip,
    ).value!;
    const at = (7 * out.width + 7) * 4;
    expect([...out.pixels.slice(at, at + 4)]).toEqual(want);
  }
});

it("applies native shadow alpha discard after multiplying texture and shadow opacity", () => {
  for (const [textureAlpha, shadowAlpha, want] of [
    [255, 25, [0, 0, 0, 0]],
    [128, 26, [0, 0, 0, 0]],
    [255, 26, [17, 34, 51, 26]],
  ] as const) {
    const g = sample([255, 255, 255, textureAlpha]);
    const out = rasterizeRuntimeGlyph(
      g,
      g.bitmap!.pixels().value!,
      { shadowColor: shadowAlpha * 16777216 + 0x112233 },
      0,
      0,
      g.advance,
      "#ffffff",
      true,
      1,
      clip,
    ).value!;
    expect([
      ...out.pixels.slice((7 * out.width + 7) * 4, (7 * out.width + 7) * 4 + 4),
    ]).toEqual(want);
  }
});
