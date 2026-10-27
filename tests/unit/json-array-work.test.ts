import { expect, it } from "vitest";
import {
  parseText,
  serializeText,
  flattenText,
  type JsonValue,
  type TextNode,
} from "../../src/index.js";
import { parseJsonText } from "../../src/core/text/json.js";

it.each([
  { label: "text", leaf: "A" as JsonValue },
  { label: "empty", leaf: [] as JsonValue },
  {
    label: "protected",
    leaf: { text: "A", color: "red", insertion: "preserved" } as JsonValue,
  },
])(
  "processes nested component arrays with linear element reads: $label",
  ({ leaf }) => {
    const depth = 12;
    let reads = 0;
    let value = leaf;
    for (let index = 0; index < depth; index++) {
      value = new Proxy([value], {
        get(target, key, receiver) {
          if (key === "0") reads++;
          return Reflect.get(target, key, receiver);
        },
      });
    }
    const parsed = parseJsonText(value);
    expect(
      flattenText(parsed)
        .map((char) => char.text)
        .join(""),
    ).toBe(Array.isArray(leaf) ? "" : "A");
    // Check the small instrumented shape before attempting the full depth limit:
    // a regressed implementation fails here without hanging the test runner.
    expect(reads).toBeLessThanOrEqual(depth * 2);
    const source = "[".repeat(128) + JSON.stringify(leaf) + "]".repeat(128);
    const publicResult = parseText(source, "json").value!;
    expect(publicResult).not.toBeNull();
    expect(serializeText(publicResult, { format: "json" }).value).toBe(source);
    expect(parseText(source, "json", { maxDepth: 8 }).value).toBeNull();
  },
);

it("preserves mixed array order, first-component inheritance and unique node identities", () => {
  const plainFirst = parseText(
    '["A",{"text":"B","color":"gold"},[],["C","D"]]',
    "json",
  ).value!;
  expect(
    flattenText(plainFirst).map((char) => [char.text, char.color]),
  ).toEqual([
    ["A", "#aaaaaa"],
    ["B", "#ffaa00"],
    ["C", "#aaaaaa"],
    ["D", "#aaaaaa"],
  ]);
  const styledFirst = parseText(
    '[[{"text":"A","color":"red","bold":true},"B"],"C"]',
    "json",
  ).value!;
  expect(
    flattenText(styledFirst).every(
      (char) => char.color === "#ff5555" && char.style.bold,
    ),
  ).toBe(true);
  for (const document of [plainFirst, styledFirst]) {
    const ids: string[] = [];
    const collect = (nodes: TextNode[]) =>
      nodes.forEach((node) => {
        ids.push(node.id);
        if (node.type === "group") collect(node.children);
      });
    collect(document.nodes);
    expect(new Set(ids).size).toBe(ids.length);
  }
});
