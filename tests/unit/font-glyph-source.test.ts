import { expect, it } from "vitest";
import * as fonts from "../../src/fonts/index.js";
import { runInNewContext } from "node:vm";

const bitmap = (chars = "AB", pixels = [20, 40, 60, 128, 7, 8, 9, 0]) =>
  fonts.decodeBitmapGlyphs(
    { height: 1, ascent: 1, chars: [chars] },
    { width: 2, height: 1, pixels: new Uint8Array(pixels) },
  ).value!;
const unihex = () =>
  fonts.decodeUnihexGlyphs({}, [
    new TextEncoder().encode(
      "0041:" + "38".repeat(16) + "\n01F600:" + "00".repeat(16),
    ),
  ]).value!;
const compose = fonts.createFontGlyphSource;

it("pairs the selected mixed-provider metrics with lazy full-cell RGBA", () => {
  const result = compose([
    { type: "bitmap", glyphs: bitmap() },
    { type: "unihex", glyphs: unihex() },
    { type: "space", advances: { " ": 4, "\u200b": 0, "\u200c": -1.25 } },
  ]);
  expect(result.diagnostics).toEqual([]);
  const source = result.value!;
  expect(source.codePoints).toEqual([32, 65, 66, 8203, 8204, 128512]);
  const a = source.glyphFor(65)!;
  expect(a).toMatchObject({
    text: "A",
    codePoint: 65,
    advance: 2,
    boldOffset: 1,
    shadowOffset: 1,
  });
  expect(a.bitmap).toMatchObject({
    pixelWidth: 1,
    pixelHeight: 1,
    oversample: 1,
    bearingLeft: 0,
    bearingTop: 1,
  });
  expect([...a.bitmap!.pixels().value!]).toEqual([20, 40, 60, 128]);
  expect([...source.glyphFor(66)!.bitmap!.pixels().value!]).toEqual([
    7, 8, 9, 0,
  ]);
  expect(source.glyphFor(128512)).toMatchObject({
    text: "😀",
    advance: 5,
    boldOffset: 0.5,
    shadowOffset: 0.5,
    bitmap: { pixelWidth: 9, pixelHeight: 16, oversample: 2, bearingTop: 7 },
  });
  expect(source.glyphFor(32)).toMatchObject({
    advance: 4,
    boldOffset: 1,
    shadowOffset: 1,
    bitmap: null,
  });
  expect(source.glyphFor(8203)).toMatchObject({ advance: 0, bitmap: null });
  expect(source.glyphFor(8204)).toMatchObject({ advance: -1.25, bitmap: null });
  expect(source.glyphFor(67)).toBeUndefined();
  expect(source.glyphFor(0xd800)).toBeUndefined();
});

it("lets the first supplied layer win even for explicit space and transparent bitmap cells", () => {
  const blank = bitmap("AB", [1, 2, 3, 0, 4, 5, 6, 0]);
  const source = compose([
    { type: "space", advances: { A: 0 } },
    { type: "bitmap", glyphs: blank },
    { type: "unihex", glyphs: unihex() },
  ]).value!;
  expect(source.glyphFor(65)).toMatchObject({ advance: 0, bitmap: null });
  expect(source.glyphFor(66)).toMatchObject({ advance: 1, boldOffset: 1 });
  expect([...source.glyphFor(66)!.bitmap!.pixels().value!]).toEqual([
    4, 5, 6, 0,
  ]);
  const reversed = compose([
    { type: "unihex", glyphs: unihex() },
    { type: "bitmap", glyphs: blank },
  ]).value!;
  expect(reversed.glyphFor(65)).toMatchObject({ advance: 2, boldOffset: 0.5 });
});

