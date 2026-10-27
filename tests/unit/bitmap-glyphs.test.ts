import { expect, it } from "vitest";
import { decodeBitmapGlyphs } from "../../src/fonts/bitmap.js";
import { runInNewContext } from "node:vm";

// Original synthetic, unpremultiplied RGBA data. No game image is used.
const atlas = (width = 8, height = 4) => ({
  width,
  height,
  pixels: new Uint8Array(width * height * 4),
});
const set = (
  image: ReturnType<typeof atlas>,
  x: number,
  y: number,
  rgba: number[],
) => image.pixels.set(rgba, (y * image.width + x) * 4);
const definition = { height: 8, ascent: 7, chars: ["AB"] };

it("pairs native bitmap advances with full RGBA cells including partial transparency", () => {
  const image = atlas();
  set(image, 0, 0, [231, 45, 19, 1]);
  set(image, 3, 1, [255, 255, 255, 0]); // RGB in a transparent pixel is not ink.
  set(image, 6, 2, [5, 100, 220, 128]);
  const result = decodeBitmapGlyphs(definition, image);
  expect(result.diagnostics).toEqual([]);
  expect(result.value?.glyphs).toMatchObject([
    {
      text: "A",
      codePoint: 65,
      advance: 3,
      boldOffset: 1,
      shadowOffset: 1,
      pixelWidth: 4,
      pixelHeight: 4,
      scale: 2,
      oversample: 0.5,
      bearingLeft: 0,
      bearingTop: 7,
      sourceX: 0,
      sourceY: 0,
      inkWidth: 1,
    },
    {
      text: "B",
      codePoint: 66,
      advance: 7,
      sourceX: 4,
      sourceY: 0,
      inkWidth: 3,
    },
  ]);
  const a = result.value!.pixelsFor(65)!,
    b = result.value!.pixelsFor(66)!;
  expect([...a.subarray(0, 4)]).toEqual([231, 45, 19, 1]);
  expect([...a.subarray(28, 32)]).toEqual([255, 255, 255, 0]);
  expect([...b.subarray(40, 44)]).toEqual([5, 100, 220, 128]);
  expect(result.value!.pixelsFor(67)).toBeUndefined();
});

it("uses float32 scaling and native advance rounding", () => {
  const image = atlas(3, 3);
  set(image, 2, 2, [255, 255, 255, 255]);
  const glyph = decodeBitmapGlyphs(
    { height: 5, ascent: 4, chars: ["A"] },
    image,
  ).value!.glyphs[0]!;
  expect(glyph).toMatchObject({
    advance: 6,
    scale: 1.6666666269302368,
    oversample: 0.6000000238418579,
  });
});

it("preserves blank-cell advance and ignores U+0000 without shifting the grid", () => {
  const image = atlas(6, 2);
  set(image, 0, 0, [255, 255, 255, 255]);
  set(image, 4, 0, [2, 3, 4, 255]);
  const result = decodeBitmapGlyphs(
    { height: 2, ascent: 2, chars: ["\u0000A😀"] },
    image,
  );
  expect(result.value!.glyphs).toMatchObject([
    { text: "A", advance: 1, inkWidth: 0, sourceX: 2 },
    { text: "😀", codePoint: 128512, advance: 2, sourceX: 4 },
  ]);
  expect(result.value!.pixelsFor(0)).toBeUndefined();
  expect([...result.value!.pixelsFor(128512)!.subarray(0, 4)]).toEqual([
    2, 3, 4, 255,
  ]);
});

it("uses the last duplicate cell and reports a bounded aggregate warning", () => {
  const image = atlas(4, 2);
  set(image, 0, 0, [255, 0, 0, 255]);
  set(image, 3, 0, [0, 255, 0, 255]);
  const result = decodeBitmapGlyphs(
    { height: 2, ascent: 2, chars: ["AA"] },
    image,
  );
  expect(result.value!.glyphs).toMatchObject([
    { text: "A", sourceX: 2, advance: 3 },
  ]);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({
    code: "font-bitmap-duplicates",
    severity: "warning",
    parameters: { count: 1 },
  });
  expect([...result.value!.pixelsFor(65)!.subarray(4, 8)]).toEqual([
    0, 255, 0, 255,
  ]);
});

