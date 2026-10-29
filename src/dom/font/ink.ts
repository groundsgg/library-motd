import type { PreviewContext, TextStyle } from "../../core/model.js";
import { pixelColumns, pixelFaces, pixelTop } from "./pixels.js";

/** Custom fonts keep their own outlines and browser rendering. */
export function usesBundledPixelFont(context: PreviewContext): boolean {
  return (
    (context.assetProvider?.(context.profile)?.fontFamily ??
      context.profile.font.family) === "GroundsMinecraft"
  );
}

const caches = new WeakMap<Document, Map<string, string>>();
const paintResources = new WeakMap<
  Document,
  {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    colorContext: CanvasRenderingContext2D;
    colors: Map<string, number[]>;
  }
>();
/** Align the bitmap box to the native half-pixel-centered label origins. */
export function pixelInkOrigin(element: HTMLElement): number {
  return element.closest(
    ".mcp-version-text, .mcp-player-count-text, .mcp-button-label",
  )
    ? 4
    : 4.5;
}
/** Paint only ink; the real DOM text retains its advances and editing behavior. */
export function pixelInkStyle(
  doc: Document,
  text: string,
  style: TextStyle,
  scale: number,
  advance: number,
  color: string,
  decorationShadow = false,
  origin = 4.5,
): string | undefined {
  const rows = pixelFaces[style.bold ? 1 : 0]![text];
  if (!rows) return undefined;
  // Bound work for arbitrary embedding zoom values. Native GUI scales are small.
  scale = Math.min(16, Math.max(0.5, scale));
  const key = JSON.stringify([
    text,
    style.shadowColor,
    !!style.bold,
    !!style.italic,
    !!style.underlined,
    !!style.strikethrough,
    scale,
    advance,
    color,
    decorationShadow,
    origin,
  ]);
  let cache = caches.get(doc);
  if (!cache) caches.set(doc, (cache = new Map()));
  const previous = cache.get(key);
  if (previous) return previous;
  let resources = paintResources.get(doc);
  if (!resources) {
    const canvas = doc.createElement("canvas");
    const context = canvas.getContext("2d");
    const colorCanvas = doc.createElement("canvas");
    colorCanvas.width = colorCanvas.height = 1;
    const colorContext = colorCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!context || !colorContext) return undefined;
    resources = { canvas, context, colorContext, colors: new Map() };
    paintResources.set(doc, resources);
  }
  const { canvas, context: ctx, colorContext, colors } = resources;
  const size = Math.ceil(20 * scale);
  // U+3000 has a 16px advance (17px bold). Its decoration must fit too.
  const width = Math.ceil(Math.max(20, Math.min(64, advance + 5)) * scale);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== size) canvas.height = size;
  const image = ctx.createImageData(width, size);
  const shadowImage = ctx.createImageData(width, size);
  // Align each bitmap box with its label/MOTD origin. Integral paint positions
  // avoid browsers rounding fractional background origins in opposite directions.
  let rgb = colors.get(color);
  if (!rgb) {
    // Preserve fresh-canvas parsing: transparent/invalid colors cannot inherit ink.
    colorContext.clearRect(0, 0, 1, 1);
    colorContext.fillStyle = "#000000";
    colorContext.fillStyle = color;
    colorContext.fillRect(0, 0, 1, 1);
    rgb = [...colorContext.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    if (colors.size >= 512) colors.delete(colors.keys().next().value!);
    colors.set(color, rgb);
  }
  const argb = style.shadowColor;
  const shade =
    argb === undefined
      ? rgb.map((value) => Math.floor(value / 4))
      : [(argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255];
  const rawShadowAlpha = argb === undefined ? 255 : argb >>> 24;
  const shadowAlpha = rawShadowAlpha < 26 ? 0 : rawShadowAlpha;
  const decorated = (x: number, y: number) =>
    x >= -0.5 &&
    x < advance + 0.5 &&
    ((style.underlined && y >= 9 && y < 10) ||
      (style.strikethrough && y >= 4.5 && y < 5.5));
  for (let py = 0; py < size; py++) {
    const y = (py + 0.5) / scale - 4;
    const bits = rows[Math.floor(y) - pixelTop] ?? 0;
    // Native textured quad: shearTop/Bottom = 1 - nativeY * 0.25.
    const shear = style.italic ? 1.25 - y * 0.25 : 0;
    for (let px = 0; px < width; px++) {
      const x = (px + 0.5) / scale - origin;
      const cell = Math.floor(x - 0.5 - shear);
      const glyph = cell >= 0 && cell < pixelColumns && !!(bits & (1 << cell));
      const decoration = decorated(x, y);
      const effectShadow =
        decorationShadow && shadowAlpha > 0 && decorated(x - 1, y - 1);
      if (!glyph && !decoration && !effectShadow) continue;
      const offset = (py * width + px) * 4;
      // Native effects are drawn after glyphs: their shadow can cover glyph ink.
      image.data.set(
        [
          ...(decoration || !effectShadow
            ? rgb
            : glyph && shadowAlpha < 255
              ? shade.map((c, i) =>
                  Math.round(
                    (c * shadowAlpha) / 255 +
                      rgb![i]! * (1 - shadowAlpha / 255),
                  ),
                )
              : shade),
          glyph || decoration ? 255 : shadowAlpha,
        ],
        offset,
      );
      if (glyph || decoration)
        shadowImage.data.set([...shade, shadowAlpha], offset);
    }
  }
  ctx.putImageData(image, 0, 0);
  const foreground = canvas.toDataURL();
  ctx.putImageData(shadowImage, 0, 0);
  const shadow = canvas.toDataURL();
  const result = `font-style:normal;--mcp-ink-foreground:url("${foreground}");--mcp-ink-shadow:url("${shadow}");--mcp-ink-left:${-origin / 9}em;--mcp-ink-width:${width / 9}em;--mcp-ink-size:${size / 9}em;--mcp-ink-inverse-scale:${1 / scale}`;
  if (cache.size >= 512) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

export function applyPixelInk(
  span: HTMLElement,
  text: string,
  style: TextStyle,
  scale: number,
  advance: number,
  decorationShadow = false,
  origin = 4.5,
): void {
  const css = pixelInkStyle(
    span.ownerDocument,
    text,
    style,
    scale,
    advance,
    span.style.color || "#aaaaaa",
    decorationShadow,
    origin,
  );
  span.classList.toggle("mcp-pixel-glyph", !!css);
  span.classList.toggle("mcp-pixel-italic", !!css && !!style.italic);
  if (css) span.style.cssText += ";" + css;
  else span.style.fontStyle = style.italic ? "italic" : "normal";
}
