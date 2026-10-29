import { diagnostic } from "../core/diagnostics.js";
import { SpritePainter } from "./sprites.js";
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
  const shadow = style.shadowColor;
  const hex =
    shadow === undefined
      ? undefined
      : (shadow >>> 0).toString(16).padStart(8, "0");
  span.style.setProperty(
    "--mcp-shadow-color",
    hex ? `#${hex.slice(2)}${hex.slice(0, 2)}` : shadowColor(fg),
  );
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
  sprites?: SpritePainter,
): Diagnostic[] {
  sprites?.clear();
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
  // Align supplied legacy rasters to the native integer drawString origin.
  // The bundled face's text box has a half-pixel horizontal bearing and starts
  // one GUI pixel higher. Fractional canvas origins also snap between engines.
  const runtimeTop =
    runtime && context.profile.font.runtimeGlyphGeometry === "java-1.21.1"
      ? 1
      : 0;
  root.style.width = width + "px";
  root.style.height =
    Math.min(maxLines, layout.lines.length) * context.profile.font.lineHeight +
    runtimeTop +
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
    span.style.left = glyph.x + (runtimeTop ? 0.5 : 0) + "px";
    span.style.top =
      glyph.line * context.profile.font.lineHeight + runtimeTop + "px";
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
    if (glyph.sprite) {
      if (!context.profile.atlasSprites) continue;
      if (sprites) sprites.paint(span, glyph, context);
      else {
        span.textContent = "";
        layout.diagnostics.push(
          diagnostic(
            "sprite-renderer-required",
            glyph.nodeId,
            { key: "diagnostic.spriteRendererRequired" },
            "warning",
          ),
        );
      }
      root.append(span);
      continue;
    }
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
          context.profile.font.runtimeGlyphGeometry,
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
