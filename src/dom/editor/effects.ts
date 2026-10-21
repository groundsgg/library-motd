import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type NodeView } from "prosemirror-view";
import type { TextDocument } from "../../core/model.js";
import { flattenText, type StyledChar } from "../../core/text/colors.js";
import { resolveText } from "../../core/text/placeholders.js";
import { applyTextStyle } from "../preview.js";
import type { StylePath } from "./schema.js";
import { fromEditorNode, type EditorSourceRange } from "./mapping.js";

function decorations(
  pm: PMNode,
  previous: TextDocument,
  values: Readonly<Record<string, string>>,
): DecorationSet {
  let hasEffects = false;
  pm.descendants((node) => {
    const path = (
      node.isText
        ? node.marks.find((mark) => mark.type.name === "format")?.attrs.path
        : node.attrs.path
    ) as StylePath[] | undefined;
    if (path?.some((part) => part.style.gradient || part.style.rainbow))
      hasEffects = true;
    return !hasEffects;
  });
  if (!hasEffects) return DecorationSet.empty;
  const positions = new Map<string, EditorSourceRange>();
  const text = fromEditorNode(pm, previous, positions);
  const glyphs = flattenText(resolveText(text, values).value!);
  const result: Decoration[] = [];
  const tokens = new Map<string, StyledChar[]>();
  for (const glyph of glyphs) {
    const range = positions.get(glyph.nodeId);
    if (!range) continue;
    if (range.atom) {
      const token = tokens.get(glyph.nodeId) ?? [];
      token.push(glyph);
      tokens.set(glyph.nodeId, token);
    } else if (
      glyph.text !== "\n" &&
      (glyph.style.gradient || glyph.style.rainbow)
    ) {
      result.push(
        Decoration.inline(
          range.from + glyph.offset,
          range.from + glyph.offset + glyph.text.length,
          { class: "mce-effect-glyph", style: `color: ${glyph.color}` },
        ),
      );
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
): Plugin<DecorationSet> {
  const key = new PluginKey<DecorationSet>("motd-inline-effects");
  let composing = false;
  let destroyed = false;
  return new Plugin({
    key,
    state: {
      init: (_, state) => decorations(state.doc, text(), values),
      apply: (tr, previous) => {
        if (!composing && (tr.docChanged || tr.getMeta(key)))
          return decorations(tr.doc, text(), values);
        return previous.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations: (state) => key.getState(state),
      handleDOMEvents: {
        compositionstart() {
          composing = true;
          return false;
        },
        compositionend(view) {
          composing = false;
          queueMicrotask(() => {
            if (!destroyed) view.dispatch(view.state.tr.setMeta(key, true));
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
            span.title =
              source.type === "placeholder"
                ? `{{${source.name}}}`
                : "Protected source construct; edit in source mode";
            const glyphs = currentDecorations.flatMap(
              (decoration) =>
                (decoration.spec.effectGlyphs ?? []) as StyledChar[],
            );
            span.replaceChildren();
            if (source.type !== "placeholder" || !glyphs.length) {
              span.textContent =
                source.type === "placeholder"
                  ? (values[source.name] ?? `{{${source.name}}}`)
                  : (source.fallback ?? "[protected]");
              return;
            }
            for (const glyph of glyphs) {
              const child = span.ownerDocument.createElement("span");
              child.className = "mce-effect-glyph";
              child.textContent = glyph.text;
              applyTextStyle(child, glyph.style, glyph.color);
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
