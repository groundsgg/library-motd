import type { FontGlyphSource, FontSourceGlyph } from "../../fonts/source.js";
import type {
  Diagnostic,
  RuntimeGlyphGeometry,
  TextStyle,
} from "../../core/model.js";
import { diagnostic } from "../../core/diagnostics.js";
import {
  rasterizeRuntimeGlyph,
  planRuntimeGlyph,
  runtimeLimit,
  runtimeRasterLimit,
  type RasterClip,
  type RuntimeGlyphLayer,
  type RuntimeRasterPlan,
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
    geometry: RuntimeGlyphGeometry = "java-26.3",
  ): Diagnostic[] {
    if (this.disposed || !glyph) return [];
    if (++this.frameCalls > 1024) {
      if (this.countReported) return [];
      this.countReported = true;
      return runtimeLimit().diagnostics;
    }
    const legacy = geometry === "java-1.21.1";
    const order: RuntimeGlyphLayer[] = [
      "shadow-ink",
      "shadow-effects",
      "foreground-ink",
      "foreground-effects",
    ];
    const layers: (RuntimeGlyphLayer | undefined)[] = legacy
      ? shadow
        ? order
        : order.slice(2)
      : [undefined];
    const plans: {
      layer: RuntimeGlyphLayer | undefined;
      plan: RuntimeRasterPlan;
    }[] = [];
    let pixelBudget = Math.floor((runtimeRasterLimit - this.frameBytes) / 4);
    for (const layer of layers) {
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
        { geometry, layer },
      );
      if (!planned.value) return planned.diagnostics;
      if (!planned.value.width || !planned.value.height) continue;
      plans.push({ layer, plan: planned.value });
      pixelBudget -= planned.value.width * planned.value.height;
    }
    // Preflight every legacy pass before reading even the first host raster.
    if (!plans.length) return [];
    const data = this.cache.read(glyph);
    if (glyph.bitmap && !data.value) return data.diagnostics;
    span.dataset.runtimeGeometry = geometry;
    const canvases: HTMLCanvasElement[] = [];
    let committed = false;
    try {
      for (const { layer, plan } of plans) {
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
          plan,
        );
        if (!result.value) return result.diagnostics;
        const frame = result.value;
        if (!frame.width || !frame.height) return [];
        this.frameBytes += frame.pixels.byteLength;
        const canvas = span.ownerDocument.createElement("canvas");
        canvases.push(canvas);
        const ctx = canvas.getContext("2d");
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
        if (layer) {
          canvas.dataset.runtimeLayer = layer;
          canvas.style.zIndex = String(order.indexOf(layer));
        }
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
      }
      span.append(...canvases);
      committed = true;
      return [];
    } finally {
      if (!committed)
        for (const canvas of canvases) {
          canvas.width = 0;
          canvas.height = 0;
        }
    }
  }
  destroy() {
    this.disposed = true;
    this.cache.destroy();
  }
}
