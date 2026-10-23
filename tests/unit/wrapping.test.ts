import { expect, it } from "vitest";
import * as core from "../../src/index.js";

const text = (source: string) => core.parseText(source, "minimessage").value!;
const layout = (source: string, width: number) =>
  core.layoutText(text(source), { profile: core.java263Profile, width });
const visibleLines = (result: ReturnType<typeof layout>) =>
  result.lines.map((_, line) =>
    result.glyphs
      .filter((g) => g.line === line && !g.suppressed)
      .map((g) => g.text)
      .join(""),
  );

it.each([
  ["MM MM", 20, ["MM", "MM"], [12, 12]],
  ["MM  MM", 20, ["MM ", "MM"], [16, 12]],
  [" MM", 12, ["", "MM"], [0, 12]],
  ["MM ", 12, ["MM"], [12]],
  ["MMMMM", 12, ["MM", "MM", "M"], [12, 12, 6]],
  ["MM\n\nM\n", 20, ["MM", "", "M", ""], [12, 0, 6, 0]],
  ["M", 0, ["M"], [6]],
] as const)(
  "wraps %j at width %s using native delimiters",
  (source, width, lines, widths) => {
    const result = layout(source, width);
    expect(visibleLines(result)).toEqual(lines);
    expect(result.lines.map((line) => line.width)).toEqual(widths);
    expect(result.glyphs.map((g) => g.text).join("")).toBe(
      source.replaceAll("\n", ""),
    );
  },
);

it("finds spaces across style boundaries without losing source offsets", () => {
  const result = layout("<gold>MM </gold><aqua>MM", 20);
  expect(visibleLines(result)).toEqual(["MM", "MM"]);
  expect(result.glyphs.map((g) => [g.position, g.offset])).toEqual([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 0],
    [4, 1],
  ]);
  expect(result.glyphs.at(-1)?.color).toBe("#55ffff");
});

it("retains all source and reports lines hidden after native wrapping", () => {
  const doc = text("MM MM MM");
  const before = JSON.stringify(doc);
  const result = core.layoutText(doc, {
    profile: core.java263Profile,
    width: 12,
  });
  expect(visibleLines(result)).toEqual(["MM", "MM", "MM"]);
  expect(result.diagnostics.some((d) => d.code === "hidden-lines")).toBe(true);
  expect(JSON.stringify(doc)).toBe(before);
});

it("preserves legacy grapheme wrapping for custom profiles without the capability", () => {
  const profile = {
    ...core.java263Profile,
    font: { ...core.java263Profile.font },
  };
  delete profile.font.layout;
  const result = core.layoutText(text("MM MM"), { profile, width: 20 });
  expect(visibleLines(result)).toEqual(["MM ", "MM"]);
});

it("keeps explicitly measured combining clusters atomic at a word boundary", () => {
  const profile = {
    ...core.java263Profile,
    font: {
      ...core.java263Profile.font,
      advances: { ...core.java263Profile.font.advances, "e\u0301": 8 },
      supported: (g: string) =>
        g === "e\u0301" || core.java263Profile.font.supported(g),
    },
  };
  const result = core.layoutText(text("M e\u0301"), { profile, width: 12 });
  expect(visibleLines(result)).toEqual(["M", "e\u0301"]);
  expect(result.glyphs.at(-1)?.advance).toBe(8);
  expect(result.diagnostics.some((d) => d.code === "missing-glyph")).toBe(
    false,
  );
});

it.each(["abc אבג", "العربية", "नमस्ते", "a\u202eb", "ไทย"])(
  "warns that %j requires shaping beyond the LTR capability",
  (source) => {
    const result = layout(source, 271);
    expect(
      result.diagnostics.some((d) => d.code === "unsupported-text-layout"),
    ).toBe(true);
    expect(result.glyphs.map((g) => g.text).join("")).toBe(source);
  },
);

it("rejects layout that would insert a visual break inside a dynamic token", () => {
  const doc = text("{{players}}");
  const result = core.serializeText(
    doc,
    { format: "minimessage" },
    {
      layout: { profile: core.java263Profile, width: 12 },
    },
  );
  expect(result.value).toBeNull();
  expect(result.diagnostics.some((d) => d.code === "protected-layout")).toBe(
    true,
  );
  expect(core.serializeText(doc, { format: "minimessage" }).value).toBe(
    "{{players}}",
  );
});

it.each(["json", "minimessage", "legacy-section"] as const)(
  "materializes visual line breaks and per-line alignment for %s export",
  (format) => {
    const doc = text("MM MM");
    const result = core.serializeText(
      doc,
      { format },
      {
        layout: {
          profile: core.java263Profile,
          width: 24,
          alignments: ["center", "right"],
        },
      },
    );
    expect(result.value).not.toBeNull();
    const exported = core.parseText(result.value!, format).value!;
    expect(
      core
        .flattenText(exported)
        .map((c) => c.text)
        .join(""),
    ).toBe("  MM\n   MM");
    expect(core.serializeText(doc, { format: "minimessage" }).value).toBe(
      "MM MM",
    );
  },
);
