import type { JsonValue, TextDocument, TextNode } from "../model.js";
import { flattenText, type StyledChar } from "./colors.js";
import { parseJsonText } from "./json.js";
import { COLORS } from "./minimessage.js";

type Opaque = Extract<TextNode, { type: "opaque" }>;
interface CachedProjection {
  raw: string;
  fallback: string | undefined;
  styles: Map<number, StyledChar> | null;
}
const projections = new WeakMap<Opaque, CachedProjection>();

/** Only known literal display fields enter this temporary, inert component. */
function project(raw: string): TextDocument {
  let visited = 0;
  const visit = (value: JsonValue, depth: number): JsonValue => {
    if (depth > 128 || ++visited > 32768)
      throw new TypeError("Display projection limit");
    if (typeof value === "string") return value;
    if (Array.isArray(value))
      return value.map((child) => visit(child, depth + 1));
    if (!value || typeof value !== "object") return "[unsupported component]";
    const visible: Record<string, JsonValue> = {
      text:
        typeof value.text === "string" ? value.text : "[unsupported component]",
    };
    if (typeof value.color === "string") {
      const color = COLORS[value.color] ?? value.color;
      if (/^#[\da-f]{6}$/i.test(color)) visible.color = color;
    }
    for (const key of [
      "bold",
      "italic",
      "underlined",
      "strikethrough",
      "obfuscated",
    ] as const)
      if (typeof value[key] === "boolean") visible[key] = value[key];
    if (Array.isArray(value.extra))
      visible.extra = value.extra.map((child) => visit(child, depth + 1));
    return visible;
  };
  return parseJsonText(visit(JSON.parse(raw) as JsonValue, 0));
}

function stylesFor(node: Opaque): Map<number, StyledChar> | null {
  if (node.format !== "json") return null;
  const cached = projections.get(node);
  if (cached?.raw === node.raw && cached.fallback === node.fallback)
    return cached.styles;
  let styles: Map<number, StyledChar> | null = null;
  try {
    const visible = node.fallback ?? node.raw;
    if (node.raw.length <= 65536 && typeof visible === "string") {
      const derived = flattenText(project(node.raw));
      const original = flattenText({
        revision: 0,
        nodes: [{ id: node.id, type: "text", value: visible }],
      });
      // A protected atom retains its original source positions even when a
      // component boundary splits a combining sequence or surrogate pair.
      if (
        derived.length === original.length &&
        derived.every(
          (char, index) =>
            char.text === original[index]!.text &&
            char.position === original[index]!.position,
        )
      ) {
        styles = new Map(derived.map((char) => [char.position, char]));
      }
    }
  } catch {
    /* Malformed/custom protected data retains the previous fallback. */
  }
  projections.set(node, { raw: node.raw, fallback: node.fallback, styles });
  return styles;
}

/** Internal display path; canonical flattening and ordinary export stay unchanged. */
export function flattenDisplayText(document: TextDocument): StyledChar[] {
  return flattenText(document).map((char) => {
    const node = char.opaque;
    if (node?.type !== "opaque") return char;
    const local = stylesFor(node)?.get(char.offset);
    return local
      ? {
          ...char,
          color: local.style.color ?? char.color,
          style: { ...char.style, ...local.style },
        }
      : char;
  });
}
