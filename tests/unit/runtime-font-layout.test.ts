import { expect, it } from "vitest";
import {
  createDocument,
  java263Profile,
  layoutText,
  parseText,
  evaluateStatus,
} from "../../src/index.js";
import {
  createFontGlyphSource,
  decodeBitmapGlyphs,
  decodeUnihexGlyphs,
} from "../../src/fonts/index.js";

const bitmap = decodeBitmapGlyphs(
  { height: 1, ascent: 1, chars: ["A"] },
  { width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) },
).value!;
const unihex = decodeUnihexGlyphs({}, [
  new TextEncoder().encode("0042:" + "38".repeat(16)),
]).value!;
const fontSource = createFontGlyphSource([
  { type: "bitmap", glyphs: bitmap },
  { type: "unihex", glyphs: unihex },
  { type: "space", advances: { " ": 1.5, e: 1, "\u0301": 0, "😀": 3 } },
]).value!;
const text = (value: string) => parseText(value, "minimessage").value!;
const layout = (value: string, width = 100) =>
  layoutText(text(value), { profile: java263Profile, width, fontSource });

it("uses each selected provider's bold advance without reading raster bytes", () => {
  const result = layout("<b>AB");
  expect(result.glyphs.map((g) => g.advance)).toEqual([3, 2.5]);
  expect(result.glyphs.map((g) => g.x)).toEqual([0, 3]);
  expect(result.glyphs[0]!.fontGlyph).toBe(fontSource.glyphFor(65));
  expect(result.lines[0]!.width).toBe(5.5);
  expect(result.diagnostics).toEqual([]);
});

it("uses scalar lookup without NFC and retains supplementary UTF-16 source offsets", () => {
  const result = layout("Ae\u0301😀B");
  expect(
    result.glyphs.map((g) => [g.text, g.position, g.offset, g.advance]),
  ).toEqual([
    ["A", 0, 0, 2],
    ["e", 1, 1, 1],
    ["\u0301", 2, 2, 0],
    ["😀", 3, 3, 3],
    ["B", 5, 5, 2],
  ]);
  expect(result.diagnostics).toEqual([]);
  const legacy = layoutText(text("e\u0301"), {
    profile: java263Profile,
    width: 100,
  });
  expect(legacy.glyphs).toHaveLength(1);
});

it("wraps on imported space metrics and keeps the suppressed source mapping", () => {
  const result = layout("AB AB", 6);
  expect(result.lines.map((l) => l.width)).toEqual([4, 4]);
  expect(result.glyphs.map((g) => [g.text, g.line, !!g.suppressed])).toEqual([
    ["A", 0, false],
    ["B", 0, false],
    [" ", 0, true],
    ["A", 1, false],
    ["B", 1, false],
  ]);
});

it("uses imported space advances when aligning and materializing native output", () => {
  const d = createDocument(text("A B"));
  d.motd.alignments = ["right"];
  const result = layoutText(d.motd.text, {
    profile: java263Profile,
    width: 10,
    alignments: d.motd.alignments,
    fontSource,
  });
  expect(result.lines).toEqual([{ width: 5.5, padding: 4.5, spaceCount: 3 }]);
  const status = evaluateStatus(d, {
    base: { version: { protocol: 1, name: "test" }, description: "" },
    clientProtocol: 1,
    values: {},
    motdLayout: { profile: java263Profile, width: 10, fontSource },
  });
  const description = status.value!.description as {
    extra: { text: string }[];
  };
  expect(description.extra.map((c) => c.text).join("")).toBe("   A B");
});

it("accumulates scalar advances at native float32 precision before wrapping", () => {
  const source = createFontGlyphSource([
    { type: "space", advances: { A: 16777216, B: 1, C: 1 } },
  ]).value!;
  const result = layoutText(text("ABC"), {
    profile: java263Profile,
    width: 16777216,
    fontSource: source,
  });
  expect(result.lines).toEqual([{ width: 16777216, padding: 0 }]);
  expect(result.glyphs.map((g) => g.x)).toEqual([0, 16777216, 16777216]);
});