it("never eagerly asks a decoded provider for pixels and returns independent copies", () => {
  const decoded = bitmap();
  let calls = 0;
  const shared = new Uint8Array([10, 20, 30, 40]);
  const set = {
    ...decoded,
    pixelsFor: () => {
      calls++;
      return shared;
    },
  };
  const source = compose([{ type: "bitmap", glyphs: set }]).value!;
  const glyph = source.glyphFor(65)!;
  expect(calls).toBe(0);
  expect(glyph.advance).toBe(2);
  const first = glyph.bitmap!.pixels();
  expect(first.diagnostics).toEqual([]);
  first.value!.fill(255);
  expect([...glyph.bitmap!.pixels().value!]).toEqual([10, 20, 30, 40]);
  expect([...shared]).toEqual([10, 20, 30, 40]);
  expect(calls).toBe(2);
});

it("snapshots metadata and provider methods without sharing identities across sources", () => {
  const decoded = bitmap();
  const metadata = decoded.glyphs.map((g) => ({ ...g }));
  const set = { ...decoded, glyphs: metadata };
  const layer = { type: "bitmap", glyphs: set };
  const source = compose([layer]).value!;
  const glyph = source.glyphFor(65)!;
  metadata[0]!.advance = 123;
  metadata[0]!.pixelWidth = 9000;
  set.pixelsFor = () => undefined;
  layer.type = "unihex";
  expect(glyph.advance).toBe(2);
  expect(glyph.bitmap!.pixelWidth).toBe(1);
  expect([...glyph.bitmap!.pixels().value!]).toEqual([20, 40, 60, 128]);
  expect(Object.isFrozen(source)).toBe(true);
  expect(Object.isFrozen(source.codePoints)).toBe(true);
  expect(Object.isFrozen(glyph)).toBe(true);
  expect(Object.isFrozen(glyph.bitmap)).toBe(true);
  const other = compose([
    { type: "bitmap", glyphs: bitmap("AB", [9, 8, 7, 255, 0, 0, 0, 0]) },
  ]).value!;
  expect(other.glyphFor(65)).not.toBe(glyph);
  expect([...other.glyphFor(65)!.bitmap!.pixels().value!]).toEqual([
    9, 8, 7, 255,
  ]);
});

it("normalizes scalar space advances to native float32 and preserves negative zero", () => {
  const source = compose([
    { type: "space", advances: { A: 0.1, "😀": -0 } },
  ]).value!;
  expect(source.glyphFor(65)!.advance).toBe(0.10000000149011612);
  expect(Object.is(source.glyphFor(128512)!.advance, -0)).toBe(true);
  expect(source.glyphFor(128512)!.text).toBe("😀");
  expect(compose([]).value!.codePoints).toEqual([]);
});

it.each([
  null,
  {},
  [{ type: "ttf", advances: { A: 3 } }],
  [{ type: "space", advances: null }],
  [{ type: "space", advances: { AB: 4 } }],
  [{ type: "space", advances: { "\ud800": 4 } }],
  [{ type: "space", advances: { A: Infinity } }],
  [{ type: "space", advances: { A: Number.MAX_VALUE } }],
  [{ type: "space", advances: { A: "4" } }],
  [{ type: "bitmap", glyphs: { schemaVersion: 1, glyphs: [], pixelsFor: 0 } }],
  [
    {
      type: "unihex",
      glyphs: { schemaVersion: 2, glyphs: [], pixelsFor() {} },
    },
  ],
])("rejects invalid layer inputs atomically: %j", (layers) => {
  const result = compose(layers);
  expect(result.value).toBeNull();
  expect(result.diagnostics).toMatchObject([
    {
      code: "font-source-input",
      severity: "error",
      messageKey: "diagnostic.fontSourceInput",
    },
  ]);
});

it.each([
  { codePoint: 0xd800 },
  { text: "B" },
  { advance: NaN },
  { boldOffset: -1 },
  { shadowOffset: Infinity },
  { pixelWidth: 0 },
  { pixelHeight: 1.5 },
  { oversample: 0 },
  { bearingTop: NaN },
  { bearingLeft: Infinity },
])(
  "rejects malformed raster metadata before invoking pixel providers: %j",
  (patch) => {
    const decoded = bitmap();
    let called = false;
    const result = compose([
      {
        type: "bitmap",
        glyphs: {
          ...decoded,
          glyphs: [{ ...decoded.glyphs[0], ...patch }],
          pixelsFor() {
            called = true;
            throw Error("private");
          },
        },
      },
    ]);
    expect(result.value).toBeNull();
    expect(result.diagnostics[0].code).toBe("font-source-input");
    expect(called).toBe(false);
  },
);

