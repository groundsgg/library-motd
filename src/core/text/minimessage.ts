import type {
  Outcome,
  ParseOptions,
  TextDocument,
  TextNode,
  TextStyle,
} from "../model.js";
import { diagnostic, failure } from "../diagnostics.js";

export const COLORS: Record<string, string> = {
  black: "#000000",
  dark_blue: "#0000aa",
  dark_green: "#00aa00",
  dark_aqua: "#00aaaa",
  dark_red: "#aa0000",
  dark_purple: "#aa00aa",
  gold: "#ffaa00",
  gray: "#aaaaaa",
  dark_gray: "#555555",
  blue: "#5555ff",
  green: "#55ff55",
  aqua: "#55ffff",
  red: "#ff5555",
  light_purple: "#ff55ff",
  yellow: "#ffff55",
  white: "#ffffff",
};
const aliases: Record<string, string> = {
  b: "bold",
  i: "italic",
  em: "italic",
  u: "underlined",
  underline: "underlined",
  st: "strikethrough",
  strike: "strikethrough",
  obf: "obfuscated",
  k: "obfuscated",
  colour: "color",
};
export const canonicalTag = (s: string): string => aliases[s] ?? s;
export function tagEnd(input: string, start: number): number {
  let quote = "";
  for (let i = start + 1; i < input.length; i++) {
    const c = input[i]!;
    if (c === "\\") {
      i++;
      continue;
    }
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i;
  }
  return -1;
}
export function parseMiniMessage(
  input: string,
  options: ParseOptions = {},
): Outcome<TextDocument> {
  if (input.length > (options.maxTextLength ?? 65536))
    return failure("text-limit", "", { key: "diagnostic.textLimit" });
  let serial = 0;
  const id = () => `n${serial++}`;
  const root: TextNode[] = [];
  const stack: { tag: string; children: TextNode[] }[] = [
    { tag: "", children: root },
  ];
  const diagnostics = [];
  const current = () => stack[stack.length - 1]!.children;
  const appendText = (value: string) => {
    for (const part of value.split(/(\{\{\s*[\w.-]+\s*\}\}|\n)/g)) {
      if (!part) continue;
      const p = /^\{\{\s*([\w.-]+)\s*\}\}$/.exec(part);
      current().push(
        p
          ? { id: id(), type: "placeholder", name: p[1]! }
          : part === "\n"
            ? { id: id(), type: "newline" }
            : { id: id(), type: "text", value: part },
      );
    }
  };
  let buffer = "";
  const flush = () => {
    appendText(buffer);
    buffer = "";
  };
  for (let i = 0; i < input.length;) {
    if (input[i] === "\\" && ["<", "\\"].includes(input[i + 1] ?? "")) {
      buffer += input[i + 1];
      i += 2;
      continue;
    }
    if (input[i] !== "<") {
      buffer += input[i++];
      continue;
    }
    const end = tagEnd(input, i);
    if (end < 0) {
      buffer += input[i++];
      continue;
    }
    const body = input.slice(i + 1, end),
      lower = body.toLowerCase();
    const closing = lower.startsWith("/");
    const parts = (closing ? lower.slice(1) : lower).split(":");
    const originalName = parts[0]!.replace(/!|\/$/g, "");
    const tag = canonicalTag(originalName);
    if (closing) {
      const matching = stack.map((s) => s.tag).lastIndexOf(tag);
      if (matching > 0) {
        flush();
        stack.splice(matching);
      } else buffer += input.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (["newline", "br", "newline/", "br/"].includes(lower)) {
      flush();
      current().push({ id: id(), type: "newline" });
      i = end + 1;
      continue;
    }
    if (lower === "reset") {
      flush();
      stack.splice(1);
      i = end + 1;
      continue;
    }
    let style: TextStyle | undefined;
    const color = COLORS[tag] ?? (/^#[\da-f]{6}$/.test(tag) ? tag : undefined);
    if (color) style = { color };
    else if (
      tag === "color" &&
      parts[1] &&
      (COLORS[parts[1]] || /^#[\da-f]{6}$/.test(parts[1]))
    )
      style = { color: COLORS[parts[1]] ?? parts[1] };
    else if (
      ["bold", "italic", "underlined", "strikethrough", "obfuscated"].includes(
        tag,
      )
    )
      style = { [tag]: !lower.startsWith("!") && parts[1] !== "false" };
    else if (tag === "gradient") {
      const stops = parts
        .slice(1)
        .filter((p) => /^#[\da-f]{6}$/.test(p) || COLORS[p])
        .map((p) => COLORS[p] ?? p);
      const last = parts.at(-1)!;
      const phase = /^-?(?:\d+\.?\d*|\.\d+)$/.test(last) ? Number(last) : 0;
      if (stops.length >= 2 && Math.abs(phase) <= 1)
        style = {
          gradient: stops.map((c, n) => ({
            color: c,
            position: n / (stops.length - 1),
          })),
          ...(phase ? { gradientPhase: phase } : {}),
        };
    } else if (tag === "rainbow")
      style = {
        rainbow: {
          phase: Number(parts[1]?.replace("!", "") ?? 0),
          reversed: !!parts[1]?.startsWith("!"),
        },
      };
    if (style) {
      flush();
      if (stack.length > (options.maxDepth ?? 128))
        return failure("depth-limit", "", { key: "diagnostic.depthLimit" });
      const group: TextNode & { type: "group" } = {
        id: id(),
        type: "group",
        style,
        children: [],
      };
      current().push(group);
      stack.push({ tag, children: group.children });
      i = end + 1;
      continue;
    }
    flush();
    let stop = end + 1,
      depth = 1;
    for (let search = end + 1; search < input.length;) {
      const at = input.indexOf("<", search);
      if (at < 0) break;
      const to = tagEnd(input, at);
      if (to < 0) break;
      const token = input.slice(at + 1, to).toLowerCase();
      if (token.split(":")[0] === originalName) depth++;
      if (token === `/${originalName}` && --depth === 0) {
        stop = to + 1;
        break;
      }
      search = to + 1;
    }
    const raw = input.slice(i, stop);
    current().push({
      id: id(),
      type: "opaque",
      format: "minimessage",
      raw,
      fallback: raw,
    });
    diagnostics.push(
      diagnostic(
        "unsupported-tag",
        "",
        { key: "diagnostic.unsupportedTag", parameters: { tag: originalName } },
        "warning",
      ),
    );
    i = stop;
  }
  flush();
  return {
    value: {
      revision: 0,
      nodes: root,
      source: { format: "minimessage", value: input, revision: 0 },
    },
    diagnostics,
  };
}
