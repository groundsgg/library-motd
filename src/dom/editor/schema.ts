import { Schema } from "prosemirror-model";
import type { TextStyle } from "../../core/model.js";
import { applyTextStyle } from "../preview.js";
import { setLabelAttribute, type DomLocalization } from "../localization.js";
export interface StylePath {
  id: string;
  style: TextStyle;
}
export function editorSchema(
  doc: Document,
  values: Readonly<Record<string, string>>,
  localization?: DomLocalization,
): Schema {
  return new Schema({
    nodes: {
      doc: { content: "paragraph+" },
      paragraph: {
        content: "inline*",
        group: "block",
        attrs: { breakPath: { default: [] } },
        toDOM: () => ["p", 0],
        parseDOM: [{ tag: "p" }, { tag: "div" }],
      },
      text: { group: "inline" },
      token: {
        inline: true,
        group: "inline",
        atom: true,
        attrs: { node: {}, path: { default: [] } },
        toDOM(node) {
          const span = doc.createElement("span");
          span.className = "mce-token";
          const n = node.attrs.node;
          span.textContent =
            n.type === "placeholder"
              ? (values[n.name] ?? `{{${n.name}}}`)
              : n.type === "sprite"
                ? "\ufffc"
                : (n.fallback ?? "[protected]");
          setLabelAttribute(
            span,
            "title",
            n.type === "placeholder"
              ? `{{${n.name}}}`
              : (localization?.message(
                  "protectedSourceHint",
                  "Protected source construct; edit in source mode",
                ) ?? "Protected source construct; edit in source mode"),
          );
          span.contentEditable = "false";
          return span;
        },
      },
    },
    marks: {
      format: {
        attrs: { path: { default: [] }, leafId: { default: null } },
        inclusive: true,
        toDOM(mark) {
          const path = mark.attrs.path as StylePath[],
            style = Object.assign({}, ...path.map((p) => p.style)) as TextStyle;
          const span = doc.createElement("span");
          applyTextStyle(span, style);
          return { dom: span, contentDOM: span };
        },
      },
    },
  });
}
