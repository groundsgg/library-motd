import type { PreviewContext } from "../core/model.js";
import { applyPixelItalic } from "./font/italic.js";
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
  const glyphs = [...root.querySelectorAll<HTMLElement>("[data-obfuscated]")];
  if (!glyphs.length) return () => {};
  const groups = new Map<number, string[]>();
  for (const [text, width] of Object.entries(context.profile.font.advances))
    if (text.trim() && text.length === 1) {
      const group = groups.get(width) ?? [];
      group.push(text);
      groups.set(width, group);
    }
  const interval = setInterval(() => {
    for (const span of glyphs) {
      const candidates = groups.get(Number(span.dataset.advance));
      if (candidates?.length) {
        span.textContent =
          candidates[Math.floor(Math.random() * candidates.length)]!;
        if (span.classList.contains("mcp-pixel-italic"))
          applyPixelItalic(
            span,
            span.textContent!,
            {
              italic: true,
              bold: span.style.fontWeight === "700",
              underlined: span.hasAttribute("data-underlined"),
              strikethrough: span.hasAttribute("data-strikethrough"),
            },
            context.guiScale *
              (span.ownerDocument.defaultView?.devicePixelRatio ?? 1),
            parseFloat(span.style.width),
          );
      }
    }
  }, 80);
  return () => clearInterval(interval);
}
