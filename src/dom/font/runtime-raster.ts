import type { FontSourceGlyph } from "../../fonts/source.js";
import type {
  Outcome,
  RuntimeGlyphGeometry,
  TextStyle,
} from "../../core/model.js";
import { diagnostic } from "../../core/diagnostics.js";
import { runtimeGlyphQuads, type RuntimeQuad } from "./runtime-geometry.js";

export interface RasterClip {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface RuntimeRaster {
  width: number;
  height: number;
  left: number;
  top: number;
  pixels: Uint8ClampedArray;
}
export const runtimeRasterLimit = 8 * 1024 * 1024;
export function runtimeLimit(): Outcome<never> {
  return {
    value: null,
    diagnostics: [
      diagnostic(
        "font-runtime-limit",
        "motd",
        { key: "diagnostic.fontRuntimeLimit" },
        "warning",
      ),
    ],
  };
}

export interface RuntimeRasterPlan extends Omit<RuntimeRaster, "pixels"> {
  originX: number;
  originY: number;
  draws: (RuntimeQuad & { texture: boolean })[];
}
export type RuntimeGlyphLayer =
  "shadow-ink" | "shadow-effects" | "foreground-ink" | "foreground-effects";
export interface RuntimeRasterOptions {
  geometry?: RuntimeGlyphGeometry;
  layer?: RuntimeGlyphLayer;
}

/** Geometry and allocation preflight; never reads host pixels. */
export function planRuntimeGlyph(
  glyph: FontSourceGlyph,
  style: TextStyle,
  x: number,
  y: number,
  advance: number,
  shadow: boolean,
  scale: number,
  clip: RasterClip,
  pixelBudget = 1048576,
  options: RuntimeRasterOptions = {},
): Outcome<RuntimeRasterPlan> {
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 16)
    return runtimeLimit();
  const bitmap = glyph.bitmap;
  if (bitmap && bitmap.pixelWidth * bitmap.pixelHeight * 4 > runtimeRasterLimit)
    return runtimeLimit();
  const legacy = options.geometry === "java-1.21.1";
  let draws: (RuntimeQuad & { texture: boolean })[] = runtimeGlyphQuads(
    glyph,
    style,
    x,
    y,
    shadow,
    options.geometry,
  ).map((q) => ({ ...q, texture: true }));
  const effect = (top: number, offset: number, isShadow: boolean) => {
    const left = legacy
        ? Math.fround(Math.fround(x + offset) - 1)
        : x - 0.5 + offset,
      right = legacy
        ? Math.fround(Math.fround(x + offset) + advance)
        : x + advance + 0.5 + offset;
    const y1 = legacy
        ? Math.fround(Math.fround(y + offset) + (top + 1))
        : y + top + 1 + offset,
      y0 = legacy ? Math.fround(y1 - 1) : y + top + offset;
    draws.push({
      shadow: isShadow,
      texture: false,
      points: [
        [left, y0],
        [left, y1],
        [right, y1],
        [right, y0],
      ],
    });
  };
  for (const top of [
    ...(style.strikethrough ? [legacy ? 3.5 : 4.5] : []),
    ...(style.underlined ? [legacy ? 8 : 9] : []),
  ]) {
    if (shadow) effect(top, legacy ? 1 : glyph.shadowOffset, true);
    effect(top, 0, false);
  }
  if (options.layer) {
    const isShadow = options.layer.startsWith("shadow-"),
      texture = options.layer.endsWith("-ink");
    draws = draws.filter(
      (draw) => draw.shadow === isShadow && draw.texture === texture,
    );
  }
  const all = draws.flatMap((q) => q.points);
  if (
    ![x, y, advance, ...Object.values(clip), ...all.flat()].every(
      Number.isFinite,
    )
  )
    return runtimeLimit();
  if (!all.length)
    return {
      value: {
        width: 0,
        height: 0,
        left: 0,
        top: 0,
        originX: 0,
        originY: 0,
        draws: [],
      },
      diagnostics: [],
    };
  const left = Math.max(Math.min(...all.map((p) => p[0])), clip.left),
    top = Math.max(Math.min(...all.map((p) => p[1])), clip.top),
    right = Math.min(Math.max(...all.map((p) => p[0])), clip.right),
    bottom = Math.min(Math.max(...all.map((p) => p[1])), clip.bottom);
  if (right <= left || bottom <= top)
    return {
      value: {
        width: 0,
        height: 0,
        left,
        top,
        originX: 0,
        originY: 0,
        draws: [],
      },
      diagnostics: [],
    };
  const originX = Math.floor(left * scale),
    originY = Math.floor(top * scale);
  const width = Math.ceil(right * scale) - originX,
    height = Math.ceil(bottom * scale) - originY;
  if (
    !Number.isSafeInteger(width * height) ||
    width > 4096 ||
    height > 4096 ||
    width * height > Math.min(1048576, pixelBudget)
  )
    return runtimeLimit();
  return {
    value: {
      width,
      height,
      left: originX / scale,
      top: originY / scale,
      originX,
      originY,
      draws,
    },
    diagnostics: [],
  };
}

