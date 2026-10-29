import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  clientProfiles,
  flattenText,
  java263Profile,
  layoutText,
  parseText,
  resolveText,
  serializeText,
  type Alignment,
  type TextFormat,
} from "../../src/index.js";
const cases = JSON.parse(
  readFileSync(
    new URL("../fixtures/alignment/native-padding.json", import.meta.url),
    "utf8",
  ),
) as {
  id: string;
  width: number;
  source: string;
  values: Record<string, string>;
  alignments: Alignment[];
  expected: { width: number; padding: number; regular: number; bold: number }[];
}[];
for (const sample of cases)
  it(`materializes native padding consistently: ${sample.id}`, () => {
    const original = parseText(sample.source, "minimessage").value!;
    const text = resolveText(original, sample.values).value!;
    const options = {
      profile: java263Profile,
      width: sample.width,
      alignments: sample.alignments,
    };
    const result = layoutText(text, options);
    expect(
      result.lines.map(({ width, padding }) => ({ width, padding })),
    ).toEqual(
      sample.expected.map(({ width, padding }) => ({ width, padding })),
    );
    for (const format of [
      "minimessage",
      "json",
      "legacy-section",
      "legacy-ampersand",
    ] as TextFormat[]) {
      const output = serializeText(text, { format }, { layout: options });
      expect(output.value, JSON.stringify(output.diagnostics)).not.toBeNull();
      const chars = flattenText(parseText(output.value!, format).value!);
      const lines = [[] as typeof chars];
      for (const char of chars)
        if (char.text === "\n") lines.push([]);
        else lines.at(-1)!.push(char);
      sample.expected.forEach((expected, line) => {
        const prefix = lines[line]!.slice(0, expected.regular + expected.bold);
        expect(prefix.map((c) => c.text).join("")).toBe(
          " ".repeat(prefix.length),
        );
        expect(prefix.filter((c) => !!c.style.bold)).toHaveLength(
          expected.bold,
        );
        const first = lines[line]![prefix.length];
        const originalFirst = flattenText(text).filter((c) => c.text !== "\n");
        if (line === 0 && first)
          expect(!!first.style.bold).toBe(!!originalFirst[0]?.style.bold);
      });
      expect(
        layoutText(parseText(output.value!, format).value!, {
          profile: java263Profile,
          width: sample.width,
        }).lines.map((l) => l.width),
      ).toEqual(sample.expected.map((l) => l.width + l.padding));
    }
    expect(serializeText(original, { format: "minimessage" }).value).toBe(
      sample.source,
    );
  });
it("chooses the closest representable padding without wrapping for every bundled profile", () => {
  for (const profile of clientProfiles)
    for (const alignment of ["center", "right"] as const)
      for (let remaining = 0; remaining <= 280; remaining++) {
        const result = layoutText(parseText("A", "minimessage").value!, {
          profile,
          width: 6 + remaining,
          alignments: [alignment],
        });
        const target = alignment === "center" ? remaining / 2 : remaining;
        const candidates = [] as number[];
        for (let bold = 0; bold <= 3; bold++)
          for (let regular = 0; regular * 4 + bold * 5 <= remaining; regular++)
            candidates.push(regular * 4 + bold * 5);
        const expected = candidates.sort(
          (a, b) => Math.abs(a - target) - Math.abs(b - target) || b - a,
        )[0];
        expect(
          result.lines[0]!.padding,
          `${profile.id} ${alignment} ${remaining}`,
        ).toBe(expected);
        expect(result.lines).toHaveLength(1);
      }
});
it("keeps the conservative regular-space behavior for a custom non-native font", () => {
  const profile = {
    ...java263Profile,
    font: { ...java263Profile.font, layout: undefined },
  };
  expect(
    layoutText(parseText("A", "minimessage").value!, {
      profile,
      width: 13,
      alignments: ["right"],
    }).lines[0]!.padding,
  ).toBe(4);
});
