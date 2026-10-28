import type { FontGlyphSource, FontSourceGlyph } from "../../fonts/source.js";
import type { Diagnostic, TextStyle } from "../../core/model.js";
import { diagnostic } from "../../core/diagnostics.js";
import {
  rasterizeRuntimeGlyph,
  planRuntimeGlyph,
  runtimeLimit,
  runtimeRasterLimit,
  type RasterClip,
} from "./runtime-raster.js";

import { RuntimeGlyphCache } from "./runtime-cache.js";

/** One viewer/source lifetime. No raster or DOM state is shared between viewers. */
export class RuntimeFontPainter {
  private cache = new RuntimeGlyphCache();
  private disposed = false;
  private frameBytes = 0;
  private frameCalls = 0;
  private countReported = false;
  constructor(readonly source: FontGlyphSource) {}
  beginFrame() {
    this.frameBytes = 0;
    this.frameCalls = 0;
    this.countReported = false;
  }

  paint(
    span: HTMLElement,
    glyph: FontSourceGlyph | undefined,
    style: TextStyle,
    x: number,
    y: number,
    advance: number,
    color: string,
    shadow: boolean,
    scale: number,
    clip: RasterClip,
  ): Diagnostic[] {
    if (this.disposed || !glyph) return [];
    if (++this.frameCalls > 1024) {
      if (this.countReported) return [];
      this.countReported = true;
      return runtimeLimit().diagnostics;
    }
    const pixelBudget = Math.floor((runtimeRasterLimit - this.frameBytes) / 4);
    const planned = planRuntimeGlyph(
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
    if (!planned.value) return planned.diagnostics;
    if (!planned.value.width || !planned.value.height) return [];
    const data = this.cache.read(glyph);
    if (glyph.bitmap && !data.value) return data.diagnostics;
    const result = rasterizeRuntimeGlyph(
      glyph,
      data.value ?? undefined,
      style,
      x,
      y,
      advance,
      color,
      shadow,
      scale,
      clip,
      pixelBudget,
      planned.value,
    );
    if (!result.value) return result.diagnostics;
    const frame = result.value;
    if (!frame.width || !frame.height) return [];
    this.frameBytes += frame.pixels.byteLength;
    const canvas = span.ownerDocument.createElement("canvas"),
      ctx = canvas.getContext("2d");
    if (!ctx)
      return [
        diagnostic(
          "font-runtime-unavailable",
          "motd",
          { key: "diagnostic.fontRuntimeUnavailable" },
          "warning",
        ),
      ];
    canvas.className = "mcp-runtime-ink";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const image = ctx.createImageData(frame.width, frame.height);
    image.data.set(frame.pixels);
    ctx.putImageData(image, 0, 0);
    Object.assign(canvas.style, {
      position: "absolute",
      left: `${frame.left - x}px`,
      top: `${frame.top - y}px`,
      width: `${frame.width / scale}px`,
      height: `${frame.height / scale}px`,
      pointerEvents: "none",
    });
    span.append(canvas);
    return [];
  }
  destroy() {
    this.disposed = true;
    this.cache.destroy();
  }
}
