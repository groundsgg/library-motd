import type { FontProfile } from "../model.js";

/** Only the measured Vanilla 4/5-pixel space pair supports this decomposition. */
export function supportsFinePadding(font: FontProfile): boolean {
  return (
    font.layout === "java-ltr" &&
    font.advances[" "] === 4 &&
    font.boldOffset === 1 &&
    font.supported(" ")
  );
}

/** Closest native advance; ties prefer the larger advance, then fewer bold spaces. */
export function nativePadding(target: number, available: number) {
  let regular = 0,
    bold = 0,
    padding = 0,
    error = Math.abs(target);
  // Four bold spaces equal five regular spaces. Larger bold counts cannot
  // improve the advance and would add unnecessary decoration transitions.
  for (let b = 0; b < 4; b++) {
    const near = (target - b * 5) / 4;
    for (const r of [Math.floor(near), Math.ceil(near)]) {
      const advance = r * 4 + b * 5;
      if (r < 0 || !Number.isFinite(advance) || advance > available) continue;
      const distance = Math.abs(advance - target);
      if (
        distance < error ||
        (distance === error &&
          (advance > padding || (advance === padding && b < bold)))
      ) {
        regular = r;
        bold = b;
        padding = advance;
        error = distance;
      }
    }
  }
  return { regular, bold, padding };
}
