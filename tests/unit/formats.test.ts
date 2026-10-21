import { expect, it } from "vitest";
import * as core from "../../src/index.js";
it("round trips unchanged input exactly for every text format", () => {
  for (const [format, input] of [
    ["minimessage", "<red>A<b>B</b>"],
    ["legacy-ampersand", "&aHi&r there"],
    ["legacy-section", "§lA§r B"],
    ["properties", "\\  hello\\nnext"],
    ["json", '{"text":"A","bold":true,"extra":[{"text":"B","bold":false}]}'],
  ] as const) {
    const parsed = core.parseText(input, format);
    expect(parsed.value).not.toBeNull();
    expect(core.serializeText(parsed.value!, { format, rgb: true }).value).toBe(
      input,
    );
  }
});
it("emits style resets on plain spaces and escapes Properties backslashes", () => {
  const doc = core.parseText("<b>A</b> B", "minimessage").value!;
  const legacy = core.serializeText(doc, {
    format: "legacy-section",
    rgb: false,
  }).value!;
  const parsed = core.parseText(legacy, "legacy-section").value!;
  expect(core.flattenText(parsed).map((c) => [c.text, !!c.style.bold])).toEqual(
    [
      ["A", true],
      [" ", false],
      ["B", false],
    ],
  );
  const literal = core.parseText(
    " path\\name<newline>next",
    "minimessage",
  ).value!;
  const props = core.serializeText(literal, {
    format: "properties",
    rgb: false,
  }).value!;
  expect(props).toContain("\\\\");
  expect(props).toContain("\\n");
  expect(
    core
      .flattenText(core.parseText(props, "properties").value!)
      .map((c) => c.text)
      .join(""),
  ).toBe(" path\\name\nnext");
});
it("honors explicit false JSON decoration and refuses silent RGB/opaque loss", () => {
  const doc = core.parseText(
    '{"text":"A","bold":true,"extra":[{"text":"B","bold":false}]}',
    "json",
  ).value!;
  expect(core.flattenText(doc).map((c) => !!c.style.bold)).toEqual([
    true,
    false,
  ]);
  const rgb = core.parseText("<#123456>A", "minimessage").value!;
  expect(
    core.serializeText(rgb, { format: "legacy-section", rgb: false }).value,
  ).toBeNull();
  expect(
    core.serializeText(
      rgb,
      { format: "legacy-section", rgb: false },
      { lossy: "reduce" },
    ).value,
  ).not.toBeNull();
  const opaque = core.parseText("<font:custom>x</font>", "minimessage").value!;
  expect(
    core.serializeText(opaque, { format: "legacy-section", rgb: true }).value,
  ).toBeNull();
});
