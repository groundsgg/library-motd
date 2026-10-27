import { expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { decodeUnihexGlyphs } from "../../src/fonts/unihex.js";

const bytes = (source: string) => new TextEncoder().encode(source);
const record = (cp: string, row = "38") => `${cp}:${row.repeat(16)}\n`;

const native = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/client/native-unihex-provider/26.3/manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
for (const sample of native.cases)
  it(`matches executed native Unihex metrics and RGBA cells: ${sample.id}`, () => {
    const files = native.files.map((file: string) => bytes(file));
    expect(createHash("sha256").update(files[0]).digest("hex")).toBe(
      native.inputSha256,
    );
    const result = decodeUnihexGlyphs(sample.definition, files);
    expect(result.diagnostics).toEqual([]);
    expect(result.value!.glyphs).toHaveLength(sample.glyphs.length);
    for (const expected of sample.glyphs) {
      const glyph = result.value!.glyphs.find(
        (g: any) => g.codePoint === expected.metrics.codePoint,
      );
      expect(glyph).toMatchObject(expected.metrics);
      expect(
        createHash("sha256")
          .update(result.value!.pixelsFor(expected.metrics.codePoint)!)
          .digest("hex"),
      ).toBe(expected.rgbaSha256);
    }
  });

it("pairs trimmed 16-row pixels with native integer advance and half-pixel offsets", () => {
  const result = decodeUnihexGlyphs({}, [bytes(record("0041"))]);
  expect(result.diagnostics).toEqual([]);
  expect(result.value?.glyphs).toEqual([
    {
      text: "A",
      codePoint: 65,
      bitWidth: 8,
      left: 2,
      right: 4,
      pixelWidth: 3,
      pixelHeight: 16,
      scale: 0.5,
      oversample: 2,
      advance: 2,
      boldOffset: 0.5,
      shadowOffset: 0.5,
      bearingLeft: 0,
      bearingTop: 7,
    },
  ]);
  expect([...result.value!.pixelsFor(65)!.subarray(0, 12)]).toEqual(
    Array(12).fill(255),
  );
  expect(result.value!.pixelsFor(66)).toBeUndefined();
});

for (const [row, width, left, right] of [
  ["20", 8, 2, 2],
  ["3000", 16, 2, 3],
  ["180000", 24, 3, 4],
  ["0C000000", 32, 4, 5],
] as const)
  it(`decodes native ${width}-bit row alignment`, () => {
    const result = decodeUnihexGlyphs({}, [bytes(record("0041", row))]);
    expect(result.value!.glyphs[0]).toMatchObject({
      bitWidth: width,
      left,
      right,
      pixelWidth: right - left + 1,
    });
    expect([...result.value!.pixelsFor(65)!.subarray(0, 4)]).toEqual([
      255, 255, 255, 255,
    ]);
  });

for (const [row, width, advance] of [
  ["00", 9, 5],
  ["0000", 17, 9],
  ["000000", 25, 13],
  ["00000000", 33, 17],
] as const)
  it(`preserves native blank width ${width} rather than collapsing the glyph`, () => {
    const result = decodeUnihexGlyphs({}, [bytes(record("0041", row))]);
    expect(result.value!.glyphs[0]).toMatchObject({
      left: 0,
      right: width - 1,
      pixelWidth: width,
      advance,
    });
    const pixels = result.value!.pixelsFor(65)!;
    expect(pixels.length).toBe(width * 16 * 4);
    expect(pixels.every((byte: number) => byte === 0)).toBe(true);
  });

it("preserves sparse transparent pixels inside trimmed bounds", () => {
  const source = `0041:81${"00".repeat(15)}\n`;
  const font = decodeUnihexGlyphs({}, [bytes(source)]).value!;
  expect(font.glyphs[0]).toMatchObject({ left: 0, right: 7, advance: 5 });
  const rgba = font.pixelsFor(65)!;
  expect([...rgba.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
  expect([...rgba.subarray(4, 8)]).toEqual([0, 0, 0, 0]);
  expect([...rgba.subarray(28, 32)]).toEqual([255, 255, 255, 255]);
  expect([...rgba.subarray(32, 36)]).toEqual([0, 0, 0, 0]);
});

it("accepts native code-point widths, EOF and scalar zero", () => {
  const source =
    record("0000", "80") +
    record("1F600", "80") +
    record("10FFFF", "80").trimEnd();
  const result = decodeUnihexGlyphs({}, [bytes(source)]);
  expect(result.diagnostics).toEqual([]);
  expect(result.value!.glyphs.map((g: any) => [g.text, g.codePoint])).toEqual([
    ["\u0000", 0],
    ["😀", 128512],
    ["\u{10ffff}", 1114111],
  ]);
  expect(result.value!.pixelsFor(0)).toBeDefined();
});

it("uses the last record across selected files and aggregates duplicate warnings", () => {
  const result = decodeUnihexGlyphs({}, [
    bytes(record("0041", "80")),
    bytes(record("0041", "01") + record("0041", "38")),
  ]);
  expect(result.value!.glyphs).toMatchObject([
    { codePoint: 65, left: 2, right: 4, advance: 2 },
  ]);
  expect(result.diagnostics).toHaveLength(1);
  expect(result.diagnostics[0]).toMatchObject({
    code: "font-unihex-duplicates",
    severity: "warning",
    parameters: { count: 2 },
  });
});

it("applies inclusive override ranges in first-match order", () => {
  const definition = {
    sizeOverrides: [
      { from: 65, to: 66, left: 1, right: 7 },
      { from: 65, to: 67, left: 0, right: 15 },
    ],
  };
  const result = decodeUnihexGlyphs(definition, [
    bytes(
      record("0041", "80") +
        record("0042", "80") +
        record("0043", "80") +
        record("0044", "80"),
    ),
  ]);
  expect(result.value!.glyphs).toMatchObject([
    { codePoint: 65, left: 1, right: 7, pixelWidth: 7, advance: 4 },
    { codePoint: 66, left: 1, right: 7, pixelWidth: 7, advance: 4 },
    { codePoint: 67, left: 0, right: 15, pixelWidth: 16, advance: 9 },
    { codePoint: 68, left: 0, right: 0, pixelWidth: 1, advance: 1 },
  ]);
  expect(result.value!.pixelsFor(65)!.every((byte: number) => byte === 0)).toBe(
    true,
  );
});

it("only applies wide override ranges to present code points", () => {
  const sizeOverrides = Array.from({ length: 4096 }, () => ({
    from: 0,
    to: 1114111,
    left: 0,
    right: 31,
  }));
  const result = decodeUnihexGlyphs({ sizeOverrides }, [
    bytes(record("0041") + record("01F600")),
  ]);
  expect(result.diagnostics).toEqual([]);
  expect(result.value!.glyphs).toMatchObject([
    { advance: 17, pixelWidth: 32 },
    { advance: 17, pixelWidth: 32 },
  ]);
});

it("keeps parsed rows private and returns independent RGBA buffers", () => {
  const source = bytes(record("0041"));
  const font = decodeUnihexGlyphs({}, [source]).value!;
  source.fill(0);
  const first = font.pixelsFor(65)!;
  first.fill(0);
  expect([...font.pixelsFor(65)!.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
  expect(Object.isFrozen(font)).toBe(true);
  expect(Object.isFrozen(font.glyphs)).toBe(true);
  expect(Object.isFrozen(font.glyphs[0])).toBe(true);
});

it("accepts an empty selected set without claiming resource completeness", () => {
  expect(decodeUnihexGlyphs({}, []).value?.glyphs).toEqual([]);
  expect(decodeUnihexGlyphs({}, [bytes("")]).value?.glyphs).toEqual([]);
});

for (const source of [
  record("041"),
  record("0000041"),
  record("110000"),
  record("D800"),
  record("GGGG"),
  record("1f600"),
  record("0041", "ff"),
  "0041:" + "00".repeat(15) + "\n",
  "0041:" + "00".repeat(17) + "\n",
  record("0041", "0g"),
  record("0041").replace("\n", "\r\n"),
  "\n",
  "# comment\n",
  "0041",
  "0041:\n",
  "\ufeff" + record("0041"),
])
  it(`rejects malformed or unsupported source ${JSON.stringify(source).slice(0, 70)}`, () => {
    const result = decodeUnihexGlyphs({}, [bytes(source)]);
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("font-unihex-format");
  });

for (const range of [
  { from: 65, to: 65, left: 0, right: 7 },
  { from: 66, to: 65, left: 0, right: 7 },
  { from: 55296, to: 60000, left: 0, right: 7 },
  { from: 65, to: 1114112, left: 0, right: 7 },
  { from: 65, to: 66, left: -1, right: 7 },
  { from: 65, to: 66, left: 2, right: 1 },
  { from: 65, to: 66, left: 0, right: 32 },
  { from: 65, to: 66, left: 0.5, right: 7 },
])
  it("rejects unusable override geometry atomically", () => {
    const result = decodeUnihexGlyphs({ sizeOverrides: [range] }, [
      bytes(record("0041")),
    ]);
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("font-unihex-definition");
  });

for (const limits of [
  { maxBytes: 1 },
  { maxFiles: 1 },
  { maxRecords: 1 },
  { maxOverrides: 1 },
])
  it(`enforces input and expansion budgets ${JSON.stringify(limits)}`, () => {
    const result = decodeUnihexGlyphs(
      {
        sizeOverrides: [
          { from: 0, to: 1, left: 0, right: 7 },
          { from: 0, to: 1, left: 0, right: 7 },
        ],
      },
      [bytes(record("0041")), bytes(record("0041"))],
      limits,
    );
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("font-unihex-limit");
  });

for (const limits of [
  { maxBytes: 0 },
  { maxRecords: Infinity },
  { maxFiles: -1 },
  { maxOverrides: 65537 },
  { future: 1 },
])
  it("rejects invalid configured limits", () => {
    expect(decodeUnihexGlyphs({}, [], limits).diagnostics[0]?.code).toBe(
      "font-unihex-options",
    );
  });

it("accepts byte buffers from another realm", () => {
  const data = runInNewContext(
    `new Uint8Array(${JSON.stringify([...bytes(record("0041"))])})`,
  );
  expect(decodeUnihexGlyphs({}, [data]).value!.glyphs[0]).toMatchObject({
    advance: 2,
  });
});

it("rejects non-byte input and null overrides without throwing", () => {
  expect(
    decodeUnihexGlyphs({}, [new Uint16Array(4)]).diagnostics[0]?.code,
  ).toBe("font-unihex-input");
  expect(
    decodeUnihexGlyphs({ sizeOverrides: null }, []).diagnostics[0]?.code,
  ).toBe("font-unihex-definition");
});

it("does not expand its validated byte extent if a source view grows", () => {
  const small = bytes(record("0041")),
    large = bytes(record("0041") + record("0042"));
  const buffer = new SharedArrayBuffer(small.length, {
      maxByteLength: large.length,
    }),
    data = new Uint8Array(buffer);
  data.set(small);
  const actualLength = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(Uint8Array.prototype),
    "byteLength",
  )!.get!;
  let reads = 0;
  Object.defineProperty(data, "byteLength", {
    get() {
      if (++reads === 2) {
        buffer.grow(large.length);
        data.set(large);
      }
      return actualLength.call(data);
    },
  });
  const result = decodeUnihexGlyphs({}, [data], { maxBytes: small.length });
  expect(result.diagnostics).toEqual([]);
  expect(result.value!.glyphs.map((g: any) => g.codePoint)).toEqual([65]);
});

it("keeps selected files fixed between validation and parsing", () => {
  const small = bytes(record("0041")),
    large = bytes(record("0041") + record("0042"));
  const files = [small];
  let reads = 0;
  Object.defineProperty(files, 0, {
    get() {
      return ++reads === 1 ? small : large;
    },
  });
  const result = decodeUnihexGlyphs({}, files, { maxBytes: small.length });
  expect(result.diagnostics).toEqual([]);
  expect(result.value!.glyphs.map((g: any) => g.codePoint)).toEqual([65]);
});

it("keeps an earlier selected extent fixed when a later file grows its real backing buffer", () => {
  const small = bytes(record("0041")),
    large = bytes(record("0041") + record("0042"));
  const shared = new SharedArrayBuffer(small.length, {
    maxByteLength: large.length,
  });
  const tracking = new Uint8Array(shared);
  tracking.set(small);
  const empty = new Uint8Array(),
    files = [tracking, empty];
  Object.defineProperty(files, 1, {
    get() {
      shared.grow(large.length);
      tracking.set(large);
      return empty;
    },
  });
  const result = decodeUnihexGlyphs({}, files, { maxBytes: small.length });
  expect(shared.byteLength).toBe(large.length);
  expect(result.diagnostics).toEqual([]);
  expect(result.value!.glyphs.map((g: any) => g.codePoint)).toEqual([65]);
});

it("validates real byte storage rather than tags or lengths on instances", () => {
  const data = bytes(record("0041"));
  Object.defineProperty(data, "byteLength", { value: 1 });
  expect(
    decodeUnihexGlyphs({}, [data], { maxBytes: 1 }).diagnostics[0]?.code,
  ).toBe("font-unihex-limit");
  const floating = new Float32Array(10);
  new Uint8Array(floating.buffer).set(bytes(record("000041")));
  Object.defineProperty(floating, Symbol.toStringTag, { value: "Uint8Array" });
  expect(decodeUnihexGlyphs({}, [floating as any]).diagnostics[0]?.code).toBe(
    "font-unihex-input",
  );
});
