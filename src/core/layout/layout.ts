import type {
  LayoutOptions,
  LayoutResult,
  TextDocument,
  TextNode,
} from "../model.js";
import { flattenDisplayText } from "../text/display.js";
import { diagnostic } from "../diagnostics.js";
import { regularGlyphAdvance } from "./metrics.js";
export function layoutText(
  text: TextDocument,
  options: LayoutOptions,
): LayoutResult {
  const diagnostics: LayoutResult["diagnostics"] = [],
    glyphs: LayoutResult["glyphs"] = [],
    lines: LayoutResult["lines"] = [];
  const warnProtected = (nodes: TextNode[]) => {
    for (const node of nodes) {
      if (node.type === "group") warnProtected(node.children);
      else if (node.type === "opaque")
        diagnostics.push(
          diagnostic(
            "protected-preview",
            node.id,
            {
              key: "diagnostic.protectedPreview",
            },
            "warning",
          ),
        );
    }
  };
  warnProtected(text.nodes);
  let line = 0,
    x = 0,
    lineStart = 0;
  const finish = () => {
    const align = options.alignments?.[line] ?? "left",
      remaining = Math.max(0, options.width - x),
      space = options.profile.font.advances[" "] ?? 4;
    const padding =
      align === "left" || space <= 0
        ? 0
        : Math.min(
            Math.round(
              (align === "center" ? remaining / 2 : remaining) / space,
            ),
            Math.floor(remaining / space),
          ) * space;
    if (align !== "left" && space <= 0)
      diagnostics.push(
        diagnostic(
          "alignment-unavailable",
          "motd",
          { key: "diagnostic.alignmentUnavailable" },
          "warning",
        ),
      );
    lines.push({ width: x, padding });
    for (let i = lineStart; i < glyphs.length; i++) glyphs[i]!.x += padding;
    lineStart = glyphs.length;
    line++;
    x = 0;
  };
  const chars = flattenDisplayText(text),
    font = options.profile.font,
    native = font.layout === "java-ltr";
  // These scripts/control characters require contextual shaping or bidi order,
  // beyond the declared LTR grapheme capability, even with custom glyph metrics.
  if (
    native &&
    chars.some((c) =>
      /\p{Bidi_Control}|[^\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Common}\p{Script=Inherited}]/u.test(
        c.text,
      ),
    )
  )
    diagnostics.push(
      diagnostic(
        "unsupported-text-layout",
        "motd",
        { key: "diagnostic.unsupportedTextLayout" },
        "warning",
      ),
    );
  const advances = chars.map((c) => {
    if (c.text === "\n") return 0;
    if (c.text === "\r" || !font.supported(c.text))
      diagnostics.push(
        diagnostic(
          "missing-glyph",
          c.nodeId,
          c.text === "\r"
            ? { key: "diagnostic.carriageReturnGlyph" }
            : { key: "diagnostic.missingGlyph", parameters: { glyph: c.text } },
          "warning",
        ),
      );
    return (
      regularGlyphAdvance(font, c.text) + (c.style.bold ? font.boldOffset : 0)
    );
  });
  let start = 0;
  while (start < chars.length) {
    let end = start,
      width = 0,
      lastSpace = -1,
      hasWidth = false,
      wrapped = false;
    for (; end < chars.length; end++) {
      const c = chars[end]!,
        advance = advances[end]!;
      if (c.text === "\n") break;
      if (native && c.text === " ") lastSpace = end;
      if (
        hasWidth &&
        width + advance > (native ? Math.max(1, options.width) : options.width)
      ) {
        if (lastSpace >= start) end = lastSpace;
        wrapped = true;
        break;
      }
      width += advance;
      hasWidth ||= advance !== 0;
    }
    let next = end;
    const delimiter = chars[end]?.text;
    if (delimiter === "\n" || (native && wrapped && delimiter === " ")) next++;
    for (let i = start; i < end; i++) {
      const advance = advances[i]!;
      glyphs.push({ ...chars[i]!, advance, x, line });
      x += advance;
    }
    if (native && wrapped && delimiter === " ")
      glyphs.push({ ...chars[end]!, advance: 0, x, line, suppressed: true });
    if (wrapped)
      diagnostics.push(
        diagnostic(
          "line-overflow",
          chars[end]!.nodeId,
          { key: "diagnostic.lineOverflow" },
          "warning",
        ),
      );
    finish();
    start = next;
  }
  if (!chars.length || chars.at(-1)?.text === "\n") finish();
  if (lines.length > (options.maxLines ?? 2))
    diagnostics.push(
      diagnostic(
        "hidden-lines",
        "motd",
        {
          key:
            (options.maxLines ?? 2) === 2
              ? "diagnostic.hiddenLines"
              : "diagnostic.hiddenLinesCount",
          parameters: { lines: options.maxLines ?? 2 },
        },
        "warning",
      ),
    );
  return { glyphs, lines, diagnostics };
}