/** Bounded software sampling. CPU-quad verified, not GPU certified. */
export function rasterizeRuntimeGlyph(
  glyph: FontSourceGlyph,
  pixels: Uint8Array | undefined,
  style: TextStyle,
  x: number,
  y: number,
  advance: number,
  color: string,
  shadow: boolean,
  scale: number,
  clip: RasterClip,
  pixelBudget = 1048576,
  planned?: RuntimeRasterPlan,
): Outcome<RuntimeRaster> {
  const result = planned
    ? { value: planned, diagnostics: [] }
    : planRuntimeGlyph(
        glyph,
        style,
        x,
        y,
        advance,
        shadow,
        scale,
        clip,
        pixelBudget,
      );
  if (!result.value) return { value: null, diagnostics: result.diagnostics };
  const { width, height, left, top, originX, originY, draws } = result.value;
  if (!width || !height)
    return {
      value: { width, height, left, top, pixels: new Uint8ClampedArray() },
      diagnostics: [],
    };
  const bitmap = glyph.bitmap;
  if (
    bitmap &&
    (!pixels ||
      pixels.byteLength !== bitmap.pixelWidth * bitmap.pixelHeight * 4 ||
      pixels.byteLength > runtimeRasterLimit)
  )
    return runtimeLimit();
  const output = new Uint8ClampedArray(width * height * 4);
  const rgb = /^#[\da-f]{6}$/i.test(color)
    ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
    : [170, 170, 170];
  for (const draw of draws) {
    const [tl, bl, br, tr] = draw.points as [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ];
    const tint = draw.shadow ? rgb.map((c) => Math.floor(c / 4)) : rgb;
    for (let py = 0; py < height; py++) {
      const sy = (originY + py + 0.5) / scale;
      const v = (sy - tl[1]) / (bl[1] - tl[1]);
      if (v < 0 || v >= 1 || sy < clip.top || sy >= clip.bottom) continue;
      const lx = tl[0] + (bl[0] - tl[0]) * v,
        rx = tr[0] + (br[0] - tr[0]) * v;
      for (let px = 0; px < width; px++) {
        const sx = (originX + px + 0.5) / scale,
          u = (sx - lx) / (rx - lx);
        if (
          !Number.isFinite(u) ||
          u < 0 ||
          u >= 1 ||
          sx < clip.left ||
          sx >= clip.right
        )
          continue;
        let rgba = [255, 255, 255, 255];
        if (draw.texture && bitmap && pixels) {
          // Native atlas UV edges are inset by .01 source texels.
          const tx = Math.floor(0.01 + u * (bitmap.pixelWidth - 0.02)),
            ty = Math.floor(0.01 + v * (bitmap.pixelHeight - 0.02));
          const offset = (ty * bitmap.pixelWidth + tx) * 4;
          rgba = [
            pixels[offset]!,
            pixels[offset + 1]!,
            pixels[offset + 2]!,
            pixels[offset + 3]!,
          ];
          if (rgba[3]! < 26) continue; // Text shader final alpha < 0.1 is discarded.
        }
        const offset = (py * width + px) * 4,
          alpha = rgba[3]! / 255,
          previousAlpha = output[offset + 3]! / 255,
          combined = alpha + previousAlpha * (1 - alpha);
        for (let c = 0; c < 3; c++)
          output[offset + c] = Math.round(
            (((rgba[c]! * tint[c]!) / 255) * alpha +
              output[offset + c]! * previousAlpha * (1 - alpha)) /
              combined,
          );
        output[offset + 3] = Math.round(combined * 255);
      }
    }
  }
  return {
    value: {
      width,
      height,
      left: originX / scale,
      top: originY / scale,
      pixels: output,
    },
    diagnostics: [],
  };
}
