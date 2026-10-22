import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { LayoutOptions, TextDocument } from "../../core/model.js";
import { layoutText } from "../../core/layout/layout.js";
import { resolveText } from "../../core/text/placeholders.js";
import { fromEditorNode } from "./mapping.js";

/** Decorations apply Minecraft's space-quantized padding without editing source. */
export function inlineAlignment(
  text: () => TextDocument,
  values: Readonly<Record<string, string>>,
  options: () => LayoutOptions,
): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const layoutOptions = options();
        if (!layoutOptions.alignments?.some((value) => value !== "left"))
          return DecorationSet.empty;
        const resolved = resolveText(
          fromEditorNode(state.doc, text()),
          values,
        ).value!;
        const layout = layoutText(resolved, layoutOptions),
          decorations: Decoration[] = [];
        state.doc.forEach((node, pos, index) => {
          const padding = layout.lines[index]?.padding ?? 0;
          if (padding)
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                style: `padding-left: ${padding}px; box-sizing: border-box`,
              }),
            );
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}
