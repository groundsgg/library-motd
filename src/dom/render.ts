import type {
  Alignment,
  Diagnostic,
  PreviewContext,
  ServerListDocument,
  TextDocument,
  TextStyle,
} from "../core/model.js";
import { layoutText } from "../core/layout/layout.js";
export interface PreviewOptions {
  document: ServerListDocument;
  context: PreviewContext;
  labels?: Readonly<Record<string, string>>;
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
  text?: string,
): HTMLElementTagNameMap[K] => {
  const e = doc.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
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
): Diagnostic[] {
  const layout = layoutText(text, {
    profile: context.profile,
    width,
    maxLines,
    alignments,
  });
  root.style.width = width + "px";
  root.style.height =
    Math.min(maxLines, layout.lines.length) * context.profile.font.lineHeight +
    "px";
  root.setAttribute("aria-label", layout.glyphs.map((g) => g.text).join(""));
  for (const glyph of layout.glyphs) {
    if (glyph.line >= maxLines) continue;
    const span = element(root.ownerDocument, "span", "mcp-glyph", glyph.text);
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
    if (glyph.style.obfuscated && glyph.text.trim()) {
      span.dataset.obfuscated = "";
      span.dataset.advance = String(glyph.advance - (glyph.style.bold ? 1 : 0));
    }
    root.append(span);
  }
  return layout.diagnostics;
}
