import type { FontSourceGlyph } from "../../fonts/source.js";
import type { RuntimeGlyphGeometry, TextStyle } from "../../core/model.js";

export interface RuntimeQuad {
  /** Native TL, BL, BR, TR order, logical GUI coordinates. */
  points: [number, number][];
  shadow: boolean;
}
const f = Math.fround;

export function isRuntimeGlyphGeometry(
  value: unknown,
): value is RuntimeGlyphGeometry {
  return value === "java-1.21.1" || value === "java-26.3";
}

/** Executed version-specific CPU geometry; does not certify GPU sampling. */
export function runtimeGlyphQuads(
  glyph: FontSourceGlyph,
  style: TextStyle,
  x: number,
  y: number,
  shadow: boolean,
  geometry: RuntimeGlyphGeometry = "java-26.3",
): RuntimeQuad[] {
  const offsets = glyph;
  const bitmap = glyph.bitmap;
  if (!bitmap) return [];
  x = f(x);
  y = f(y);
  const left = f(bitmap.bearingLeft),
    right = f(left + f(bitmap.pixelWidth / bitmap.oversample));
  const up = f(7 - bitmap.bearingTop),
    down = f(up + f(bitmap.pixelHeight / bitmap.oversample));
  const shearTop = style.italic ? f(1 - f(up * 0.25)) : 0;
  const shearBottom = style.italic ? f(1 - f(down * 0.25)) : 0;
  const legacy = geometry === "java-1.21.1";
  const thick = style.bold && !legacy ? f(0.1) : 0;
  const quads: RuntimeQuad[] = [];
  const emit = (ox: number, oy: number, shadow: boolean) => {
    const l = f(ox + left),
      r = f(ox + right),
      t = f(oy + up),
      b = f(oy + down);
    quads.push({
      shadow,
      points: [
        [f(f(l + shearTop) - thick), f(t - thick)],
        [f(f(l + shearBottom) - thick), f(b + thick)],
        [f(f(r + shearBottom) + thick), f(b + thick)],
        [f(f(r + shearTop) + thick), f(t - thick)],
      ],
    });
  };
  if (shadow) {
    emit(f(x + offsets.shadowOffset), f(y + offsets.shadowOffset), true);
    if (style.bold)
      emit(
        legacy
          ? f(f(x + offsets.shadowOffset) + offsets.boldOffset)
          : f(f(x + offsets.boldOffset) + offsets.shadowOffset),
        f(y + offsets.shadowOffset),
        true,
      );
  }
  emit(x, y, false);
  if (style.bold) emit(f(x + offsets.boldOffset), y, false);
  return quads;
}
