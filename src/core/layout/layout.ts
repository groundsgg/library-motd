import type { LayoutOptions, LayoutResult, TextDocument } from "../model.js";
import { flattenText } from "../text/colors.js";
import { diagnostic } from "../diagnostics.js";
export function layoutText(
  text: TextDocument,
  options: LayoutOptions,
): LayoutResult {
  const diagnostics: LayoutResult["diagnostics"] = [],
    glyphs: LayoutResult["glyphs"] = [],
    lines: LayoutResult["lines"] = [];
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
          "Alignment requires a positive space advance in this font profile",
          "warning",
        ),
      );
    lines.push({ width: x, padding });
    for (let i = lineStart; i < glyphs.length; i++) glyphs[i]!.x += padding;
    lineStart = glyphs.length;
    line++;
    x = 0;
  };
  const chars = flattenText(text),
    font = options.profile.font,
    native = font.layout === "java-ltr";
  // These scripts/control characters require contextual shaping or bidi order,
  // beyond the declared LTR grapheme capability, even with custom glyph metrics.
  if (
    native &&
    chars.some((c) =>
      /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Tamil}\p{Script=Thai}\p{Script=Khmer}\p{Script=Myanmar}\u202a-\u202e\u2066-\u2069]/u.test(
        c.text,
      ),
    )
  )
    diagnostics.push(
      diagnostic(
        "unsupported-text-layout",
        "motd",
        "This profile supports LTR grapheme layout; contextual shaping and bidirectional ordering are approximate",
        "warning",
      ),
    );
  const advances = chars.map((c) => {
    if (c.text === "\n") return 0;
    const normalized = c.text.normalize("NFC"),
      font = options.profile.font;
    if (!font.supported(c.text))
      diagnostics.push(
        diagnostic(
          "missing-glyph",
          c.nodeId,
          `No glyph for ${c.text} in this font profile; fallback rendering and width are approximate`,
          "warning",
        ),
      );
    return (
      (font.advances[c.text] ??
        font.advances[normalized] ??
        font.fallbackAdvance) + (c.style.bold ? font.boldOffset : 0)
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
          "Text wraps beyond the selected row width",
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
        "Only the first two lines are visible",
        "warning",
      ),
    );
  return { glyphs, lines, diagnostics };
}
