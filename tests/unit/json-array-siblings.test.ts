import { expect, it } from "vitest";
import * as api from "../../src/index.js";

it.each([{ empty: [] }, { empty: [[]] }, { empty: [[[]]] }])(
  "keeps all accepted component-array siblings after an empty first value: $empty",
  ({ empty }) => {
    const source = JSON.stringify([
      [
        empty,
        { text: "A", color: "red", bold: true },
        { text: "B", color: "gold", bold: false },
        "C",
      ],
      "D",
      { text: "E", bold: false },
    ]);
    const text = api.parseText(source, "json").value!;
    expect(
      api
        .flattenText(text)
        .map(({ text }) => text)
        .join(""),
    ).toBe("ABCDE");
    expect(api.serializeText(text, { format: "json" }).value).toBe(source);
    const layout = api.layoutText(text, {
      profile: api.java1211Profile,
      width: 10000,
    });
    expect(
      layout.glyphs.map(({ text, color, style }) => [
        text,
        color,
        !!style.bold,
      ]),
    ).toEqual([
      ["A", "#ff5555", true],
      ["B", "#ffaa00", false],
      ["C", "#ff5555", true],
      ["D", "#ff5555", true],
      ["E", "#ff5555", false],
    ]);
    const ids: string[] = [];
    const collect = (nodes: api.TextNode[]) =>
      nodes.forEach((node) => {
        ids.push(node.id);
        if (node.type === "group") collect(node.children);
      });
    collect(text.nodes);
    expect(new Set(ids).size).toBe(ids.length);
    const saved = api.readDocument(api.writeDocument(api.createDocument(text)))
      .value!.motd.text;
    saved.nodes.push({ id: "tail", type: "text", value: "!" });
    saved.revision++;
    const exported = api.serializeText(saved, { format: "json" }).value!;
    const roundtrip = api.parseText(exported, "json").value!;
    expect(
      api
        .flattenText(roundtrip)
        .map(({ text }) => text)
        .join(""),
    ).toBe("ABCDE!");
  },
);

it("retains a later protected subtree inside a flattened first component", () => {
  const protectedComponent = {
    text: "B",
    insertion: "preserved",
    color: "gold",
    bold: false,
  };
  const text = api.parseText(
    JSON.stringify([
      [[], { text: "A", color: "red" }, protectedComponent, "C"],
      "D",
    ]),
    "json",
  ).value!;
  expect(
    api
      .flattenText(text)
      .map(({ text }) => text)
      .join(""),
  ).toBe("ABCD");
  text.nodes.push({ id: "tail", type: "text", value: "!" });
  text.revision++;
  const exported = api.serializeText(text, { format: "json" }).value!;
  expect(exported).toContain(JSON.stringify(protectedComponent));
  expect(
    api
      .flattenText(api.parseText(exported, "json").value!)
      .map(({ text }) => text)
      .join(""),
  ).toBe("ABCD!");
});
