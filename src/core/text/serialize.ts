import { spriteTag } from "./sprites.js";
import type {
  Outcome,
  SerializeOptions,
  TextDocument,
  TextNode,
  TextStyle,
  TextTarget,
} from "../model.js";
import { diagnostic } from "../diagnostics.js";
import { flattenText, rgb } from "./colors.js";
import { LEGACY_PALETTE } from "./legacy.js";
import { encodeProperties } from "./properties.js";
import { layoutText } from "../layout/layout.js";
import { nativePadding, supportsFinePadding } from "../layout/padding.js";
const decorations = [
  "bold",
  "italic",
  "underlined",
  "strikethrough",
  "obfuscated",
] as const;
const tags: Record<string, string> = {
  bold: "b",
  italic: "i",
  underlined: "u",
  strikethrough: "st",
  obfuscated: "obf",
};
const esc = (s: string) => s.replaceAll("\\", "\\\\").replaceAll("<", "\\<");
export function serializeText(
  text: TextDocument,
  target: TextTarget,
  options: SerializeOptions = {},
): Outcome<string> {
  if (
    text.source?.format === target.format &&
    text.source.revision === text.revision &&
    !options.layout
  )
    return { value: text.source.value, diagnostics: [] };
  const diagnostics = [];
  let opaqueLoss = false,
    spriteLoss = false;
  const inspect = (nodes: TextNode[]) => {
    for (const n of nodes) {
      if (n.type === "group") inspect(n.children);
      if (
        n.type === "sprite" &&
        !["json", "minimessage"].includes(target.format)
      )
        spriteLoss = true;
      if (n.type === "opaque" && n.format !== target.format) opaqueLoss = true;
    }
  };
  inspect(text.nodes);
  if (spriteLoss) {
    diagnostics.push(
      diagnostic(
        "sprite-unsupported-format",
        "",
        { key: "diagnostic.spriteUnsupportedFormat" },
        options.lossy === "reduce" ? "warning" : "error",
      ),
    );
    if (options.lossy !== "reduce") return { value: null, diagnostics };
  }
  if (opaqueLoss) {
    diagnostics.push(
      diagnostic(
        "unsupported-export",
        "",
        { key: "diagnostic.unsupportedExport" },
        options.lossy === "reduce" ? "warning" : "error",
      ),
    );
    if (options.lossy !== "reduce") return { value: null, diagnostics };
  }
  const owners = new Map<string, TextNode>();
  const indexNodes = (nodes: TextNode[]) => {
    for (const node of nodes) {
      owners.set(node.id, node);
      if (node.type === "group") indexNodes(node.children);
    }
  };
  indexNodes(text.nodes);
  function renderedMiniMessage(chars: ReturnType<typeof flattenText>): string {
    const emitted = new Set<string>();
    return chars
      .map((c) => {
        const node = owners.get(c.nodeId),
          atom = node?.type === "placeholder" || node?.type === "opaque";
        if (node?.type === "sprite")
          return wrap(spriteTag(node), {
            ...c.style,
            color: c.color,
            gradient: undefined,
            rainbow: undefined,
          });
        if (atom) {
          if (emitted.has(node.id)) return "";
          emitted.add(node.id);
          const raw =
            node.type === "placeholder"
              ? `{{${node.name}}}`
              : node.format === "minimessage"
                ? node.raw
                : esc(node.fallback ?? node.raw);
          return wrap(raw, {
            ...c.style,
            color: c.color,
            gradient: undefined,
            rainbow: undefined,
          });
        }
        return c.text === "\n"
          ? "<newline>"
          : wrap(esc(c.text), {
              ...c.style,
              color: c.color,
              gradient: undefined,
              rainbow: undefined,
            });
      })
      .join("");
  }
  const mm = (nodes: TextNode[]): string =>
    nodes
      .map((n) => {
        if (n.type === "sprite") return spriteTag(n);
        if (n.type === "text") return esc(n.value);
        if (n.type === "newline") return "<newline>";
        if (n.type === "placeholder") return `{{${n.name}}}`;
        if (n.type === "opaque")
          return n.format === "minimessage" ? n.raw : esc(n.fallback ?? n.raw);
        const uneven = n.style.gradient?.some(
          (s, i, a) => Math.abs(s.position - i / (a.length - 1)) > 1e-6,
        );
        if (uneven) {
          const flat = flattenText({ revision: 0, nodes: [n] });
          return renderedMiniMessage(flat);
        }
        return wrap(mm(n.children), n.style);
      })
      .join("");
  function wrap(value: string, style: TextStyle): string {
    let out = value;
    if (style.shadowColor !== undefined) {
      const argb = (style.shadowColor >>> 0).toString(16).padStart(8, "0");
      out = `<shadow:#${argb.slice(2)}${argb.slice(0, 2)}>${out}</shadow>`;
    }
    if (style.color) out = `<${style.color}>${out}</${style.color}>`;
    if (style.gradient)
      out = `<gradient:${style.gradient.map((s) => s.color).join(":")}${style.gradientPhase ? ":" + style.gradientPhase : ""}>${out}</gradient>`;
    if (style.rainbow)
      out = `<rainbow:${style.rainbow.reversed ? "!" : ""}${style.rainbow.phase}>${out}</rainbow>`;
    for (const k of decorations)
      if (style[k] !== undefined)
        out = `<${style[k] ? "" : "!"}${tags[k]}>${out}</${tags[k]}>`;
    return out;
  }
  let chars = flattenText(text);
  if (options.layout) {
    // MiniMessage is persistent source, including legacy padded fallbacks.
    // Preserve native objects here; client-specific omission belongs to status
    // evaluation/JSON output, never to saving an editor's intent.
    const sourceLayout =
      target.format === "minimessage" &&
      !options.layout.profile.atlasSprites &&
      chars.some((c) => c.sprite)
        ? {
            ...options.layout,
            profile: {
              ...options.layout.profile,
              atlasSprites: { advance: 8, boldOffset: 1 },
            },
          }
        : options.layout;
    const layout = layoutText(text, sourceLayout);
    diagnostics.push(...layout.diagnostics);
    const atomicBoundaries = new Map<
      string,
      { count: number; newline: boolean }
    >();
    for (const c of chars) {
      const boundary = atomicBoundaries.get(c.nodeId) ?? {
        count: 0,
        newline: false,
      };
      boundary.count++;
      boundary.newline ||= c.text === "\n";
      atomicBoundaries.set(c.nodeId, boundary);
    }
    for (const owner of owners.values()) {
      if (owner.type !== "opaque" && owner.type !== "placeholder") continue;
      const boundary = atomicBoundaries.get(owner.id);
      if (!boundary?.count || boundary.newline)
        return {
          value: null,
          diagnostics: [
            ...diagnostics,
            diagnostic("protected-layout", owner.id, {
              key: "diagnostic.protectedLayoutMultiline",
            }),
          ],
        };
    }
    const atomicLines = new Map<string, number>();
    for (const g of layout.glyphs) {
      const owner = owners.get(g.nodeId);
      if (owner?.type !== "placeholder" && owner?.type !== "opaque") continue;
      const firstLine = atomicLines.get(g.nodeId) ?? g.line;
      if (g.suppressed || firstLine !== g.line)
        return {
          value: null,
          diagnostics: [
            ...diagnostics,
            diagnostic("protected-layout", g.nodeId, {
              key: "diagnostic.protectedLayoutBreak",
            }),
          ],
        };
      atomicLines.set(g.nodeId, g.line);
    }
    const synthetic = (value: string, bold?: boolean) => ({
      text: value,
      nodeId: "",
      offset: 0,
      position: 0,
      color: "#ffffff",
      style: bold === undefined ? {} : { bold },
    });
    const visual = layout.lines.map(() => [] as typeof chars);
    for (const g of layout.glyphs) if (!g.suppressed) visual[g.line]!.push(g);
    chars = visual.flatMap((glyphs, line) => {
      const space = options.layout!.fontSource
        ? (options.layout!.fontSource.glyphFor(32)?.advance ?? 0)
        : (options.layout!.profile.font.advances[" "] ?? 4);
      const pad =
        layout.lines[line]!.spaceCount ??
        (space > 0 ? Math.round(layout.lines[line]!.padding / space) : 0);
      const native =
        !options.layout!.fontSource &&
        supportsFinePadding(options.layout!.profile.font);
      const fine = native
        ? nativePadding(
            layout.lines[line]!.padding,
            layout.lines[line]!.padding,
          )
        : { regular: pad, bold: 0 };
      const prefix = native
        ? [
            ...(fine.regular
              ? [synthetic(" ".repeat(fine.regular), false)]
              : []),
            ...(fine.bold ? [synthetic(" ".repeat(fine.bold), true)] : []),
          ]
        : Array.from({ length: pad }, () => synthetic(" "));
      return [...(line ? [synthetic("\n")] : []), ...prefix, ...glyphs];
    });
  }
  if (target.format === "minimessage") {
    if (!options.layout) return { value: mm(text.nodes), diagnostics };
    return {
      value: renderedMiniMessage(chars),
      diagnostics,
    };
  }
  if (target.format === "json") {
    const charJson = (c: ReturnType<typeof flattenText>[number]) => ({
      ...(c.sprite
        ? options.layout && !options.layout.profile.atlasSprites
          ? { text: "" }
          : { ...c.sprite }
        : { text: c.text }),
      ...(c.style.shadowColor !== undefined
        ? { shadow_color: c.style.shadowColor }
        : {}),
      color: c.color,
      ...Object.fromEntries(decorations.map((k) => [k, !!c.style[k]])),
    });
    const containsProtected = (nodes: TextNode[]): boolean =>
      nodes.some(
        (n) =>
          n.type === "opaque" ||
          (n.type === "group" && containsProtected(n.children)),
      );
    const encode = (node: TextNode): unknown => {
      if (node.type === "opaque")
        return node.format === "json"
          ? JSON.parse(node.raw)
          : { text: node.fallback ?? node.raw };
      if (node.type === "sprite")
        return { atlas: node.atlas, sprite: node.sprite };
      if (node.type === "text") return { text: node.value };
      if (node.type === "newline") return { text: "\n" };
      if (node.type === "placeholder") return { text: `{{${node.name}}}` };
      const style = {
        ...(node.style.shadowColor !== undefined
          ? { shadow_color: node.style.shadowColor }
          : {}),
        ...(node.style.color ? { color: node.style.color } : {}),
        ...Object.fromEntries(
          decorations
            .filter((k) => node.style[k] !== undefined)
            .map((k) => [k, node.style[k]]),
        ),
      };
      if (node.style.gradient || node.style.rainbow) {
        if (containsProtected(node.children))
          diagnostics.push(
            diagnostic(
              "protected-effect",
              node.id,
              { key: "diagnostic.protectedEffect" },
              "warning",
            ),
          );
        else
          return {
            text: "",
            extra: flattenText({ revision: 0, nodes: [node] }).map(charJson),
          };
      }
      return { text: "", ...style, extra: node.children.map(encode) };
    };
    // Keep unknown native component objects intact after source revisions change.
    if (!options.layout)
      return {
        value: JSON.stringify({ text: "", extra: text.nodes.map(encode) }),
        diagnostics,
      };
    if (containsProtected(text.nodes))
      return {
        value: null,
        diagnostics: [
          ...diagnostics,
          diagnostic("protected-layout", "", {
            key: "diagnostic.protectedLayoutJson",
          }),
        ],
      };
    return {
      value: JSON.stringify({ text: "", extra: chars.map(charJson) }),
      diagnostics,
    };
  }
  const prefix = target.format === "legacy-ampersand" ? "&" : "§";
  let out = "",
    previous = "";
  for (const c of chars) {
    if (c.sprite) continue;
    const style = c.style,
      key = c.color + "|" + decorations.map((k) => !!style[k]).join("|");
    if (key !== previous) {
      let color = c.color.toLowerCase(),
        i = LEGACY_PALETTE.indexOf(color);
      if (i < 0 && !target.rgb) {
        if (options.lossy !== "reduce")
          return {
            value: null,
            diagnostics: [
              ...diagnostics,
              diagnostic("unsupported-color", "", {
                key: "diagnostic.unsupportedColor",
              }),
            ],
          };
        const channels = rgb(color);
        i = LEGACY_PALETTE.map((v) =>
          rgb(v).reduce((s, n, k) => s + (n - channels[k]!) ** 2, 0),
        ).reduce((best, d, index, a) => (d < a[best]! ? index : best), 0);
        color = LEGACY_PALETTE[i]!;
        diagnostics.push(
          diagnostic(
            "reduced-color",
            "",
            { key: "diagnostic.reducedColor" },
            "warning",
          ),
        );
      }
      out += prefix + "r";
      out +=
        i >= 0
          ? prefix + i.toString(16)
          : target.hex === "adventure"
            ? prefix + color
            : prefix +
              "x" +
              [...color.slice(1)].map((d) => prefix + d).join("");
      const codes = ["l", "o", "n", "m", "k"];
      decorations.forEach((k, i) => {
        if (style[k]) out += prefix + codes[i];
      });
      previous = key;
    }
    out += c.text;
  }
  return {
    value:
      target.format === "properties"
        ? encodeProperties(out, target.encoding === "ascii")
        : out,
    diagnostics,
  };
}

