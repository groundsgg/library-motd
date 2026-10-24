import type { PreviewContext } from "../core/model.js";
import {
  applyPixelInk,
  pixelInkOrigin,
  usesBundledPixelFont,
} from "./font/ink.js";
export function animateObfuscation(
  root: HTMLElement,
  context: PreviewContext,
  enabled: boolean,
): () => void {
  if (
    !enabled ||
    root.ownerDocument.defaultView?.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
  )
    return () => {};
  const glyphs = [
    ...root.querySelectorAll<HTMLElement>("[data-obfuscated]"),
  ].map((span) => ({
    span,
    style: {
      italic:
        span.classList.contains("mcp-pixel-italic") ||
        span.style.fontStyle === "italic",
      bold: span.style.fontWeight === "700",
      underlined: span.hasAttribute("data-underlined"),
      strikethrough: span.hasAttribute("data-strikethrough"),
    },
  }));
  if (!glyphs.length) return () => {};
  const pixelFont = usesBundledPixelFont(context);
  const groups = new Map<number, string[]>();
  for (const [text, width] of Object.entries(context.profile.font.advances))
    if (text.trim() && text.length === 1) {
      const group = groups.get(width) ?? [];
      group.push(text);
      groups.set(width, group);
    }
  const interval = setInterval(() => {
    for (const { span, style } of glyphs) {
      const candidates = groups.get(Number(span.dataset.advance));
      if (candidates?.length) {
        span.textContent =
          candidates[Math.floor(Math.random() * candidates.length)]!;
        if (pixelFont)
          applyPixelInk(
            span,
            span.textContent!,
            style,
            context.guiScale *
              (span.ownerDocument.defaultView?.devicePixelRatio ?? 1),
            parseFloat(span.style.width),
            !!context.profile.geometry.motdShadow &&
              !!span.closest(".mcp-motd"),
            pixelInkOrigin(span),
          );
      }
    }
  }, 80);
  return () => clearInterval(interval);
}
