import type { FontProfile } from "../model.js";

/** The same undecorated metric must drive layout and obfuscation width classes. */
export function regularGlyphAdvance(font: FontProfile, text: string): number {
  return (
    font.advances[text] ??
    font.advances[text.normalize("NFC")] ??
    font.fallbackAdvance
  );
}
