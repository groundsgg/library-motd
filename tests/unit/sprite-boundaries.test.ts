import { expect, it } from "vitest";
import {
  parseText,
  serializeText,
  flattenText,
  createDocument,
  validateDocument,
  java263Profile,
  layoutText,
  suggestSimplification,
} from "../../src/index.js";
it("supports standard default-atlas and quoted custom namespaces without treating IDs as URLs", () => {
  for (const [source, atlas, sprite] of [
    ["<sprite:item/emerald>", "minecraft:blocks", "minecraft:item/emerald"],
    ["<sprite:gui:'grounds:icon/star'/>", "minecraft:gui", "grounds:icon/star"],
  ] as const) {
    const text = parseText(source, "minimessage").value!;
    expect(flattenText(text)[0]?.sprite).toEqual({ atlas, sprite });
    expect(
      serializeText({ ...text, revision: 1 }, { format: "minimessage" }).value,
    ).toBe(`<sprite:"${atlas}":"${sprite}">`);
  }
  for (const raw of [
    '<sprite:"https://example.org/a">',
    '<sprite:gui:"grounds:../secret">',
    '<sprite:gui:"grounds:UPPER">',
  ])
    expect(parseText(raw, "minimessage").value?.nodes[0]?.type).toBe("opaque");
});
it("keeps component array inheritance and sprite extras as independent source leaves", () => {
  const text = parseText(
    JSON.stringify([
      {
        sprite: "icon/trial_available",
        atlas: "minecraft:gui",
        bold: true,
        extra: [{ text: "A" }],
      },
      { text: "B", bold: false },
    ]),
    "json",
  ).value!;
  const g = layoutText(text, { profile: java263Profile, width: 100 }).glyphs;
  expect(g.map((c) => c.text).join("")).toBe("\ufffcAB");
  expect(g.map((c) => c.advance)).toEqual([9, 7, 6]);
});
it("cannot simplify sprite ownership into gradient text and rejects invalid persisted IDs", () => {
  const text = parseText(
    "A<sprite:gui:icon/trial_available>B",
    "minimessage",
  ).value!;
  expect(suggestSimplification(text).changed).toBe(false);
  const doc = createDocument(text);
  const nodes = doc.motd.text.nodes as any[];
  nodes[1].sprite = "https://example.org/file";
  expect(validateDocument(doc).value).toBeNull();
});
it("reports explicit lossy legacy projection while retaining neighboring text", () => {
  const text = parseText(
    "A<sprite:gui:icon/trial_available>B",
    "minimessage",
  ).value!;
  const out = serializeText(
    text,
    { format: "legacy-section" },
    { lossy: "reduce" },
  );
  expect(out.value?.replace(/§./g, "")).toBe("AB");
  expect(out.diagnostics.map((d) => d.code)).toContain(
    "sprite-unsupported-format",
  );
});
it("matches Adventure shadow alpha float truncation rather than rounding", () => {
  for (const [source, want] of [
    ["<shadow:white>A", 0x3fffffff],
    ["<shadow:white:0.5>A", 0x7fffffff],
    ["<shadow:white:1>A", 0xffffffff],
  ] as const) {
    expect(
      flattenText(parseText(source, "minimessage").value!)[0]?.style
        .shadowColor,
    ).toBe(want);
  }
});
