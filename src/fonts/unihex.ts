import { diagnostic } from "../core/diagnostics.js";
import type { DiagnosticMessage } from "../core/localization.js";
import type { Diagnostic, Outcome } from "../core/model.js";
import type { UnihexSizeOverride } from "./types.js";
import { fontByteView } from "./bytes.js";

export interface UnihexFontDefinition {
  readonly sizeOverrides?: readonly UnihexSizeOverride[];
}
export interface UnihexDecodeLimits {
  maxBytes: number;
  maxFiles: number;
  maxRecords: number;
  maxOverrides: number;
}
export interface UnihexGlyph {
  readonly text: string;
  readonly codePoint: number;
  readonly bitWidth: 8 | 16 | 24 | 32;
  readonly left: number;
  readonly right: number;
  readonly pixelWidth: number;
  readonly pixelHeight: 16;
  readonly scale: 0.5;
  readonly oversample: 2;
  readonly advance: number;
  readonly boldOffset: 0.5;
  readonly shadowOffset: 0.5;
  readonly bearingLeft: 0;
  readonly bearingTop: 7;
}
export interface UnihexGlyphSet {
  readonly schemaVersion: 1;
  readonly glyphs: readonly UnihexGlyph[];
  readonly pixelsFor: (codePoint: number) => Uint8Array | undefined;
}
interface RawGlyph {
  rows: Uint32Array;
  bitWidth: UnihexGlyph["bitWidth"];
  glyph?: UnihexGlyph;
}
const defaults: UnihexDecodeLimits = {
  maxBytes: 16777216,
  maxFiles: 128,
  maxRecords: 262144,
  maxOverrides: 4096,
};
const ceilings: UnihexDecodeLimits = {
  maxBytes: 67108864,
  maxFiles: 1024,
  maxRecords: 1114112,
  maxOverrides: 65536,
};
class UnihexFailure extends Error {
  constructor(readonly detail: Diagnostic) {
    super(detail.message);
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const scalar = (cp: unknown): cp is number =>
  typeof cp === "number" &&
  Number.isInteger(cp) &&
  cp >= 0 &&
  cp <= 1114111 &&
  (cp < 0xd800 || cp > 0xdfff);
function fail(
  code: string,
  path: string,
  key: DiagnosticMessage["key"],
  parameters?: DiagnosticMessage["parameters"],
): never {
  throw new UnihexFailure(diagnostic(code, path, { key, parameters }));
}
const invalid = (path: string): never =>
  fail("font-unihex-definition", path, "diagnostic.fontUnihexDefinition");
const malformed = (path: string): never =>
  fail("font-unihex-format", path, "diagnostic.fontUnihexFormat");
function hex(byte: number): number {
  if (byte >= 48 && byte <= 57) return byte - 48;
  if (byte >= 65 && byte <= 70) return byte - 55;
  return -1;
}
function glyphSet(
  raw: Map<number, RawGlyph>,
  glyphs: UnihexGlyph[],
): UnihexGlyphSet {
  return Object.freeze({
    schemaVersion: 1,
    glyphs: Object.freeze(glyphs),
    pixelsFor(codePoint: number) {
      const entry = raw.get(codePoint),
        glyph = entry?.glyph;
      if (!entry || !glyph) return undefined;
      const result = new Uint8Array(glyph.pixelWidth * 16 * 4);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < glyph.pixelWidth; x++) {
          const column = glyph.left + x;
          // Native automatic blank bounds can include column 32; its mask is zero.
          if (column < 32 && entry.rows[y]! & (1 << (31 - column)))
            result.fill(
              255,
              (y * glyph.pixelWidth + x) * 4,
              (y * glyph.pixelWidth + x + 1) * 4,
            );
        }
      }
      return result;
    },
  });
}

