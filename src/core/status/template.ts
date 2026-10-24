import type {
  Outcome,
  ServerListDocument,
  StatusTemplate,
  TextDocument,
  TextNode,
} from "../model.js";
import { validateDocument } from "../document.js";
import { normalizeStatusIcon } from "../image/icon.js";
export function compileStatusTemplate(
  document: ServerListDocument,
): Outcome<StatusTemplate> {
  const result = validateDocument(document);
  if (!result.value) return { value: null, diagnostics: result.diagnostics };
  const { extensions, ...value } = result.value;
  if (value.icon) {
    const icon = normalizeStatusIcon(value.icon);
    value.icon = icon.value;
    result.diagnostics.push(...icon.diagnostics);
  }
  const clean = (text: TextDocument): TextDocument => {
    const visit = (nodes: TextNode[]): TextNode[] =>
      nodes.map((n) =>
        n.type === "group" ? { ...n, children: visit(n.children) } : { ...n },
      );
    return { revision: 0, nodes: visit(text.nodes) };
  };
  value.motd.text = clean(value.motd.text);
  if (value.version.mode !== "automatic")
    value.version.text = clean(value.version.text);
  if (value.hover.mode === "custom") value.hover.text = clean(value.hover.text);
  return { value, diagnostics: result.diagnostics };
}
