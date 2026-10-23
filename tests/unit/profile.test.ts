import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import * as core from "../../src/index.js";
it("uses proportional glyph advances and reports unsupported glyphs", () => {
  const profile = core.java1211Profile;
  expect(profile.font.advances["M"]).toBe(6);
  expect(profile.font.advances["i"]).toBe(2);
  expect(profile.font.advances[" "]).toBe(4);
  expect(profile.font.supported("😀")).toBe(false);
  expect(existsSync("assets/java-1.21.1/Minecraft.otf")).toBe(true);
  expect(existsSync("assets/java-1.21.1/OFL.txt")).toBe(true);
});

it("includes the native bold advance for spaces", () => {
  const text = core.parseText("<b>Ab iMW 42", "minimessage").value!;
  const layout = core.layoutText(text, {
    profile: core.java263Profile,
    width: 267,
  });
  expect(layout.lines[0]!.width).toBe(55);
  expect(
    layout.glyphs.filter((g) => g.text === " ").map((g) => g.advance),
  ).toEqual([5, 5]);
});

it("warns about decomposed sequences instead of certifying their NFC equivalent", () => {
  const text = core.parseText("é e\u0301\nÄ A\u0308", "minimessage").value!;
  const layout = core.layoutText(text, {
    profile: core.java263Profile,
    width: 267,
  });
  expect(layout.glyphs.map((g) => g.text)).toEqual([
    "é",
    " ",
    "e\u0301",
    "Ä",
    " ",
    "A\u0308",
  ]);
  expect(
    layout.diagnostics.filter((d) => d.code === "missing-glyph"),
  ).toHaveLength(2);
});

it("respects custom metrics for an explicitly supported grapheme sequence", () => {
  const text = core.parseText("e\u0301", "minimessage").value!;
  const profile = {
    ...core.java263Profile,
    font: {
      ...core.java263Profile.font,
      advances: { "e\u0301": 8, é: 6 },
      supported: () => true,
    },
  };
  const layout = core.layoutText(text, { profile, width: 267 });
  expect(layout.lines[0]!.width).toBe(8);
  expect(layout.diagnostics).toEqual([]);
});

it("reports unsupported Unicode and missing-glyph fallbacks for every bundled preset", () => {
  for (const profile of core.clientProfiles) {
    for (const [source, count] of [
      ["Ω Ж 中 😀\n← → ✓ ⚡", 8],
      ["A\u{10ffff}B\nA\u0378B", 2],
    ] as const) {
      const text = core.parseText(source, "minimessage").value!;
      const layout = core.layoutText(text, { profile, width: 267 });
      expect(
        layout.diagnostics.filter((d) => d.code === "missing-glyph"),
      ).toHaveLength(count);
    }
  }
});