it("reports absent source glyphs even when the normal profile supports them", () => {
  const result = layout("AZ");
  expect(result.diagnostics.some((d) => d.code === "missing-glyph")).toBe(true);
  expect(result.glyphs[1]!.advance).toBe(6);
});

it("does not report supplied glyphs as missing because of the old profile", () => {
  const profile = {
    ...java263Profile,
    font: { ...java263Profile.font, supported: () => false },
  };
  const result = layoutText(text("A"), { profile, width: 100, fontSource });
  expect(result.diagnostics).toEqual([]);
});

it("preserves zero and negative advances as explicit blank glyphs", () => {
  const source = createFontGlyphSource([
    { type: "space", advances: { A: -2, B: 0, C: 3 } },
  ]).value!;
  const result = layoutText(text("ABC"), {
    profile: java263Profile,
    width: 100,
    fontSource: source,
  });
  expect(result.glyphs.map((g) => [g.advance, g.x])).toEqual([
    [-2, 0],
    [0, -2],
    [3, -2],
  ]);
  expect(result.lines[0]!.width).toBe(1);
  expect(result.diagnostics).toEqual([]);
});

it("lays out a selected obfuscation candidate using that provider's real metrics", () => {
  const result = layoutText(text("<obf><b>A"), {
    profile: java263Profile,
    width: 100,
    fontSource,
    obfuscationRandom: () => 0.99,
  });
  expect(result.glyphs[0]!.fontGlyph?.codePoint).toBe(66);
  expect(result.glyphs[0]!.advance).toBe(2.5);
  expect(result.glyphs[0]!.text).toBe("A");
});

it("does not synthesize alignment from a missing imported space glyph", () => {
  const fontSource = createFontGlyphSource([
    { type: "bitmap", glyphs: bitmap },
  ]).value!;
  const result = layoutText(text("A"), {
    profile: java263Profile,
    width: 10,
    alignments: ["right"],
    fontSource,
  });
  expect(result.lines).toEqual([{ width: 2, padding: 0 }]);
  expect(
    result.diagnostics.some((d) => d.code === "alignment-unavailable"),
  ).toBe(true);
});

it("bounds materialized alignment when an imported space has a subnormal advance", () => {
  const fontSource = createFontGlyphSource([
    { type: "space", advances: { A: 2, " ": 1e-40 } },
  ]).value!;
  const d = createDocument(text("A"));
  d.motd.alignments = ["right"];
  const result = layoutText(d.motd.text, {
    profile: java263Profile,
    width: 10,
    alignments: ["right"],
    fontSource,
  });
  expect(result.lines[0]!.padding).toBe(0);
  expect(
    result.diagnostics.some((d) => d.code === "font-runtime-alignment-limit"),
  ).toBe(true);
  const status = evaluateStatus(d, {
    base: { version: { protocol: 1, name: "test" }, description: "" },
    clientProtocol: 1,
    values: {},
    motdLayout: { profile: java263Profile, width: 10, fontSource },
  });
  expect(JSON.stringify(status.value!.description).length).toBeLessThan(1000);
});

it("retains the exact emitted space count after float32 prefix accumulation", () => {
  const fontSource = createFontGlyphSource([
    { type: "space", advances: { A: 2, " ": 0.1 } },
  ]).value!;
  const d = createDocument(text("A"));
  d.motd.alignments = ["right"];
  const status = evaluateStatus(d, {
    base: { version: { protocol: 1, name: "test" }, description: "" },
    clientProtocol: 1,
    values: {},
    motdLayout: { profile: java263Profile, width: 1002, fontSource },
  });
  const description = status.value!.description as {
    extra: { text: string }[];
  };
  expect(description.extra.filter((p) => p.text === " ")).toHaveLength(9999);
});
