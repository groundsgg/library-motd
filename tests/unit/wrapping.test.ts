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

it("right padding never pushes an otherwise fitting word beyond the line width", () => {
  const doc = text("MM");
  const options = {
    profile: core.java263Profile,
    width: 26,
    alignments: ["right" as const],
  };
  const result = core.layoutText(doc, options);
  expect(result.lines[0]).toEqual({ width: 12, padding: 12 });
  const exported = core.serializeText(
    doc,
    { format: "json" },
    { layout: options },
  ).value!;
  expect(
    core.layoutText(core.parseText(exported, "json").value!, {
      profile: core.java263Profile,
      width: 26,
    }).lines,
  ).toHaveLength(1);
});

it("uses the caller's profile and width for aligned runtime MOTD output", () => {
  const doc = core.createDocument(text("MM MM"));
  doc.motd.alignments = ["center", "right"];
  const context = {
    base: {
      version: { name: "26.3", protocol: 777 },
      players: { online: 1, max: 10, sample: [] },
      description: "",
    },
    clientProtocol: 777,
    values: {},
    motdLayout: { profile: core.java263Profile, width: 24 },
  };
  const status = core.evaluateStatus(doc, context);
  expect(status.value).not.toBeNull();
  const parsed = core.parseText(
    JSON.stringify(status.value!.description),
    "json",
  ).value!;
  expect(
    core
      .flattenText(parsed)
      .map((g) => g.text)
      .join(""),
  ).toBe("  MM\n   MM");
});

it("does not generate invalid padding for a zero-advance custom space", () => {
  const profile = {
    ...core.java263Profile,
    font: {
      ...core.java263Profile.font,
      advances: { ...core.java263Profile.font.advances, " ": 0 },
    },
  };
  const result = core.layoutText(text("MM MM"), {
    profile,
    width: 20,
    alignments: ["right", "center"],
  });
  expect(result.glyphs.every((g) => Number.isFinite(g.x))).toBe(true);
  expect(result.lines.every((line) => line.padding === 0)).toBe(true);
  expect(
    result.diagnostics.some((d) => d.code === "alignment-unavailable"),
  ).toBe(true);
});

it("keeps a CR control fallback and LF boundary separate without losing Windows source", () => {
  const doc = core.parseText(JSON.stringify("M\r\nM"), "json").value!;
  expect(
    core.flattenText(doc).map((g) => [g.text, g.position, g.offset]),
  ).toEqual([
    ["M", 0, 0],
    ["\r", 1, 1],
    ["\n", 2, 2],
    ["M", 3, 3],
  ]);
  const result = core.layoutText(doc, {
    profile: core.java263Profile,
    width: 267,
  });
  expect(result.lines.map((line) => line.width)).toEqual([12, 6]);
  expect(result.glyphs.map((g) => g.line)).toEqual([0, 0, 1]);
  expect(result.diagnostics.some((d) => d.code === "missing-glyph")).toBe(true);
  const encoded = core.serializeText(
    doc,
    { format: "json" },
    { layout: { profile: core.java263Profile, width: 267 } },
  );
  expect(
    core
      .flattenText(core.parseText(encoded.value!, "json").value!)
      .map((g) => g.text)
      .join(""),
  ).toBe("M\r\nM");
});

it.each(["ગુજરાતી", "తెలుగు", "සිංහල", "a\u200fb", "a\u200eb", "a\u061cb"])(
  "does not certify custom metrics as contextual layout support for %j",
  (source) => {
    const profile = {
      ...core.java263Profile,
      font: { ...core.java263Profile.font, supported: () => true },
    };
    const result = core.layoutText(text(source), { profile, width: 267 });
    expect(
      result.diagnostics.some((d) => d.code === "unsupported-text-layout"),
    ).toBe(true);
  },
);

it.each(["M\n", "\n", "", "M\r\nM"])(
  "rejects protected layout for %j rather than dropping raw or duplicating boundaries",
  (fallback) => {
    const raw = "<custom>" + fallback + "</custom>";
    const doc: core.TextDocument = {
      revision: 0,
      nodes: [
        {
          id: "protected",
          type: "opaque",
          format: "minimessage",
          raw,
          fallback,
        },
      ],
    };
    const result = core.serializeText(
      doc,
      { format: "minimessage" },
      { layout: { profile: core.java263Profile, width: 267 } },
    );
    expect(result.value).toBeNull();
    expect(result.diagnostics.some((d) => d.code === "protected-layout")).toBe(
      true,
    );
    expect(core.serializeText(doc, { format: "minimessage" }).value).toBe(raw);
  },
);

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
