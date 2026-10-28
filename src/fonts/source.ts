import { diagnostic } from "../core/diagnostics.js";
import type { DiagnosticMessage } from "../core/localization.js";
import type { Diagnostic, Outcome } from "../core/model.js";
import type { BitmapGlyphSet } from "./bitmap.js";
import type { UnihexGlyphSet } from "./unihex.js";
import { fontByteView } from "./bytes.js";

/** Host-supplied precedence, highest first. No resource-stack discovery is implied. */
export type FontGlyphLayer =
  | { readonly type: "bitmap"; readonly glyphs: BitmapGlyphSet }
  | { readonly type: "unihex"; readonly glyphs: UnihexGlyphSet }
  | {
      readonly type: "space";
      readonly advances: Readonly<Record<string, number>>;
    };
export interface FontSourceBitmap {
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly oversample: number;
  readonly bearingLeft: number;
  readonly bearingTop: number;
  /** Fresh unpremultiplied RGBA, or a controlled diagnostic. No retained raster cache. */
  readonly pixels: () => Outcome<Uint8Array>;
}
export interface FontSourceGlyph {
  readonly codePoint: number;
  readonly text: string;
  readonly advance: number;
  readonly boldOffset: number;
  readonly shadowOffset: number;
  /** Space providers explicitly have no raster; transparent bitmaps retain theirs. */
  readonly bitmap: FontSourceBitmap | null;
}
export interface FontGlyphSource {
  readonly schemaVersion: 1;
  readonly codePoints: readonly number[];
  readonly glyphFor: (codePoint: number) => FontSourceGlyph | undefined;
  /** Explicit selected-source width classes; no native FontSet filtering is implied. */
  readonly randomGlyphFor?: (
    advance: number,
    random: number,
  ) => FontSourceGlyph | undefined;
}
export interface FontSourceLimits {
  maxProviders: number;
  /** All visited entries, including glyphs hidden by an earlier layer. */
  maxGlyphs: number;
  /** Maximum pixels in each lazy raster, not a total atlas budget. */
  maxRasterPixels: number;
  /** Pixel dimensions and absolute bearings. */
  maxDimension: number;
}
const defaults: FontSourceLimits = {
  maxProviders: 128,
  maxGlyphs: 262144,
  maxRasterPixels: 4194304,
  maxDimension: 4096,
};
const ceilings: FontSourceLimits = {
  maxProviders: 1024,
  maxGlyphs: 1114112,
  maxRasterPixels: 16777216,
  maxDimension: 8192,
};
class SourceFailure extends Error {
  constructor(readonly detail: Diagnostic) {
    super(detail.message);
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const scalar = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 1114111 &&
  (value < 0xd800 || value > 0xdfff);
function fail(
  code: string,
  path: string,
  key: DiagnosticMessage["key"],
  parameters?: DiagnosticMessage["parameters"],
): never {
  throw new SourceFailure(diagnostic(code, path, { key, parameters }));
}
function invalid(path: string): never {
  return fail("font-source-input", path, "diagnostic.fontSourceInput");
}

/** Compose paired local glyph data without selecting files, decoding images or doing I/O. */
export function createFontGlyphSource(
  layers: readonly FontGlyphLayer[],
  options: Partial<FontSourceLimits> = {},
): Outcome<FontGlyphSource> {
  try {
    const limits = { ...defaults };
    if (!object(options))
      fail("font-source-options", "options", "diagnostic.fontSourceOptions");
    for (const [key, value] of Object.entries(options)) {
      if (
        !Object.hasOwn(defaults, key) ||
        !Number.isSafeInteger(value) ||
        typeof value !== "number" ||
        value < 1 ||
        value > ceilings[key as keyof FontSourceLimits]
      )
        fail(
          "font-source-options",
          `options.${key}`,
          "diagnostic.fontSourceOptions",
        );
      limits[key as keyof FontSourceLimits] = value;
    }
    const bound = (
      key: keyof FontSourceLimits,
      value: number,
      path: string,
    ) => {
      if (value > limits[key])
        fail("font-source-limit", path, "diagnostic.fontSourceLimit", {
          limit: key,
        });
    };
    if (!Array.isArray(layers)) invalid("layers");
    const layerCount = layers.length;
    bound("maxProviders", layerCount, "layers");
    const selected = new Map<number, FontSourceGlyph>();
    let records = 0;
    for (let index = 0; index < layerCount; index++) {
      const layer = layers[index],
        path = `layers.${index}`;
      if (!object(layer)) invalid(path);
      const type = layer.type;
      if (type === "space") {
        const advances = layer.advances;
        if (!object(advances)) invalid(`${path}.advances`);
        // Do not allocate Object.entries over a host-supplied, unbounded key set.
        for (const text in advances) {
          if (!Object.hasOwn(advances, text)) continue;
          bound("maxGlyphs", ++records, `${path}.advances`);
          const codePoint = text.codePointAt(0),
            value = advances[text];
          if (
            !scalar(codePoint) ||
            String.fromCodePoint(codePoint) !== text ||
            !finite(value) ||
            !Number.isFinite(Math.fround(value))
          )
            invalid(`${path}.advances`);
          if (!selected.has(codePoint))
            selected.set(
              codePoint,
              Object.freeze({
                codePoint,
                text,
                advance: Math.fround(value),
                boldOffset: 1,
                shadowOffset: 1,
                bitmap: null,
              }),
            );
        }
        continue;
      }
      if (type !== "bitmap" && type !== "unihex") invalid(`${path}.type`);
      const set = layer.glyphs;
      if (!object(set) || set.schemaVersion !== 1) invalid(`${path}.glyphs`);
      const glyphs = set.glyphs,
        read = set.pixelsFor;
      if (!Array.isArray(glyphs) || typeof read !== "function")
        invalid(`${path}.glyphs`);
      const glyphCount = glyphs.length;
      bound("maxGlyphs", (records += glyphCount), `${path}.glyphs`);
      for (let i = 0; i < glyphCount; i++) {
        const entry: unknown = glyphs[i],
          glyphPath = `${path}.glyphs.${i}`;
        if (!object(entry)) invalid(glyphPath);
        // Read once: a later accessor evaluation cannot change validated geometry.
        const {
          codePoint,
          text,
          advance,
          boldOffset,
          shadowOffset,
          pixelWidth,
          pixelHeight,
          oversample,
          bearingLeft,
          bearingTop,
        } = entry;
        if (
          !scalar(codePoint) ||
          text !== String.fromCodePoint(codePoint) ||
          !finite(advance) ||
          !finite(boldOffset) ||
          boldOffset < 0 ||
          !finite(shadowOffset) ||
          shadowOffset < 0 ||
          !finite(pixelWidth) ||
          !Number.isSafeInteger(pixelWidth) ||
          pixelWidth <= 0 ||
          !finite(pixelHeight) ||
          !Number.isSafeInteger(pixelHeight) ||
          pixelHeight <= 0 ||
          !finite(oversample) ||
          oversample <= 0 ||
          !finite(bearingLeft) ||
          !finite(bearingTop)
        )
          invalid(glyphPath);
        bound("maxDimension", pixelWidth, glyphPath);
        bound("maxDimension", pixelHeight, glyphPath);
        bound("maxDimension", Math.abs(bearingLeft), glyphPath);
        bound("maxDimension", Math.abs(bearingTop), glyphPath);
        bound("maxRasterPixels", pixelWidth * pixelHeight, glyphPath);
        if (selected.has(codePoint)) continue;
        const bitmap: FontSourceBitmap = Object.freeze({
          pixelWidth,
          pixelHeight,
          oversample,
          bearingLeft,
          bearingTop,
          pixels(): Outcome<Uint8Array> {
            try {
              const bytes = fontByteView(read.call(set, codePoint), true);
              if (bytes && bytes.byteLength === pixelWidth * pixelHeight * 4)
                return { value: bytes.slice(), diagnostics: [] };
            } catch {
              // Host callback details can contain private resource paths or tokens.
            }
            return {
              value: null,
              diagnostics: [
                diagnostic("font-source-raster", glyphPath, {
                  key: "diagnostic.fontSourceRaster",
                }),
              ],
            };
          },
        });
        selected.set(
          codePoint,
          Object.freeze({
            codePoint,
            text,
            advance,
            boldOffset,
            shadowOffset,
            bitmap,
          }),
        );
      }
    }
    let groups: Map<number, FontSourceGlyph[]> | undefined;
    return {
      value: Object.freeze({
        schemaVersion: 1,
        codePoints: Object.freeze([...selected.keys()].sort((a, b) => a - b)),
        glyphFor: (codePoint: number) => selected.get(codePoint),
        randomGlyphFor(advance: number, random: number) {
          if (
            !Number.isFinite(advance) ||
            !Number.isFinite(random) ||
            random < 0 ||
            random >= 1
          )
            return undefined;
          if (!groups) {
            groups = new Map();
            for (const glyph of [...selected.values()].sort(
              (a, b) => a.codePoint - b.codePoint,
            )) {
              const key = Math.ceil(glyph.advance),
                pool = groups.get(key) ?? [];
              pool.push(glyph);
              groups.set(key, pool);
            }
          }
          const pool = groups.get(Math.ceil(advance));
          return pool?.[Math.floor(random * pool.length)];
        },
      }),
      diagnostics: [],
    };
  } catch (error) {
    return {
      value: null,
      diagnostics: [
        error instanceof SourceFailure
          ? error.detail
          : diagnostic("font-source-input", "layers", {
              key: "diagnostic.fontSourceInput",
            }),
      ],
    };
  }
}
