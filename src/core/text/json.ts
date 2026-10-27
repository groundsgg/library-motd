import type { JsonValue, TextDocument, TextNode, TextStyle } from "../model.js";
import { COLORS } from "./minimessage.js";
export function parseJsonText(value: JsonValue, maxDepth = 128): TextDocument {
  let serial = 0;
  const id = () => `j${serial++}`;
  const protectedArrays = new WeakSet<JsonValue[]>();
  // Only visible literal contents are inspected. Event payloads and contextual
  // component types remain inert, while the full subtree stays in `raw`.
  const fallback = (v: JsonValue, depth: number): string => {
    if (depth > maxDepth)
      throw new TypeError("Component nesting exceeds limit");
    if (typeof v === "string") return v;
    if (Array.isArray(v))
      return v.map((child) => fallback(child, depth + 1)).join("");
    if (!v || typeof v !== "object") return "[unsupported component]";
    return (
      (typeof v.text === "string" ? v.text : "[unsupported component]") +
      (Array.isArray(v.extra)
        ? v.extra.map((child) => fallback(child, depth + 1)).join("")
        : "")
    );
  };
  const visit = (v: JsonValue, depth = 0): TextNode[] => {
    if (depth > maxDepth)
      throw new TypeError("Component nesting exceeds limit");
    if (typeof v === "string") return [{ id: id(), type: "text", value: v }];
    if (Array.isArray(v)) {
      if (!v.length) return [];
      const firstValue = v[0]!;
      const first = visit(firstValue, depth + 1);
      if (first[0]?.type === "opaque") {
        // Later entries depend on the first component's complete native style,
        // including metadata we cannot represent in an editable group. Keep
        // this boundary intact for display and subsequent same-format export.
        const rest = v.slice(1);
        const tail = rest.map((child) => fallback(child, depth + 1)).join("");
        // Tolerated empty arrays can flatten the first value to several nodes.
        // Reuse raw only when the atom owns that complete source boundary.
        const reuse =
          !Array.isArray(firstValue) || protectedArrays.has(firstValue);
        const raw = reuse ? first[0].raw : JSON.stringify(firstValue);
        const visible = reuse
          ? (first[0].fallback ?? first[0].raw)
          : fallback(firstValue, depth + 1);
        protectedArrays.add(v);
        return [
          {
            ...first[0],
            raw: `[${raw}${rest.length ? "," + JSON.stringify(rest).slice(1, -1) : ""}]`,
            fallback: visible + tail,
          },
        ];
      }
      // Component-array siblings inherit the first component's style.
      if (first[0]?.type === "group")
        return [
          {
            ...first[0],
            children: [
              ...first[0].children,
              ...v.slice(1).flatMap((v) => visit(v, depth + 1)),
            ],
          },
        ];
      return [...first, ...v.slice(1).flatMap((v) => visit(v, depth + 1))];
    }
    if (!v || typeof v !== "object")
      throw new TypeError("Expected text component");
    const allowed = [
      "text",
      "extra",
      "color",
      "bold",
      "italic",
      "underlined",
      "strikethrough",
      "obfuscated",
    ];
    if (Object.keys(v).some((k) => !allowed.includes(k)))
      return [
        {
          id: id(),
          type: "opaque",
          format: "json",
          raw: JSON.stringify(v),
          fallback: fallback(v, depth),
        },
      ];
    const style: TextStyle = {};
    if (typeof v.color === "string") {
      const c = COLORS[v.color] ?? v.color;
      if (!/^#[\da-f]{6}$/i.test(c))
        throw new TypeError("Invalid component color");
      style.color = c;
    }
    for (const k of [
      "bold",
      "italic",
      "underlined",
      "strikethrough",
      "obfuscated",
    ] as const)
      if (v[k] !== undefined) {
        if (typeof v[k] !== "boolean")
          throw new TypeError("Expected boolean decoration");
        style[k] = v[k];
      }
    if (v.text !== undefined && typeof v.text !== "string")
      throw new TypeError("Expected component text");
    if (v.extra !== undefined && !Array.isArray(v.extra))
      throw new TypeError("Expected extra array");
    const children: TextNode[] = [];
    if (typeof v.text === "string" && v.text)
      children.push({ id: id(), type: "text", value: v.text });
    if (Array.isArray(v.extra))
      children.push(...v.extra.flatMap((v) => visit(v, depth + 1)));
    return [{ id: id(), type: "group", style, children }];
  };
  return { revision: 0, nodes: visit(value) };
}
