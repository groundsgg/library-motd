import type {
  Alignment,
  ClientProfile,
  ServerListDocument,
  TextDocument,
  TextNode,
} from "../model.js";
import { layoutText } from "../layout/layout.js";
import { flattenText, type StyledChar } from "./colors.js";
import { suggestSimplification } from "./simplify.js";

export interface ImportAssistanceOptions {
  profile: ClientProfile;
  width: number;
  /** Maximum difference in any RGB channel, 0–255; default 0. */
  colorTolerance?: number;
  /** Maximum glyph-position difference in logical GUI pixels, 0–4; default 0. */
  positionTolerance?: number;
}
export interface ImportAssistanceProposal {
  kind: "gradient" | "alignment";
  field: "motd" | "version" | "hover";
  original: ServerListDocument;
  candidate: ServerListDocument;
  maximumColorError: number;
  maximumPositionError: number;
  removedPadding: number;
}
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
/** Bound traversal and segmentation before flattenText allocates styled glyphs. */
function safeNodes(nodes: TextNode[]): boolean {
  const pending = [{ nodes, depth: 0 }];
  let count = 0,
    visited = 0;
  while (pending.length) {
    const current = pending.pop()!;
    for (const node of current.nodes) {
      if (++visited > 4096) return false;
      if (node.type === "group") {
        if (
          current.depth >= 32 ||
          node.style.gradient ||
          node.style.rainbow ||
          node.style.obfuscated
        )
          return false;
        pending.push({ nodes: node.children, depth: current.depth + 1 });
      } else if (node.type === "text") {
        for (const part of segmenter.segment(node.value)) {
          count += part.segment === "\r\n" ? 2 : 1;
          if (count > 2048) return false;
        }
      } else if (node.type !== "newline" || ++count > 2048) return false;
    }
  }
  return true;
}

/** Rebuild only static, unprotected text; retain inherited styles and trailing spaces. */
function fromChars(chars: StyledChar[], revision: number): TextDocument {
  const nodes: TextNode[] = [];
  let id = 0,
    priorStyle = "",
    priorText: Extract<TextNode, { type: "text" }> | undefined;
  for (const char of chars) {
    if (char.text === "\n") {
      nodes.push({ id: `assistance-${id++}`, type: "newline" });
      priorText = undefined;
      continue;
    }
    const style = JSON.stringify(char.style);
    if (priorText && priorStyle === style) priorText.value += char.text;
    else {
      priorText = { id: `assistance-${id++}`, type: "text", value: char.text };
      nodes.push(
        Object.keys(char.style).length
          ? {
              id: `assistance-${id++}`,
              type: "group",
              style: structuredClone(char.style),
              children: [priorText],
            }
          : priorText,
      );
      priorStyle = style;
    }
  }
  return { revision, nodes };
}

/** Conservative proposals only; the caller explicitly chooses whether to apply one. */
export function suggestImportAssistance(
  document: ServerListDocument,
  options: ImportAssistanceOptions,
): ImportAssistanceProposal[] {
  const colorTolerance = options.colorTolerance ?? 0,
    positionTolerance = options.positionTolerance ?? 0;
  if (
    !Number.isFinite(options.width) ||
    options.width <= 0 ||
    !Number.isFinite(colorTolerance) ||
    colorTolerance < 0 ||
    colorTolerance > 255 ||
    !Number.isFinite(positionTolerance) ||
    positionTolerance < 0 ||
    positionTolerance > 4
  )
    return [];
  const proposals: ImportAssistanceProposal[] = [];
  const proposal = (
    kind: ImportAssistanceProposal["kind"],
    field: ImportAssistanceProposal["field"],
  ): ImportAssistanceProposal => ({
    kind,
    field,
    original: structuredClone(document),
    candidate: structuredClone(document),
    maximumColorError: 0,
    maximumPositionError: 0,
    removedPadding: 0,
  });
  const fields = [
    ["motd", document.motd.text],
    [
      "version",
      document.version.mode !== "automatic" ? document.version.text : null,
    ],
    ["hover", document.hover.mode === "custom" ? document.hover.text : null],
  ] as const;
  for (const [field, text] of fields) {
    if (!text || !safeNodes(text.nodes)) continue;
    const chars = flattenText(text);
    if (!chars.length || chars.length > 2048) continue;
    if (new Set(chars.map((char) => char.color)).size > 1) {
      const simplified = suggestSimplification(text, {
        tolerance: colorTolerance,
      });
      const group = simplified.candidate.nodes[0];
      if (
        simplified.changed &&
        group?.type === "group" &&
        group.style.gradient &&
        group.style.gradient.length < chars.length
      ) {
        const next = proposal("gradient", field);
        next.maximumColorError = simplified.maximumColorError;
        if (field === "motd") next.candidate.motd.text = simplified.candidate;
        else if (
          field === "version" &&
          next.candidate.version.mode !== "automatic"
        )
          next.candidate.version.text = simplified.candidate;
        else if (field === "hover" && next.candidate.hover.mode === "custom")
          next.candidate.hover.text = simplified.candidate;
        proposals.push(next);
      }
    }
    if (field !== "motd") continue;
    const before = layoutText(text, {
      profile: options.profile,
      width: options.width,
      alignments: document.motd.alignments,
    });
    if (
      before.diagnostics.length ||
      before.lines.length > 2 ||
      before.glyphs.some(
        (g) =>
          !Number.isFinite(g.x) || !Number.isFinite(g.advance) || g.advance < 0,
      )
    )
      continue;
    const lines: StyledChar[][] = [[]];
    for (const char of chars) {
      if (char.text === "\n") lines.push([]);
      else lines.at(-1)!.push(char);
    }
    const next = proposal("alignment", field);
    let changed = false;
    const retained: StyledChar[] = [];
    lines.forEach((line, index) => {
      let leading = 0;
      while (line[leading]?.text === " ") leading++;
      if (
        leading > 0 &&
        leading < line.length &&
        (document.motd.alignments[index] ?? "left") === "left"
      ) {
        const trimmed = line.slice(leading);
        const original = before.glyphs
          .filter((g) => g.line === index)
          .slice(leading);
        let best: { align: Alignment; error: number } | undefined;
        for (const align of ["center", "right"] as const) {
          const after = layoutText(fromChars(trimmed, 0), {
            profile: options.profile,
            width: options.width,
            alignments: [align],
          });
          if (
            after.diagnostics.length ||
            after.glyphs.length !== original.length
          )
            continue;
          const error = Math.max(
            ...after.glyphs.map((g, i) => Math.abs(g.x - original[i]!.x)),
          );
          if (
            Number.isFinite(error) &&
            error <= positionTolerance &&
            (!best || error < best.error)
          )
            best = { align, error };
        }
        if (best) {
          while (next.candidate.motd.alignments.length <= index)
            next.candidate.motd.alignments.push("left");
          next.candidate.motd.alignments[index] = best.align;
          next.maximumPositionError = Math.max(
            next.maximumPositionError,
            best.error,
          );
          next.removedPadding += leading;
          lines[index] = trimmed;
          changed = true;
        }
      }
      if (index) retained.push({ ...chars.find((c) => c.text === "\n")! });
      retained.push(...lines[index]!);
    });
    if (changed) {
      next.candidate.motd.text = fromChars(retained, text.revision + 1);
      proposals.push(next);
    }
  }
  return proposals;
}
