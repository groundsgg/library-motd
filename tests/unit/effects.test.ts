import { expect, it } from "vitest";
import * as core from "../../src/index.js";
it("interpolates uneven stops without moving their positions", () => {
  const doc = core.parseText(
    "<gradient:#ff0000:#00ff00:#0000ff>ABCDEFGH</gradient>",
    "minimessage",
  ).value!;
  const group = doc.nodes[0] as any;
  group.style.gradient[1].position = 5 / 7;
  expect(core.flattenText(doc).map((c) => c.color)).toEqual([
    "#ff0000",
    "#cc3300",
    "#996600",
    "#669900",
    "#33cc00",
    "#00ff00",
    "#008080",
    "#0000ff",
  ]);
});
it("resolves values as text and preserves unknown placeholders with a warning", () => {
  const doc = core.parseText("{{players}} {{missing}}", "minimessage").value!;
  const resolved = core.resolveText(doc, { players: "<red>42" });
  expect(
    core
      .flattenText(resolved.value!)
      .map((c) => c.text)
      .join(""),
  ).toBe("<red>42 {{missing}}");
  expect(resolved.diagnostics[0]?.code).toBe("unknown-placeholder");
});
it("measures narrow glyphs, bold and alignment from the same profile", () => {
  const doc = core.parseText("Mi<b>M</b>", "minimessage").value!;
  const result = core.layoutText(doc, {
    profile: core.java1211Profile,
    width: 40,
    alignments: ["center"],
  });
  expect(result.lines[0]).toEqual({ width: 15, padding: 12 });
  expect(result.glyphs.map((c) => c.advance)).toEqual([6, 2, 7]);
  expect(
    core.layoutText(core.parseText("😀", "minimessage").value!, {
      profile: core.java1211Profile,
      width: 40,
    }).diagnostics[0]?.code,
  ).toBe("missing-glyph");
});