/** Decode explicitly selected/extracted .hex byte streams; never extracts ZIPs or performs I/O. */
export function decodeUnihexGlyphs(
  definition: UnihexFontDefinition,
  files: readonly Uint8Array[],
  options: Partial<UnihexDecodeLimits> = {},
): Outcome<UnihexGlyphSet> {
  try {
    const limits = { ...defaults };
    if (!object(options))
      fail("font-unihex-options", "options", "diagnostic.fontUnihexOptions");
    for (const [key, value] of Object.entries(options)) {
      if (
        !Object.hasOwn(defaults, key) ||
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > ceilings[key as keyof UnihexDecodeLimits]
      )
        fail(
          "font-unihex-options",
          `options.${key}`,
          "diagnostic.fontUnihexOptions",
        );
      limits[key as keyof UnihexDecodeLimits] = value;
    }
    const limit = (
      name: keyof UnihexDecodeLimits,
      value: number,
      path: string,
    ) => {
      if (value > limits[name])
        fail("font-unihex-limit", path, "diagnostic.fontUnihexLimit", {
          limit: name,
        });
    };
    if (!object(definition)) invalid("definition");
    const overrides =
      definition.sizeOverrides === undefined ? [] : definition.sizeOverrides;
    if (!Array.isArray(overrides)) invalid("definition.sizeOverrides");
    limit("maxOverrides", overrides.length, "definition.sizeOverrides");
    const ranges: UnihexSizeOverride[] = [];
    for (const range of overrides) {
      if (
        !object(range) ||
        !scalar(range.from) ||
        !scalar(range.to) ||
        range.from >= range.to ||
        typeof range.left !== "number" ||
        typeof range.right !== "number" ||
        !Number.isInteger(range.left) ||
        !Number.isInteger(range.right) ||
        range.left < 0 ||
        range.right > 31 ||
        range.left > range.right
      )
        invalid("definition.sizeOverrides");
      ranges.push({
        from: range.from,
        to: range.to,
        left: range.left,
        right: range.right,
      });
    }
    if (!Array.isArray(files))
      fail("font-unihex-input", "files", "diagnostic.fontUnihexInput");
    const fileCount = files.length;
    limit("maxFiles", fileCount, "files");
    const selected: Uint8Array[] = [];
    let totalBytes = 0;
    for (let file = 0; file < fileCount; file++) {
      const data = fontByteView(files[file]);
      if (!data)
        fail(
          "font-unihex-input",
          `files[${file}]`,
          "diagnostic.fontUnihexInput",
        );
      limit("maxBytes", (totalBytes += data.byteLength), `files[${file}]`);
      selected.push(data);
    }
    const raw = new Map<number, RawGlyph>(),
      scratch = new Uint8Array(128);
    let records = 0,
      duplicates = 0;
    for (let file = 0; file < selected.length; file++) {
      const data = selected[file]!;
      let position = 0,
        line = 1;
      while (position < data.byteLength) {
        const path = `files[${file}].line[${line++}]`;
        limit("maxRecords", ++records, path);
        let codePoint = 0,
          digits = 0;
        while (position < data.byteLength && data[position] !== 58) {
          const digit = hex(data[position++]!);
          if (digit < 0 || ++digits > 6) malformed(path);
          codePoint = (codePoint << 4) | digit;
        }
        if (position === data.byteLength || digits < 4 || !scalar(codePoint))
          malformed(path);
        position++;
        let count = 0;
        while (position < data.byteLength && data[position] !== 10) {
          const digit = hex(data[position++]!);
          if (digit < 0 || count === 128) malformed(path);
          scratch[count++] = digit;
        }
        if (count !== 32 && count !== 64 && count !== 96 && count !== 128)
          malformed(path);
        if (position < data.byteLength) position++;
        const bitWidth = (count / 4) as UnihexGlyph["bitWidth"],
          rowDigits = bitWidth / 4,
          rows = new Uint32Array(16);
        for (let row = 0; row < 16; row++) {
          let bits = 0;
          for (let digit = 0; digit < rowDigits; digit++)
            bits = (bits << 4) | scratch[row * rowDigits + digit]!;
          rows[row] = bits << (32 - bitWidth);
        }
        if (raw.has(codePoint)) duplicates++;
        raw.set(codePoint, { rows, bitWidth });
      }
    }
    const codes = [...raw.keys()].sort((a, b) => a - b),
      left = new Uint8Array(codes.length),
      right = new Uint8Array(codes.length);
    for (let index = 0; index < codes.length; index++) {
      const entry = raw.get(codes[index]!)!;
      let mask = 0;
      for (const row of entry.rows) mask |= row;
      left[index] = mask === 0 ? 0 : Math.clz32(mask);
      right[index] = mask === 0 ? entry.bitWidth : Math.clz32(mask & -mask);
    }
    // Only present glyphs are visited; first matching override wins. A disjoint
    // successor set skips already assigned indices even for huge overlapping ranges.
    const successor = new Uint32Array(codes.length + 1);
    for (let index = 0; index <= codes.length; index++)
      successor[index] = index;
    const find = (index: number) => {
      let root = index;
      while (successor[root] !== root) root = successor[root]!;
      while (successor[index] !== index) {
        const next = successor[index]!;
        successor[index] = root;
        index = next;
      }
      return root;
    };
    const bound = (cp: number, upper: boolean) => {
      let low = 0,
        high = codes.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (codes[middle]! < cp || (upper && codes[middle] === cp))
          low = middle + 1;
        else high = middle;
      }
      return low;
    };
    for (const range of ranges) {
      const end = bound(range.to, true);
      for (
        let index = find(bound(range.from, false));
        index < end;
        index = find(index)
      ) {
        left[index] = range.left;
        right[index] = range.right;
        successor[index] = find(index + 1);
      }
    }
    const glyphs: UnihexGlyph[] = [];
    for (let index = 0; index < codes.length; index++) {
      const cp = codes[index]!,
        entry = raw.get(cp)!,
        width = right[index]! - left[index]! + 1;
      const glyph: UnihexGlyph = Object.freeze({
        text: String.fromCodePoint(cp),
        codePoint: cp,
        bitWidth: entry.bitWidth,
        left: left[index]!,
        right: right[index]!,
        pixelWidth: width,
        pixelHeight: 16,
        scale: 0.5,
        oversample: 2,
        advance: Math.floor(width / 2) + 1,
        boldOffset: 0.5,
        shadowOffset: 0.5,
        bearingLeft: 0,
        bearingTop: 7,
      });
      entry.glyph = glyph;
      glyphs.push(glyph);
    }
    return {
      value: glyphSet(raw, glyphs),
      diagnostics: duplicates
        ? [
            diagnostic(
              "font-unihex-duplicates",
              "files",
              {
                key: "diagnostic.fontUnihexDuplicates",
                parameters: { count: duplicates },
              },
              "warning",
            ),
          ]
        : [],
    };
  } catch (error) {
    if (error instanceof UnihexFailure)
      return { value: null, diagnostics: [error.detail] };
    return {
      value: null,
      diagnostics: [
        diagnostic("font-unihex-input", "files", {
          key: "diagnostic.fontUnihexInput",
        }),
      ],
    };
  }
}