it("bounds all visited glyph records, including shadowed layers, before reading their values", () => {
  const decoded = bitmap();
  const badGlyphs = new Array(2);
  Object.defineProperty(badGlyphs, "0", {
    get() {
      throw Error("must not read");
    },
  });
  const result = compose(
    [
      { type: "space", advances: { A: 0 } },
      { type: "bitmap", glyphs: { ...decoded, glyphs: badGlyphs } },
    ],
    { maxGlyphs: 2 },
  );
  expect(result.value).toBeNull();
  expect(result.diagnostics).toMatchObject([
    { code: "font-source-limit", parameters: { limit: "maxGlyphs" } },
  ]);
  const spaces = Object.defineProperty({ A: 1 }, "B", {
    enumerable: true,
    get() {
      throw Error("must not read");
    },
  });
  expect(
    compose([{ type: "space", advances: spaces }], { maxGlyphs: 1 })
      .diagnostics,
  ).toMatchObject([
    { code: "font-source-limit", parameters: { limit: "maxGlyphs" } },
  ]);
  expect(compose(new Array(2), { maxProviders: 1 }).diagnostics).toMatchObject([
    { code: "font-source-limit", parameters: { limit: "maxProviders" } },
  ]);
});

it.each([
  null,
  { maxGlyphs: 0 },
  { maxProviders: 1025 },
  { maxGlyphs: 1114113 },
  { maxRasterPixels: 16777217 },
  { maxDimension: 8193 },
  { surprise: 1 },
])(
  "rejects invalid options rather than silently relaxing limits: %j",
  (limits) => {
    const result = compose([], limits);
    expect(result.value).toBeNull();
    expect(result.diagnostics[0].code).toBe("font-source-options");
  },
);

it("rejects oversized per-glyph rasters and bearings before lazy pixel work", () => {
  const decoded = bitmap();
  const create = (patch: object, limits: object) =>
    compose(
      [
        {
          type: "bitmap",
          glyphs: { ...decoded, glyphs: [{ ...decoded.glyphs[0], ...patch }] },
        },
      ],
      limits,
    );
  expect(
    create({ pixelWidth: 3, pixelHeight: 2 }, { maxRasterPixels: 5 })
      .diagnostics,
  ).toMatchObject([
    { code: "font-source-limit", parameters: { limit: "maxRasterPixels" } },
  ]);
  expect(
    create({ pixelWidth: 3 }, { maxDimension: 2 }).diagnostics,
  ).toMatchObject([
    { code: "font-source-limit", parameters: { limit: "maxDimension" } },
  ]);
  expect(
    create({ bearingTop: -3 }, { maxDimension: 2 }).diagnostics,
  ).toMatchObject([
    { code: "font-source-limit", parameters: { limit: "maxDimension" } },
  ]);
});

it.each([
  undefined,
  new Uint8Array(3),
  new Uint16Array(2),
  new DataView(new ArrayBuffer(4)),
  new Proxy(new Uint8Array(4), {}),
  "private/path.png",
])(
  "reports invalid lazy raster results without returning partial pixel data: %j",
  (bytes) => {
    const decoded = bitmap();
    const source = compose([
      { type: "bitmap", glyphs: { ...decoded, pixelsFor: () => bytes } },
    ]).value!;
    expect(source.glyphFor(65)!.bitmap!.pixels()).toMatchObject({
      value: null,
      diagnostics: [
        {
          code: "font-source-raster",
          messageKey: "diagnostic.fontSourceRaster",
        },
      ],
    });
  },
);

