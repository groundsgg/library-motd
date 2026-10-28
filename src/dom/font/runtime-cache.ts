import type { FontSourceGlyph } from "../../fonts/source.js";
import type { Outcome } from "../../core/model.js";
import { diagnostic } from "../../core/diagnostics.js";
import { fontByteView } from "../../fonts/bytes.js";
import { runtimeLimit, runtimeRasterLimit } from "./runtime-raster.js";

/** Bounded lazy RGBA cache, owned by exactly one viewer/source lifetime. */
export class RuntimeGlyphCache {
  private entries = new Map<FontSourceGlyph, Outcome<Uint8Array>>();
  private bytes = 0;
  private disposed = false;
  read(glyph: FontSourceGlyph): Outcome<Uint8Array> {
    if (this.disposed || !glyph.bitmap) return { value: null, diagnostics: [] };
    const size = glyph.bitmap.pixelWidth * glyph.bitmap.pixelHeight * 4;
    if (!Number.isSafeInteger(size) || size <= 0 || size > runtimeRasterLimit)
      return runtimeLimit();
    const previous = this.entries.get(glyph);
    if (previous) {
      this.entries.delete(glyph);
      this.entries.set(glyph, previous);
      return previous;
    }
    const failed = (): Outcome<Uint8Array> => ({
      value: null,
      diagnostics: [
        diagnostic("font-source-raster", "motd", {
          key: "diagnostic.fontSourceRaster",
        }),
      ],
    });
    let data: Outcome<Uint8Array>;
    try {
      const result = glyph.bitmap.pixels();
      if (!result.value) data = failed();
      else {
        const bytes = fontByteView(result.value, false);
        data =
          !bytes || bytes.byteLength !== size
            ? failed()
            : { value: bytes.slice(), diagnostics: [] };
      }
    } catch {
      data = failed();
    }
    const retained = data.value?.byteLength ?? 0;
    while (
      this.entries.size >= 512 ||
      this.bytes + retained > runtimeRasterLimit
    ) {
      const first = this.entries.keys().next().value;
      if (!first) break;
      this.bytes -= this.entries.get(first)!.value?.byteLength ?? 0;
      this.entries.delete(first);
    }
    this.entries.set(glyph, data);
    this.bytes += retained;
    return data;
  }
  destroy() {
    this.disposed = true;
    this.entries.clear();
    this.bytes = 0;
  }
}
