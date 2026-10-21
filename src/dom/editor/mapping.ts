import type { Node as PMNode, Schema } from "prosemirror-model";
import type { TextDocument, TextNode } from "../../core/model.js";
import type { StylePath } from "./schema.js";
let sequence = 0;
export const nextId = (): string => `edit-${sequence++}`;
export function toEditorNode(text: TextDocument, schema: Schema): PMNode {
  const lines: { nodes: PMNode[]; breakPath: StylePath[] }[] = [
    { nodes: [], breakPath: [] },
  ];
  const line = () => lines[lines.length - 1]!;
  const append = (nodes: TextNode[], path: StylePath[]) => {
    for (const n of nodes) {
      if (n.type === "group") {
        append(n.children, [...path, { id: n.id, style: n.style }]);
        continue;
      }
      if (n.type === "newline") {
        lines.push({ nodes: [], breakPath: path });
        continue;
      }
      if (n.type === "text") {
        const parts = n.value.split("\n");
        parts.forEach((value, i) => {
          if (i) lines.push({ nodes: [], breakPath: path });
          if (value)
            line().nodes.push(
              schema.text(value, [
                schema.marks.format!.create({ path, leafId: n.id }),
              ]),
            );
        });
      } else line().nodes.push(schema.nodes.token!.create({ node: n, path }));
    }
  };
  append(text.nodes, []);
  return schema.nodes.doc!.create(
    null,
    lines.map((l) =>
      schema.nodes.paragraph!.create({ breakPath: l.breakPath }, l.nodes),
    ),
  );
}
export function fromEditorNode(
  pm: PMNode,
  previous: TextDocument,
): TextDocument {
  const root: TextNode[] = [],
    used = new Set<string>();
  const unique = (preferred?: string): string => {
    let id = preferred ?? nextId();
    while (used.has(id)) id = nextId();
    used.add(id);
    return id;
  };
  let active: { signature: string; children: TextNode[] }[] = [];
  const container = (path: StylePath[]): TextNode[] => {
    let same = 0;
    while (
      same < active.length &&
      same < path.length &&
      active[same]!.signature === JSON.stringify(path[same])
    )
      same++;
    active.splice(same);
    for (let i = same; i < path.length; i++) {
      const p = path[i]!,
        children: TextNode[] = [];
      const group: TextNode = {
        id: unique(p.id),
        type: "group",
        style: structuredClone(p.style),
        children,
      };
      (active.at(-1)?.children ?? root).push(group);
      active.push({ signature: JSON.stringify(p), children });
    }
    return active.at(-1)?.children ?? root;
  };
  pm.forEach((paragraph, _, line) => {
    if (line)
      container(paragraph.attrs.breakPath ?? []).push({
        id: unique(),
        type: "newline",
      });
    paragraph.forEach((node) => {
      if (node.isText) {
        const mark = node.marks.find((m) => m.type.name === "format");
        container(mark?.attrs.path ?? []).push({
          id: unique(mark?.attrs.leafId ?? undefined),
          type: "text",
          value: node.text!,
        });
      } else if (node.type.name === "token") {
        const token = structuredClone(node.attrs.node) as TextNode;
        token.id = unique(token.id);
        container(node.attrs.path ?? []).push(token);
      }
    });
  });
  return { ...previous, revision: previous.revision + 1, nodes: root };
}
