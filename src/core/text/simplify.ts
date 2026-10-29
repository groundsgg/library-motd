import type { TextDocument, TextNode } from "../model.js";
import { flattenText, interpolate, rgb } from "./colors.js";
export interface SimplifyOptions {
  tolerance?: number;
}
export interface SimplificationProposal {
  original: TextDocument;
  candidate: TextDocument;
  maximumColorError: number;
  changed: boolean;
}
export function suggestSimplification(
  text: TextDocument,
  options: SimplifyOptions = {},
): SimplificationProposal {
  const original = structuredClone(text),
    candidate = structuredClone(text),
    chars = flattenText(text),
    tolerance = options.tolerance ?? 0;
  const hasPlaceholder = (nodes: TextNode[]): boolean =>
    nodes.some(
      (node) =>
        node.type === "placeholder" ||
        (node.type === "group" && hasPlaceholder(node.children)),
    );
  if (
    hasPlaceholder(text.nodes) ||
    chars.length < 2 ||
    chars.some((c) => c.opaque || c.sprite || c.text === "\n") ||
    chars.some(
      (c) =>
        JSON.stringify({ ...c.style, color: undefined }) !==
        JSON.stringify({ ...chars[0]!.style, color: undefined }),
    )
  )
    return { original, candidate, maximumColorError: 0, changed: false };
  const indices = new Set([0, chars.length - 1]);
  const split = (start: number, end: number) => {
    let maximum = 0,
      worst = -1;
    for (let i = start + 1; i < end; i++) {
      const expected = rgb(
          interpolate(
            [
              { color: chars[start]!.color, position: 0 },
              { color: chars[end]!.color, position: 1 },
            ],
            (i - start) / (end - start),
          ),
        ),
        actual = rgb(chars[i]!.color),
        error = Math.max(...actual.map((c, k) => Math.abs(c - expected[k]!)));
      if (error > maximum) {
        maximum = error;
        worst = i;
      }
    }
    if (maximum > tolerance && worst >= 0) {
      indices.add(worst);
      split(start, worst);
      split(worst, end);
    }
  };
  split(0, chars.length - 1);
  const stops = [...indices]
    .sort((a, b) => a - b)
    .map((i) => ({ color: chars[i]!.color, position: i / (chars.length - 1) }));
  candidate.revision++;
  const { color, gradient, rainbow, ...style } = chars[0]!.style;
  candidate.nodes = [
    {
      id: "suggested-gradient",
      type: "group",
      style: { ...style, gradient: stops },
      children: [
        {
          id: "suggested-text",
          type: "text",
          value: chars.map((c) => c.text).join(""),
        },
      ],
    } satisfies TextNode,
  ];
  const actual = flattenText(candidate);
  const maximumColorError = Math.max(
    ...actual.map((c, i) =>
      Math.max(
        ...rgb(c.color).map((v, k) => Math.abs(v - rgb(chars[i]!.color)[k]!)),
      ),
    ),
  );
  if (maximumColorError > tolerance)
    return {
      original,
      candidate: structuredClone(text),
      maximumColorError: 0,
      changed: false,
    };
  return { original, candidate, maximumColorError, changed: true };
}
