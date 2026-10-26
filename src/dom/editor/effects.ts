import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type NodeView } from "prosemirror-view";
import type {
  LayoutOptions,
  PreviewContext,
  TextDocument,
} from "../../core/model.js";
import { layoutText } from "../../core/layout/layout.js";
import type { StyledChar } from "../../core/text/colors.js";
import { flattenDisplayText } from "../../core/text/display.js";
import { resolveText } from "../../core/text/placeholders.js";
import { applyTextStyle } from "../preview.js";
import { shadowColor } from "../render.js";
import { pixelInkStyle, usesBundledPixelFont } from "../font/ink.js";
import { setLabelAttribute, type DomLocalization } from "../localization.js";
import type { StylePath } from "./schema.js";
import { fromEditorNode, type EditorSourceRange } from "./mapping.js";

const compositionOwners = new WeakMap<HTMLElement, object>();

interface DisplayGlyph extends StyledChar {
  // Transparent clipped text retains native caret/deletion geometry. Using
  // visibility:hidden here can make imported overflow impossible to shorten.
  hidden: boolean;
  suppressed?: boolean;
  breakBefore?: boolean;
  padding?: number;
  advance?: number;
  inkCSS?: string;
}

function decorations(
  pm: PMNode,
  previous: TextDocument,
  values: Readonly<Record<string, string>>,
  layout?: LayoutOptions,
  context?: PreviewContext,
  doc?: Document,
): DecorationSet {
  const pixelFont = context && doc && usesBundledPixelFont(context);
  let hasEffects = false;
  pm.descendants((node) => {
    const path = (
      node.isText
        ? node.marks.find((mark) => mark.type.name === "format")?.attrs.path
        : node.attrs.path
    ) as StylePath[] | undefined;
    if (
      (node.type.name === "token" &&
        node.attrs.node?.type === "opaque" &&
        node.attrs.node.format === "json") ||
      path?.some(
        (part) =>
          part.style.gradient ||
          part.style.rainbow ||
          part.style.underlined ||
          part.style.strikethrough ||
          part.style.italic,
      )
    )
      hasEffects = true;
    return !hasEffects;
  });
  if (!hasEffects && !layout && !pixelFont) return DecorationSet.empty;
  const positions = new Map<string, EditorSourceRange>();
  const text = fromEditorNode(pm, previous, positions);
  const resolved = resolveText(text, values).value!;
  const measured = layout ? layoutText(resolved, layout) : undefined;
  const dpr = doc?.defaultView?.devicePixelRatio ?? 1;
  let measuredIndex = 0,
    previousLine: number | undefined,
    explicitBreak = true;
  // Layout omits explicit newlines. Keep them in atomic placeholder display,
  // matching each non-newline grapheme with its measured visibility instead.
  const glyphs: DisplayGlyph[] = flattenDisplayText(resolved).map((glyph) => {
    const metric =
      glyph.text === "\n" ? undefined : measured?.glyphs[measuredIndex++];
    const line = metric?.line;
    const startsLine =
      line !== undefined && (line !== previousLine || explicitBreak);
    const breakBefore =
      startsLine && previousLine !== undefined && !explicitBreak;
    if (glyph.text === "\n") explicitBreak = true;
    else {
      previousLine = line;
      explicitBreak = false;
    }
    return {
      ...glyph,
      suppressed: metric?.suppressed,
      advance: metric?.advance,
      breakBefore,
      padding: startsLine ? measured?.lines[line!]?.padding : 0,
      hidden: line !== undefined && line >= (layout?.maxLines ?? 2),
      inkCSS:
        pixelFont &&
        !metric?.suppressed &&
        (line === undefined || line < (layout?.maxLines ?? 2))
          ? pixelInkStyle(
              doc,
              glyph.text === "\r" ? "?" : glyph.text,
              glyph.style,
              context.guiScale * dpr,
              metric?.advance ??
                (context.profile.font.advances[glyph.text] ??
                  context.profile.font.fallbackAdvance) +
                  (glyph.style.bold ? context.profile.font.boldOffset : 0),
              glyph.color,
              !!layout?.profile.geometry.motdShadow,
            )
          : undefined,
    };
  });
  const result: Decoration[] = [];
  const tokens = new Map<string, DisplayGlyph[]>();
  for (const glyph of glyphs) {
    const range = positions.get(glyph.nodeId);
    if (!range) continue;
    const { hidden } = glyph;
    if (range.atom) {
      const token = tokens.get(glyph.nodeId) ?? [];
      token.push(glyph);
      tokens.set(glyph.nodeId, token);
    } else {
      const pos = range.from + glyph.offset;
      const carriageReturn = glyph.text === "\r" && !!layout;
      if (glyph.breakBefore)
        result.push(
          Decoration.widget(
            pos,
            (view) => {
              const br = view.dom.ownerDocument.createElement("br");
              br.className = "mce-soft-break";
              br.setAttribute("aria-hidden", "true");
              return br;
            },
            { side: -2, ignoreSelection: true },
          ),
        );
      if (glyph.padding)
        result.push(
          Decoration.widget(
            pos,
            (view) => {
              const pad = view.dom.ownerDocument.createElement("span");
              pad.className = "mce-layout-padding";
              pad.style.width = glyph.padding + "px";
              pad.setAttribute("aria-hidden", "true");
              return pad;
            },
            { side: -1, ignoreSelection: true },
          ),
        );
      if (carriageReturn)
        result.push(
          Decoration.widget(
            pos,
            (view) => {
              const fallback = view.dom.ownerDocument.createElement("span");
              fallback.className =
                "mce-effect-glyph mce-native-glyph mce-control-fallback";
              fallback.textContent = "?";
              fallback.setAttribute("aria-hidden", "true");
              applyTextStyle(fallback, glyph.style, glyph.color);
              if (glyph.inkCSS) {
                fallback.classList.add("mcp-pixel-glyph");
                if (glyph.style.italic)
                  fallback.classList.add("mcp-pixel-italic");
                fallback.style.cssText += ";" + glyph.inkCSS;
              }
              fallback.style.width = glyph.advance + "px";
              if (hidden) fallback.style.opacity = "0";
              return fallback;
            },
            { side: -1, ignoreSelection: true },
          ),
        );
      if (
        glyph.text !== "\n" &&
        (hidden ||
          carriageReturn ||
          glyph.suppressed ||
          glyph.style.gradient ||
          glyph.style.rainbow ||
          glyph.style.underlined ||
          glyph.style.strikethrough ||
          glyph.inkCSS)
      ) {
        result.push(
          Decoration.inline(
            range.from + glyph.offset,
            range.from + glyph.offset + glyph.text.length,
            {
              class: `mce-effect-glyph mce-native-glyph${glyph.inkCSS ? ` mcp-pixel-glyph${glyph.style.italic ? " mcp-pixel-italic" : ""}` : ""}${glyph.suppressed || carriageReturn ? " mce-consumed-space" : ""}`,
              style: `color: ${glyph.color}; --mcp-shadow-color: ${shadowColor(glyph.color)};${hidden ? "opacity: 0;" : ""}${glyph.inkCSS ?? ""}`,
              ...(glyph.style.underlined ? { "data-underlined": "" } : {}),
              ...(glyph.style.strikethrough
                ? { "data-strikethrough": "" }
                : {}),
            },
          ),
        );
      }
    }
  }
  for (const [id, effectGlyphs] of tokens) {
    const range = positions.get(id)!;
    result.push(Decoration.node(range.from, range.to, {}, { effectGlyphs }));
  }
  return DecorationSet.create(pm, result);
}

