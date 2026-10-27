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
  const view = root.ownerDocument.defaultView;
  if (!enabled || !view) return () => {};
  const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)");
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
    if ([...text].length === 1) {
      const advance = Math.ceil(width);
      const group = groups.get(advance) ?? [];
      group.push(text);
      groups.set(advance, group);
    }
  let frameId: number | undefined,
    disposed = false;
  function paint() {
    frameId = undefined;
    if (disposed || reducedMotion.matches) return;
    for (const { span, style } of glyphs) {
      const candidates = groups.get(Math.ceil(Number(span.dataset.advance)));
      if (candidates?.length) {
        span.textContent =
          candidates[Math.floor(view!.Math.random() * candidates.length)]!;
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
    frameId = view!.requestAnimationFrame(paint);
  }
  function sync() {
    if (frameId !== undefined) view!.cancelAnimationFrame(frameId);
    frameId = undefined;
    if (!disposed && !reducedMotion.matches)
      frameId = view!.requestAnimationFrame(paint);
  }
  reducedMotion.addEventListener("change", sync);
  sync();
  return () => {
    disposed = true;
    sync();
    reducedMotion.removeEventListener("change", sync);
  };
}