it("uses integer cell division and excludes leftover image edges", () => {
  const image = atlas(5, 5);
  set(image, 4, 4, [255, 255, 255, 255]);
  const result = decodeBitmapGlyphs(
    { height: 2, ascent: 2, chars: ["AB", "CD"] },
    image,
  );
  expect(result.value!.glyphs.map((g: any) => g.advance)).toEqual([1, 1, 1, 1]);
  expect(result.value!.glyphs[3]).toMatchObject({
    sourceX: 2,
    sourceY: 2,
    pixelWidth: 2,
    pixelHeight: 2,
  });
});

it("snapshots source pixels and returns independent pixel buffers", () => {
  const image = atlas(1, 1);
  set(image, 0, 0, [1, 2, 3, 128]);
  const spec = { height: 1, ascent: 1, chars: ["A"] };
  const font = decodeBitmapGlyphs(spec, image).value!;
  image.pixels.fill(0);
  spec.chars[0] = "B";
  const first = font.pixelsFor(65)!;
  first.fill(99);
  expect([...font.pixelsFor(65)!]).toEqual([1, 2, 3, 128]);
  expect(font.glyphs[0]).toMatchObject({ text: "A", advance: 2 });
  expect(Object.isFrozen(font)).toBe(true);
  expect(Object.isFrozen(font.glyphs)).toBe(true);
  expect(Object.isFrozen(font.glyphs[0])).toBe(true);
});

for (const spec of [
  { height: 0, ascent: 0, chars: ["A"] },
  { height: -1, ascent: -1, chars: ["A"] },
  { height: null, ascent: 1, chars: ["A"] },
  { ascent: 9, chars: ["A"] },
  { ascent: -9000, chars: ["A"] },
  { ascent: 1, chars: [] },
  { ascent: 1, chars: [""] },
  { ascent: 1, chars: ["AB", "C"] },
  { ascent: 1, chars: ["\ud800"] },
  { ascent: 1, chars: ["ABC"] },
])
  it(`rejects malformed or unusable glyph geometry ${JSON.stringify(spec)}`, () => {
    const result = decodeBitmapGlyphs(spec, atlas(2, 2));
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]?.severity).toBe("error");
  });

for (const image of [
  { width: 0, height: 1, pixels: new Uint8Array() },
  { width: -1, height: 1, pixels: new Uint8Array() },
  { width: 1.5, height: 1, pixels: new Uint8Array(6) },
  { width: 1, height: 1, pixels: new Uint8Array(3) },
  { width: 1, height: 1, pixels: [255, 255, 255, 255] },
  { width: 1, height: 1, pixels: new Float32Array(4) },
])
  it("rejects invalid RGBA dimensions and storage", () => {
    const result = decodeBitmapGlyphs({ ascent: 7, chars: ["A"] }, image);
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("font-bitmap-image");
  });

for (const limits of [{ maxPixels: 3 }, { maxGlyphs: 1 }, { maxDimension: 1 }])
  it(`bounds allocation and scanning with ${JSON.stringify(limits)}`, () => {
    const result = decodeBitmapGlyphs(
      { height: 2, ascent: 2, chars: ["AB"] },
      atlas(2, 2),
      limits,
    );
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("font-bitmap-limit");
  });

it("counts reserved and duplicate cells towards the glyph limit", () => {
  const result = decodeBitmapGlyphs(
    { height: 1, ascent: 1, chars: ["\u0000AA"] },
    atlas(3, 1),
    { maxGlyphs: 2 },
  );
  expect(result.diagnostics[0]?.code).toBe("font-bitmap-limit");
});

for (const limits of [
  { maxPixels: 0 },
  { maxPixels: Infinity },
  { maxGlyphs: -1 },
  { maxDimension: 8193 },
  { future: 1 },
])
  it("rejects invalid decoding limits", () => {
    expect(
      decodeBitmapGlyphs(definition, atlas(), limits).diagnostics[0]?.code,
    ).toBe("font-bitmap-options");
  });

it("accepts clamped and cross-realm RGBA byte arrays", () => {
  for (const pixels of [
    new Uint8ClampedArray([1, 2, 3, 255]),
    runInNewContext("new Uint8Array([1,2,3,255])"),
  ]) {
    const result = decodeBitmapGlyphs(
      { height: 1, ascent: 1, chars: ["A"] },
      { width: 1, height: 1, pixels },
    );
    expect([...result.value!.pixelsFor(65)!]).toEqual([1, 2, 3, 255]);
  }
});