/** Display-only decorations leave semantic marks, text and history untouched. */
export function inlineEffects(
  text: () => TextDocument,
  values: Readonly<Record<string, string>>,
  layout?: () => LayoutOptions,
  context?: () => PreviewContext,
  doc?: Document,
  localization?: DomLocalization,
): Plugin<DecorationSet> {
  const key = new PluginKey<DecorationSet>("motd-inline-effects");
  let composing = false;
  let destroyed = false;
  let compositionOwner: object | undefined;
  return new Plugin({
    key,
    state: {
      init: (_, state) =>
        decorations(state.doc, text(), values, layout?.(), context?.(), doc),
      apply: (tr, previous) => {
        if (
          !composing &&
          (tr.docChanged || tr.getMeta(key) || tr.getMeta("motd-layout"))
        )
          return decorations(
            tr.doc,
            text(),
            values,
            layout?.(),
            context?.(),
            doc,
          );
        return previous.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations: (state) => key.getState(state),
      handleDOMEvents: {
        compositionstart(view) {
          composing = true;
          compositionOwner = {};
          compositionOwners.set(view.dom, compositionOwner);
          view.dom.setAttribute("data-pixel-composing", "");
          return false;
        },
        compositionend(view) {
          composing = false;
          const owner = compositionOwner;
          queueMicrotask(() => {
            // Controller recovery may already have replaced this plugin. Its
            // completed marker must still clear, but never a newer preedit's.
            if (owner && compositionOwners.get(view.dom) === owner) {
              if (!destroyed && !composing)
                view.dispatch(view.state.tr.setMeta(key, true));
              compositionOwners.delete(view.dom);
              view.dom.removeAttribute("data-pixel-composing");
            }
          });
          return false;
        },
      },
      nodeViews: {
        token(node, view, _getPos, initialDecorations): NodeView {
          const span = view.dom.ownerDocument.createElement("span");
          span.className = "mce-token";
          span.contentEditable = "false";
          function render(
            next: PMNode,
            currentDecorations: readonly Decoration[],
          ) {
            const source = next.attrs.node;
            setLabelAttribute(
              span,
              "title",
              source.type === "placeholder"
                ? `{{${source.name}}}`
                : (localization?.message(
                    "protectedSourceHint",
                    "Protected source construct; edit in source mode",
                  ) ?? "Protected source construct; edit in source mode"),
            );
            const glyphs = currentDecorations.flatMap(
              (decoration) =>
                (decoration.spec.effectGlyphs ?? []) as DisplayGlyph[],
            );
            span.replaceChildren();
            span.style.opacity =
              glyphs.length && glyphs.every((glyph) => glyph.hidden) ? "0" : "";
            if (!glyphs.length) {
              span.textContent =
                source.type === "placeholder"
                  ? (values[source.name] ?? `{{${source.name}}}`)
                  : (source.fallback ?? "[protected]");
              return;
            }
            for (const glyph of glyphs) {
              if (glyph.breakBefore)
                span.append(span.ownerDocument.createElement("br"));
              if (glyph.padding) {
                const pad = span.ownerDocument.createElement("span");
                pad.className = "mce-layout-padding";
                pad.style.width = glyph.padding + "px";
                span.append(pad);
              }
              if (glyph.text === "\n") {
                span.append("\n");
                continue;
              }
              const child = span.ownerDocument.createElement("span");
              child.className = `mce-effect-glyph mce-native-glyph${glyph.suppressed ? " mce-consumed-space" : ""}`;
              child.textContent = glyph.text === "\r" ? "?" : glyph.text;
              applyTextStyle(child, glyph.style, glyph.color);
              if (glyph.inkCSS) {
                child.classList.add("mcp-pixel-glyph");
                if (glyph.style.italic) child.classList.add("mcp-pixel-italic");
                child.style.cssText += ";" + glyph.inkCSS;
              }
              if (glyph.hidden) child.style.opacity = "0";
              span.append(child);
            }
          }
          render(node, initialDecorations);
          return {
            dom: span,
            update(next, nextDecorations) {
              if (next.type !== node.type) return false;
              render(next, nextDecorations);
              return true;
            },
          };
        },
      },
    },
    view() {
      destroyed = false;
      return {
        destroy() {
          destroyed = true;
        },
      };
    },
  });
}
