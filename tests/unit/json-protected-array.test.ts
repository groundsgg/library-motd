import { expect, it } from "vitest";
import * as api from "../../src/index.js";

const root = {
  text: "A",
  color: "red",
  bold: true,
  insertion: "inherited metadata must survive",
};
const array: api.JsonValue[] = [root, { text: "B", bold: false }, "C"];
const parse = (value: api.JsonValue) =>
  api.parseText(JSON.stringify(value), "json").value!;
const paint = (document: api.TextDocument) =>
  api
    .layoutText(document, { profile: api.java1211Profile, width: 10000 })
    .glyphs.map(({ text, color, style }) => [text, color, !!style.bold]);

it("matches native first-component styles across a protected array boundary", () => {
  const text = parse(array);
  // Confirmed with the official 26.3 ComponentSerialization codec and visitor.
  expect(paint(text)).toEqual([
    ["A", "#ff5555", true],
    ["B", "#ff5555", false],
    ["C", "#ff5555", true],
  ]);
});

it("preserves dependent array metadata after neighboring edits and persistence", () => {
  const source = JSON.stringify(array, null, 2);
  const text = api.parseText(source, "json").value!;
  expect(api.serializeText(text, { format: "json" }).value).toBe(source);
  const saved = api.readDocument(api.writeDocument(api.createDocument(text)))
    .value!.motd.text;
  saved.nodes.push({ id: "tail", type: "text", value: "!" });
  saved.revision++;
  const exported = JSON.parse(
    api.serializeText(saved, { format: "json" }).value!,
  );
  // Preserve the complete array, so unknown parent metadata still reaches B/C.
  expect(exported.extra).toEqual([array, { text: "!" }]);
  expect(paint(saved)).toEqual([
    ["A", "#ff5555", true],
    ["B", "#ff5555", false],
    ["C", "#ff5555", true],
    ["!", "#aaaaaa", false],
  ]);
  expect(saved.nodes[0]).toMatchObject({
    type: "opaque",
    raw: JSON.stringify(array),
    fallback: "ABC",
  });
  const positions = api.flattenText(saved);
  expect(positions.slice(0, 3).map(({ offset }) => offset)).toEqual([0, 1, 2]);
  expect(new Set(positions.slice(0, 3).map(({ nodeId }) => nodeId)).size).toBe(
    1,
  );
});

it("inherits from the protected array root rather than its last styled child", () => {
  const nested = [
    [
      { ...root, extra: [{ text: "D", color: "gold", bold: false }] },
      { text: "B", bold: false },
    ],
    "C",
  ];
  const text = parse({
    text: "",
    color: "green",
    italic: true,
    extra: [nested, "Z"],
  });
  expect(paint(text)).toEqual([
    ["A", "#ff5555", true],
    ["D", "#ffaa00", false],
    ["B", "#ff5555", false],
    ["C", "#ff5555", true],
    ["Z", "#55ff55", false],
  ]);
  expect(
    api
      .layoutText(text, { profile: api.java1211Profile, width: 10000 })
      .glyphs.every(({ style }) => style.italic),
  ).toBe(true);
  text.nodes.push({ id: "tail", type: "text", value: "!" });
  text.revision++;
  const exported = JSON.parse(
    api.serializeText(text, { format: "json" }).value!,
  );
  expect(exported.extra[0].extra[0]).toEqual(nested);
});

it("keeps later protected entries separate from unrelated editable siblings", () => {
  const text = parse([{ text: "P", color: "green" }, root, "Z"]);
  expect(paint(text)).toEqual([
    ["P", "#55ff55", false],
    ["A", "#ff5555", true],
    ["Z", "#55ff55", false],
  ]);
  const parent = text.nodes[0]!;
  expect(parent.type).toBe("group");
  if (parent.type !== "group") throw new Error("Expected editable parent");
  expect(parent.children.map(({ type }) => type)).toEqual([
    "text",
    "opaque",
    "text",
  ]);
});

it("keeps protected layout splitting and the parsing depth limit enforced", () => {
  const text = parse([{ ...root, text: "M".repeat(42) }, "tail"]);
  const result = api.serializeText(
    text,
    { format: "legacy-section" },
    {
      lossy: "reduce",
      layout: { profile: api.java1211Profile, width: 271 },
    },
  );
  expect(result.value).toBeNull();
  expect(
    result.diagnostics.some(({ code }) => code === "protected-layout"),
  ).toBe(true);
  let deep: api.JsonValue = "Z";
  for (let index = 0; index < 10; index++) deep = [deep];
  expect(
    api.parseText(JSON.stringify([root, deep]), "json", { maxDepth: 8 }).value,
  ).toBeNull();
});