/** Each sample/line is a separate client value and must carry its own effective starting style. */
export function serializeLegacyLines(
  text: TextDocument,
  target: TextTarget & { format: "legacy-section" | "legacy-ampersand" },
  options: SerializeOptions = {},
): Outcome<string[]> {
  const checked = serializeText(text, target, options);
  if (checked.value === null)
    return { value: null, diagnostics: checked.diagnostics };
  const lines: ReturnType<typeof flattenText>[] = [[]];
  for (const char of flattenText(text)) {
    if (char.text === "\n") lines.push([]);
    else lines.at(-1)!.push(char);
  }
  const diagnostics: import("../model.js").Diagnostic[] = [
      ...checked.diagnostics,
    ],
    values: string[] = [];
  for (const [line, chars] of lines.entries()) {
    const nodes: TextNode[] = chars.map((c, i) => ({
      id: `line-${line}-${i}`,
      type: "group",
      style: {
        ...c.style,
        color: c.color,
        gradient: undefined,
        gradientPhase: undefined,
        rainbow: undefined,
      },
      children: [{ id: `char-${line}-${i}`, type: "text", value: c.text }],
    }));
    const result = serializeText({ revision: 0, nodes }, target, options);
    diagnostics.push(...result.diagnostics);
    if (result.value === null) return { value: null, diagnostics };
    values.push(result.value);
  }
  return { value: values, diagnostics };
}
