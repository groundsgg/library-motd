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
/** Paint only ink; the real DOM text retains its advances and editing behavior. */
export function italicStyle(
  doc: Document,
  text: string,
  style: TextStyle,
  scale: number,
  advance: number,
  color: string,
): string | undefined {
  const rows = pixelFaces[style.bold ? 1 : 0]![text];
  if (!style.italic || !rows) return undefined;
  // Bound work for arbitrary embedding zoom values. Native GUI scales are small.
  scale = Math.min(16, Math.max(0.5, scale));
  const key = JSON.stringify([
    text,
    !!style.bold,
    !!style.underlined,
    !!style.strikethrough,
    scale,
    advance,
    color,
  ]);
  let cache = caches.get(doc);
  if (!cache) caches.set(doc, (cache = new Map()));
  const previous = cache.get(key);
  if (previous) return previous;
  const canvas = doc.createElement("canvas");
  const size = Math.ceil(20 * scale);
  // U+3000 has a 16px advance (17px bold). Its decoration must fit too.
  const width = Math.ceil(Math.max(20, Math.min(64, advance + 5)) * scale);
  canvas.width = width;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  const image = ctx.createImageData(width, size);
  // The HTML box begins half a GUI pixel before the native draw origin.
  // An integer GUI origin prevents browsers snapping background images right.
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const rgb = [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  for (let py = 0; py < size; py++) {
    const y = (py + 0.5) / scale - 4;
    const bits = rows[Math.floor(y) - pixelTop] ?? 0;
    // Native textured quad: shearTop/Bottom = 1 - nativeY * 0.25.
    const shear = 1.25 - y * 0.25;
    for (let px = 0; px < width; px++) {
      const x = (px + 0.5) / scale - 4.5;
      const cell = Math.floor(x - 0.5 - shear);
      const glyph = cell >= 0 && cell < pixelColumns && !!(bits & (1 << cell));
      const decoration =
        x >= -0.5 &&
        x < advance + 0.5 &&
        ((style.underlined && y >= 9 && y < 10) ||
          (style.strikethrough && y >= 4.5 && y < 5.5));
      if (!glyph && !decoration) continue;
      const offset = (py * width + px) * 4;
      image.data.set([...rgb, 255], offset);
    }
  }
  ctx.putImageData(image, 0, 0);
  const foreground = canvas.toDataURL();
  for (let i = 0; i < image.data.length; i += 4)
    for (let c = 0; c < 3; c++)
      image.data[i + c] = Math.floor(image.data[i + c]! / 4);
  ctx.putImageData(image, 0, 0);
  const shadow = canvas.toDataURL();
  const result = `font-style:normal;--mcp-italic-foreground:url("${foreground}");--mcp-italic-shadow:url("${shadow}");--mcp-italic-left:-0.5em;--mcp-italic-width:${width / 9}em;--mcp-italic-size:${size / 9}em;--mcp-italic-inverse-scale:${1 / scale}`;
  if (cache.size >= 512) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

export function applyPixelItalic(
  span: HTMLElement,
  text: string,
  style: TextStyle,
  scale: number,
  advance: number,
): void {
  const css = italicStyle(
    span.ownerDocument,
    text,
    style,
    scale,
    advance,
    span.style.color || "#aaaaaa",
  );
  span.classList.toggle("mcp-pixel-italic", !!css);
  if (css) span.style.cssText += ";" + css;
}
