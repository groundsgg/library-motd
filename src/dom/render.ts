import type {
  Alignment,
  Diagnostic,
  PreviewContext,
  ServerListDocument,
  TextDocument,
  TextStyle,
} from "../core/model.js";
import { layoutText } from "../core/layout/layout.js";
import { regularGlyphAdvance } from "../core/layout/metrics.js";
import {
  applyPixelInk,
  pixelInkOrigin,
  usesBundledPixelFont,
} from "./font/ink.js";
import { appendLabelText, type LabelText } from "./localization.js";
import type { FontGlyphSource } from "../fonts/source.js";
import type { RuntimeFontPainter } from "./font/runtime.js";
export interface PreviewOptions {
  document: ServerListDocument;
  context: PreviewContext;
  labels?: Readonly<Record<string, string>>;
  /** Optional runtime MOTD font; never saved in the document or used by the editor. */
  motdFontSource?: FontGlyphSource;
}
export interface PreviewHandle {
  update(options: PreviewOptions): void;
  destroy(): void;
  getDiagnostics(): readonly Diagnostic[];
}
export function entryTextWidth(context: PreviewContext): number {
  const g = context.profile.geometry;
  const width = Math.max(
    140,
    Math.min(
      g.rowWidth,
      context.viewportWidth / Math.max(0.5, context.guiScale),
    ),
  );
  return (
    Math.min(width, g.contentWidth ?? width) -
    g.iconSize -
    g.iconGap -
    g.rightInset
  );
}
export const element = <K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: LabelText,
): HTMLElementTagNameMap[K] => {
  const e = doc.createElement(tag);
  e.className = className;
  if (text !== undefined) appendLabelText(e, text);
  return e;
};
export function shadowColor(color: string): string {
  return (
    "#" +
    [1, 3, 5]
      .map((p) =>
        Math.floor(parseInt(color.slice(p, p + 2), 16) / 4)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function applyTextStyle(
  span: HTMLElement,
  style: TextStyle,
  color?: string,
): void {
  const fg = color ?? style.color ?? "#aaaaaa";
  span.style.color = fg;
  span.style.setProperty("--mcp-shadow-color", shadowColor(fg));
  span.style.textShadow =
    "var(--mcp-shadow-offset, 0px 0px) var(--mcp-shadow-color)";
  span.style.fontWeight = style.bold ? "700" : "400";
  span.style.fontStyle = style.italic ? "italic" : "normal";
  span.toggleAttribute("data-underlined", !!style.underlined);
  span.toggleAttribute("data-strikethrough", !!style.strikethrough);
}
export function renderText(
  root: HTMLElement,
  text: TextDocument,
  context: PreviewContext,
  width: number,
  maxLines = 2,
  alignments?: Alignment[],
  defaultColor?: string,
  runtime?: RuntimeFontPainter,
): Diagnostic[] {
  runtime?.beginFrame();
  const layout = layoutText(text, {
    profile: context.profile,
    width,
    maxLines,
    alignments,
    fontSource: runtime?.source,
    obfuscationRandom:
      runtime && context.animations
        ? () => root.ownerDocument.defaultView?.Math.random() ?? 0
        : undefined,
  });
  root.style.width = width + "px";
  root.style.height =
    Math.min(maxLines, layout.lines.length) * context.profile.font.lineHeight +
    "px";
  root.setAttribute("aria-label", layout.glyphs.map((g) => g.text).join(""));
  const pixelFont = usesBundledPixelFont(context);
  const pixelScale =
    context.guiScale * (root.ownerDocument.defaultView?.devicePixelRatio ?? 1);
  for (const glyph of layout.glyphs) {
    if (glyph.suppressed || glyph.line >= maxLines) continue;
    const span = element(
      root.ownerDocument,
      "span",
      "mcp-glyph",
      glyph.text === "\r" && !runtime ? "?" : glyph.text,
    );
    span.style.left = glyph.x + "px";
    span.style.top = glyph.line * context.profile.font.lineHeight + "px";
    span.style.width = glyph.advance + "px";
    applyTextStyle(
      span,
      glyph.style,
      defaultColor &&
        !glyph.style.color &&
        !glyph.style.gradient &&
        !glyph.style.rainbow
        ? defaultColor
        : glyph.color,
    );
    if (runtime) {
      span.classList.add("mcp-runtime-glyph");
      layout.diagnostics.push(
        ...runtime.paint(
          span,
          glyph.fontGlyph,
          glyph.style,
          glyph.x,
          glyph.line * context.profile.font.lineHeight,
          glyph.advance,
          span.style.color.startsWith("#")
            ? span.style.color
            : defaultColor &&
                !glyph.style.color &&
                !glyph.style.gradient &&
                !glyph.style.rainbow
              ? defaultColor
              : glyph.color,
          !!context.profile.geometry.motdShadow,
          pixelScale,
          {
            left: -1,
            top: 0,
            right: width,
            bottom: maxLines * context.profile.font.lineHeight + 2,
          },
        ),
      );
    } else if (pixelFont)
      applyPixelInk(
        span,
        span.textContent!,
        glyph.style,
        pixelScale,
        glyph.advance,
        !!context.profile.geometry.motdShadow &&
          root.classList.contains("mcp-motd"),
        pixelInkOrigin(root),
      );
    if (!runtime && glyph.style.obfuscated && glyph.text !== " ") {
      span.dataset.obfuscated = "";
      span.dataset.advance = String(
        regularGlyphAdvance(context.profile.font, glyph.text),
      );
    }
    root.append(span);
  }
  return layout.diagnostics;
}