it("contains lazy callback exceptions and preserves provider method receivers", () => {
  const decoded = bitmap();
  const provider = {
    ...decoded,
    secret: "private-token",
    pixelsFor() {
      throw Error(this.secret);
    },
  };
  const source = compose([{ type: "bitmap", glyphs: provider }]).value!;
  expect(JSON.stringify(source.glyphFor(65)!.bitmap!.pixels())).not.toContain(
    "private-token",
  );
  expect(source.glyphFor(65)!.bitmap!.pixels().diagnostics[0].code).toBe(
    "font-source-raster",
  );
  const other = compose([
    {
      type: "bitmap",
      glyphs: {
        ...decoded,
        pixelsFor(cp: number) {
          expect(this.schemaVersion).toBe(1);
          return decoded.pixelsFor(cp);
        },
      },
    },
  ]).value!;
  expect([...other.glyphFor(65)!.bitmap!.pixels().value!]).toEqual([
    20, 40, 60, 128,
  ]);
});

it("snapshots metric getters once so later reads cannot bypass raster budgets", () => {
  const decoded = bitmap();
  let reads = 0;
  const glyph = {
    ...decoded.glyphs[0],
    get pixelWidth() {
      return ++reads === 1 ? 1 : 9000;
    },
  };
  const source = compose(
    [{ type: "bitmap", glyphs: { ...decoded, glyphs: [glyph] } }],
    { maxRasterPixels: 1 },
  ).value!;
  expect(source.glyphFor(65)!.bitmap!.pixelWidth).toBe(1);
  expect([...source.glyphFor(65)!.bitmap!.pixels().value!]).toEqual([
    20, 40, 60, 128,
  ]);
  expect(reads).toBe(1);
});

it("copies intrinsic fixed byte extents, including offset views and cross-realm inputs", () => {
  const decoded = bitmap();
  const bytes = new Uint8Array(
    new SharedArrayBuffer(8, { maxByteLength: 1024 }),
    2,
    4,
  );
  bytes.set([4, 3, 2, 1]);
  Object.defineProperty(bytes, "byteLength", {
    get() {
      (bytes.buffer as SharedArrayBuffer).grow(1024);
      return 1024;
    },
  });
  const source = compose(
    [{ type: "bitmap", glyphs: { ...decoded, pixelsFor: () => bytes } }],
    { maxRasterPixels: 1 },
  ).value!;
  expect([...source.glyphFor(65)!.bitmap!.pixels().value!]).toEqual([
    4, 3, 2, 1,
  ]);
  expect(bytes.buffer.byteLength).toBe(8);
  const foreign = runInNewContext("new Uint8Array([1,2,3,4])");
  const other = compose([
    { type: "bitmap", glyphs: { ...decoded, pixelsFor: () => foreign } },
  ]).value!;
  expect([...other.glyphFor(65)!.bitmap!.pixels().value!]).toEqual([
    1, 2, 3, 4,
  ]);
});

it("keeps U+0000 Unihex glyphs and ignores inherited space entries", () => {
  const set = fonts.decodeUnihexGlyphs({}, [
    new TextEncoder().encode("0000:" + "00".repeat(16)),
  ]).value!;
  const advances = Object.assign(Object.create({ A: 100 }), { B: 2 });
  const source = compose([
    { type: "unihex", glyphs: set },
    { type: "space", advances },
  ]).value!;
  expect(source.codePoints).toEqual([0, 66]);
  expect(source.glyphFor(0)).toMatchObject({ text: "\u0000", advance: 5 });
  expect(source.glyphFor(65)).toBeUndefined();
});

it("captures the layer array extent before accessor-driven growth", () => {
  const layers: any[] = new Array(1);
  Object.defineProperty(layers, "0", {
    get() {
      layers.push({ type: "space", advances: { B: 100 } });
      return { type: "space", advances: { A: 1 } };
    },
  });
  const source = compose(layers, { maxProviders: 1 }).value!;
  expect(source.codePoints).toEqual([65]);
});

it("captures each glyph array extent before accessor-driven growth", () => {
  const decoded = bitmap();
  const glyphs: any[] = new Array(1);
  Object.defineProperty(glyphs, "0", {
    get() {
      glyphs.push(decoded.glyphs[1]);
      return decoded.glyphs[0];
    },
  });
  const other = compose([{ type: "bitmap", glyphs: { ...decoded, glyphs } }], {
    maxGlyphs: 1,
  }).value!;
  expect(other.codePoints).toEqual([65]);
});
