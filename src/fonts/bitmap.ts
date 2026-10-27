import { diagnostic } from "../core/diagnostics.js";
import type { DiagnosticMessage } from "../core/localization.js";
import type { Diagnostic, Outcome } from "../core/model.js";

export interface BitmapFontDefinition {
  readonly height?: number;
  readonly ascent: number;
  readonly chars: readonly string[];
}
/** Row-major, unpremultiplied RGBA. The host owns image-file decoding. */
export interface BitmapFontImage {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array | Uint8ClampedArray;
}
export interface BitmapDecodeLimits {
  maxPixels: number;
  maxGlyphs: number;
  maxDimension: number;
}
export interface BitmapGlyph {
  readonly text: string;
  readonly codePoint: number;
  readonly advance: number;
  readonly boldOffset: 1;
  readonly shadowOffset: 1;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly scale: number;
  readonly oversample: number;
  readonly bearingLeft: 0;
  readonly bearingTop: number;
  readonly sourceX: number;
  readonly sourceY: number;
  readonly inkWidth: number;
}
export interface BitmapGlyphSet {
  readonly schemaVersion: 1;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly glyphs: readonly BitmapGlyph[];
  /** Fresh full-cell RGBA copy, or undefined for an unknown code point. */
  readonly pixelsFor: (codePoint: number) => Uint8Array | undefined;
}
const defaults: BitmapDecodeLimits = {
  maxPixels: 4194304,
  maxGlyphs: 65536,
  maxDimension: 4096,
};
const ceilings: BitmapDecodeLimits = {
  maxPixels: 16777216,
  maxGlyphs: 262144,
  maxDimension: 8192,
};
class BitmapFailure extends Error {
  constructor(readonly detail: Diagnostic) {
    super(detail.message);
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function fail(
  code: string,
  path: string,
  key: DiagnosticMessage["key"],
  parameters?: DiagnosticMessage["parameters"],
): never {
  throw new BitmapFailure(diagnostic(code, path, { key, parameters }));
}
function invalid(path: string): never {
  return fail(
    "font-bitmap-definition",
    path,
    "diagnostic.fontBitmapDefinition",
  );
}

/** Decode one bitmap provider from explicitly supplied RGBA pixels; no implicit I/O. */
export function decodeBitmapGlyphs(
  definition: BitmapFontDefinition,
  image: BitmapFontImage,
  options: Partial<BitmapDecodeLimits> = {},
): Outcome<BitmapGlyphSet> {
  try {
    const limits = { ...defaults };
    if (!object(options))
      fail("font-bitmap-options", "options", "diagnostic.fontBitmapOptions");
    for (const [key, value] of Object.entries(options)) {
      if (
        !Object.hasOwn(defaults, key) ||
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > ceilings[key as keyof BitmapDecodeLimits]
      )
        fail(
          "font-bitmap-options",
          `options.${key}`,
          "diagnostic.fontBitmapOptions",
        );
      limits[key as keyof BitmapDecodeLimits] = value;
    }
    const limit = (
      name: keyof BitmapDecodeLimits,
      value: number,
      path: string,
    ) => {
      if (value > limits[name])
        fail("font-bitmap-limit", path, "diagnostic.fontBitmapLimit", {
          limit: name,
        });
    };
    if (
      !object(image) ||
      !Number.isSafeInteger(image.width) ||
      image.width <= 0 ||
      !Number.isSafeInteger(image.height) ||
      image.height <= 0
    )
      fail("font-bitmap-image", "image", "diagnostic.fontBitmapImage");
    const width = image.width,
      imageHeight = image.height;
    limit("maxDimension", width, "image.width");
    limit("maxDimension", imageHeight, "image.height");
    limit("maxPixels", width * imageHeight, "image");
    const data = image.pixels;
    if (
      !ArrayBuffer.isView(data) ||
      !["[object Uint8Array]", "[object Uint8ClampedArray]"].includes(
        Object.prototype.toString.call(data),
      ) ||
      data.byteLength !== width * imageHeight * 4
    )
      fail("font-bitmap-image", "image.pixels", "diagnostic.fontBitmapImage");
    if (!object(definition)) invalid("definition");
    const height = definition.height === undefined ? 8 : definition.height,
      ascent = definition.ascent;
    if (
      !Number.isSafeInteger(height) ||
      height <= 0 ||
      !Number.isSafeInteger(ascent) ||
      ascent > height ||
      !Array.isArray(definition.chars) ||
      definition.chars.length === 0
    )
      invalid("definition");
    limit("maxDimension", height, "definition.height");
    limit("maxDimension", Math.abs(ascent), "definition.ascent");
    const grid: string[][] = [];
    let cells = 0,
      columns: number | undefined;
    for (const row of definition.chars) {
      if (typeof row !== "string") invalid("definition.chars");
      // A scalar takes at most two UTF-16 units. Reject oversized rows before
      // materializing a code-point array, including for tiny caller budgets.
      if (row.length > 2 * (limits.maxGlyphs - cells))
        fail(
          "font-bitmap-limit",
          "definition.chars",
          "diagnostic.fontBitmapLimit",
          { limit: "maxGlyphs" },
        );
      const chars = [...row];
      if (
        chars.length === 0 ||
        (columns !== undefined && chars.length !== columns)
      )
        invalid("definition.chars");
      limit("maxGlyphs", (cells += chars.length), "definition.chars");
      if (
        chars.some((char) => {
          const cp = char.codePointAt(0)!;
          return cp >= 0xd800 && cp <= 0xdfff;
        })
      )
        invalid("definition.chars");
      columns = chars.length;
      grid.push(chars);
    }
    const pixelWidth = Math.floor(width / columns!),
      pixelHeight = Math.floor(imageHeight / grid.length);
    if (pixelWidth < 1 || pixelHeight < 1) invalid("definition.chars");
    // Own the source before metrics are measured; caller mutation cannot split ink and advances.
    const pixels = new Uint8Array(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    ).slice();
    const scale = Math.fround(height / pixelHeight),
      oversample = Math.fround(1 / scale);
    const byCodePoint = new Map<number, BitmapGlyph>();
    let duplicates = 0;
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < columns!; column++) {
        const text = grid[row]![column]!,
          codePoint = text.codePointAt(0)!;
        if (codePoint === 0) continue;
        const sourceX = column * pixelWidth,
          sourceY = row * pixelHeight;
        let inkWidth = 0;
        outer: for (let x = pixelWidth - 1; x >= 0; x--) {
          for (let y = 0; y < pixelHeight; y++) {
            if (pixels[((sourceY + y) * width + sourceX + x) * 4 + 3] !== 0) {
              inkWidth = x + 1;
              break outer;
            }
          }
        }
        if (byCodePoint.has(codePoint)) duplicates++;
        byCodePoint.set(
          codePoint,
          Object.freeze({
            text,
            codePoint,
            advance: Math.trunc(0.5 + Math.fround(inkWidth * scale)) + 1,
            boldOffset: 1,
            shadowOffset: 1,
            pixelWidth,
            pixelHeight,
            scale,
            oversample,
            bearingLeft: 0,
            bearingTop: ascent,
            sourceX,
            sourceY,
            inkWidth,
          }),
        );
      }
    }
    const glyphs = Object.freeze(
      [...byCodePoint.values()].sort((a, b) => a.codePoint - b.codePoint),
    );
    return {
      value: Object.freeze({
        schemaVersion: 1,
        imageWidth: width,
        imageHeight,
        glyphs,
        pixelsFor(codePoint: number) {
          const glyph = byCodePoint.get(codePoint);
          if (!glyph) return undefined;
          const result = new Uint8Array(pixelWidth * pixelHeight * 4);
          for (let row = 0; row < pixelHeight; row++) {
            const start = ((glyph.sourceY + row) * width + glyph.sourceX) * 4;
            result.set(
              pixels.subarray(start, start + pixelWidth * 4),
              row * pixelWidth * 4,
            );
          }
          return result;
        },
      }),
      diagnostics: duplicates
        ? [
            diagnostic(
              "font-bitmap-duplicates",
              "definition.chars",
              {
                key: "diagnostic.fontBitmapDuplicates",
                parameters: { count: duplicates },
              },
              "warning",
            ),
          ]
        : [],
    };
  } catch (error) {
    if (error instanceof BitmapFailure)
      return { value: null, diagnostics: [error.detail] };
    return {
      value: null,
      diagnostics: [
        diagnostic("font-bitmap-image", "image", {
          key: "diagnostic.fontBitmapImage",
        }),
      ],
    };
  }
}
