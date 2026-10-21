import { expect, it } from "vitest";
import * as core from "../../src/index.js";
it("preserves source, nesting, explicit false styles and escaped tag text", () => {
  const raw = "<red>A<b>B</b><!bold>C</!bold>\\<red>";
  const parsed = core.parseText(raw, "minimessage");
  expect(parsed.value?.source?.value).toBe(raw);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.value?.nodes[0]).toMatchObject({
    type: "group",
    style: { color: "#ff5555" },
  });
});
it("protects unsupported subtrees including nested quotes instead of stripping them", () => {
  const raw = '<hover:show_text:"<red>hello > there">secret</hover>';
  const parsed = core.parseText(raw + "<green> next", "minimessage");
  expect(parsed.value?.nodes[0]).toMatchObject({ type: "opaque", raw });
  expect(parsed.diagnostics[0]?.code).toBe("unsupported-tag");
});
it("bounds length and nesting and parses placeholders without evaluating them", () => {
  expect(
    core.parseText("<b>".repeat(129), "minimessage", { maxDepth: 128 }).value,
  ).toBeNull();
  expect(
    core.parseText("long", "minimessage", { maxTextLength: 3 }).value,
  ).toBeNull();
  expect(
    core.parseText("{{players}}<newline>ok", "minimessage").value?.nodes[0],
  ).toMatchObject({ type: "placeholder", name: "players" });
});
