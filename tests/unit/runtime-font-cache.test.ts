import { expect, it } from "vitest";
import {
  createFontGlyphSource,
  decodeBitmapGlyphs,
} from "../../src/fonts/index.js";
import { RuntimeGlyphCache } from "../../src/dom/font/runtime-cache.js";
import { RuntimeFontPainter } from "../../src/dom/font/runtime.js";

const seed = decodeBitmapGlyphs(
  { height: 1, ascent: 1, chars: ["A"] },
  { width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) },
).value!.glyphs[0]!;
const paint = (
  cache: RuntimeGlyphCache,
  source: ReturnType<typeof createFontGlyphSource>["value"],
  cp: number,
) => cache.read(source!.glyphFor(cp)!);

it("owns a fixed-size cache copy instead of retaining a host buffer subview", () => {
  const base = createFontGlyphSource([
    {
      type: "bitmap",
      glyphs: {
        schemaVersion: 1,
        imageWidth: 1,
        imageHeight: 1,
        glyphs: [seed],
        pixelsFor() {
          return new Uint8Array(4);
        },
      },
    },
  ]).value!.glyphFor(65)!;
  const host = new Uint8Array(1024 * 1024);
  host.set([1, 2, 3, 4], 16);
  const glyph = {
    ...base,
    bitmap: {
      ...base.bitmap!,
      pixels: () => ({ value: host.subarray(16, 20), diagnostics: [] }),
    },
  };
  const cache = new RuntimeGlyphCache();
  const value = cache.read(glyph).value!;
  expect(value.buffer.byteLength).toBe(4);
  host.fill(9);
  expect([...cache.read(glyph).value!]).toEqual([1, 2, 3, 4]);
});

it("checks unsupported paint geometry before invoking a lazy host reader", () => {
  let reads = 0;
  const source = createFontGlyphSource([
    {
      type: "bitmap",
      glyphs: {
        schemaVersion: 1,
        imageWidth: 1,
        imageHeight: 1,
        glyphs: [seed],
        pixelsFor() {
          reads++;
          return new Uint8Array([255, 255, 255, 255]);
        },
      },
    },
  ]).value!;
  const painter = new RuntimeFontPainter(source);
  const errors = painter.paint(
    {} as HTMLElement,
    source.glyphFor(65),
    {},
    0,
    0,
    2,
    "#ffffff",
    false,
    1e8,
    { left: 0, top: 0, right: 100, bottom: 100 },
  );
  expect(errors[0]?.code).toBe("font-runtime-limit");
  expect(reads).toBe(0);
});

it("preflights the combined legacy layer storage before a host pixel read", () => {
  let reads = 0;
  const source = createFontGlyphSource([
    {
      type: "bitmap",
      glyphs: {
        schemaVersion: 1,
        imageWidth: 512,
        imageHeight: 512,
        glyphs: [{ ...seed, pixelWidth: 512, pixelHeight: 512 }],
        pixelsFor() {
          reads++;
          return new Uint8Array(512 * 512 * 4);
        },
      },
    },
  ]).value!;
  const painter = new RuntimeFontPainter(source);
  const errors = painter.paint(
    {} as HTMLElement,
    source.glyphFor(65),
    { underlined: true },
    4,
    4,
    2,
    "#ffffff",
    true,
    2,
    { left: 0, top: 0, right: 2000, bottom: 2000 },
    "java-1.21.1",
  );
  expect(errors[0]?.code).toBe("font-runtime-limit");
  expect(reads).toBe(0);
});

it("evicts raw rasters when the viewer byte budget is full and stops reads after disposal", () => {
  let reads = 0;
  const raw = new Uint8Array(512 * 512 * 4);
  const source = createFontGlyphSource([
    {
      type: "bitmap",
      glyphs: {
        schemaVersion: 1,
        imageWidth: 512,
        imageHeight: 512,
        glyphs: Array.from({ length: 9 }, (_, i) => ({
          ...seed,
          codePoint: 65 + i,
          text: String.fromCodePoint(65 + i),
          pixelWidth: 512,
          pixelHeight: 512,
        })),
        pixelsFor() {
          reads++;
          return raw;
        },
      },
    },
  ]).value!;
  const painter = new RuntimeGlyphCache();
  for (let cp = 65; cp < 74; cp++)
    expect(paint(painter, source, cp).diagnostics).toEqual([]);
  paint(painter, source, 65);
  expect(reads).toBe(10);
  painter.destroy();
  paint(painter, source, 66);
  expect(reads).toBe(10);
});

it("rejects a too-large raster before asking the host to allocate or copy it", () => {
  let reads = 0;
  const source = createFontGlyphSource([
    {
      type: "bitmap",
      glyphs: {
        schemaVersion: 1,
        imageWidth: 1024,
        imageHeight: 4096,
        glyphs: [{ ...seed, pixelWidth: 1024, pixelHeight: 4096 }],
        pixelsFor() {
          reads++;
          throw Error("must not run");
        },
      },
    },
  ]).value!;
  const painter = new RuntimeGlyphCache();
  expect(paint(painter, source, 65).diagnostics[0]?.code).toBe(
    "font-runtime-limit",
  );
  expect(reads).toBe(0);
});

it("bounds zero-byte failures by the viewer entry count and caches them between redraws", () => {
  let reads = 0;
  const glyphs = Array.from({ length: 513 }, (_, i) => ({
    ...seed,
    codePoint: 65 + i,
    text: String.fromCodePoint(65 + i),
  }));
  const source = createFontGlyphSource([
    {
      type: "bitmap",
      glyphs: {
        schemaVersion: 1,
        imageWidth: 1,
        imageHeight: 1,
        glyphs,
        pixelsFor() {
          reads++;
          return undefined;
        },
      },
    },
  ]).value!;
  const painter = new RuntimeGlyphCache();
  expect(paint(painter, source, 65).diagnostics[0]?.code).toBe(
    "font-source-raster",
  );
  paint(painter, source, 65);
  expect(reads).toBe(1);
  for (let cp = 66; cp < 578; cp++) paint(painter, source, cp);
  paint(painter, source, 65);
  expect(reads).toBe(514);
});
