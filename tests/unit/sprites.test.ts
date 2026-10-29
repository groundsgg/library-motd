import { describe, expect, it } from "vitest";
import {
  createDocument,
  evaluateStatus,
  java1211Profile,
  java263Profile,
  layoutText,
  parseText,
  serializeText,
  validateDocument,
  flattenText,
} from "../../src/index.js";
const input = {
  text: "",
  extra: [
    { text: "A" },
    {
      atlas: "minecraft:gui",
      sprite: "minecraft:icon/trial_available",
      color: "white",
      shadow_color: 0,
    },
    { text: "B" },
  ],
};
const parsed = () => parseText(JSON.stringify(input), "json").value!;
const changed = () => ({ ...parsed(), revision: 1 });
describe("native atlas text", () => {
  it("models one sprite without consuming adjacent text or nested source", () => {
    const text = parsed();
    const glyphs = flattenText(text);
    expect(glyphs.map((g) => g.text).join("")).toBe("A\ufffcB");
    expect(glyphs[1]?.sprite).toEqual({
      atlas: "minecraft:gui",
      sprite: "minecraft:icon/trial_available",
    });
    expect(glyphs[1]?.style.shadowColor).toBe(0);
    expect(validateDocument(createDocument(text)).value).not.toBeNull();
  });
  it("uses native advancement independently of sprite ink and font glyph lookup", () => {
    const text = parseText(
      '<b>A<sprite:"minecraft:gui":"minecraft:icon/trial_available">B</b>',
      "minimessage",
    ).value!;
    const layout = layoutText(text, { profile: java263Profile, width: 100 });
    expect(layout.glyphs.map((g) => g.advance)).toEqual([7, 9, 7]);
    expect(layout.glyphs.map((g) => g.x)).toEqual([0, 7, 16]);
    expect(layout.diagnostics).toEqual([]);
  });
  it("round-trips quoted standard MiniMessage sprite and shadow tags after editing", () => {
    const mm = serializeText(changed(), { format: "minimessage" });
    expect(mm.value).not.toBeNull();
    expect(mm.value).toContain(
      '<sprite:"minecraft:gui":"minecraft:icon/trial_available">',
    );
    const text = parseText(mm.value!, "minimessage").value!;
    expect(
      flattenText(text)
        .map((g) => g.text)
        .join(""),
    ).toBe("A\ufffcB");
    expect(flattenText(text)[1]?.style.shadowColor).toBe(0);
    const native = JSON.parse(
      serializeText(
        { ...text, revision: text.revision + 1 },
        { format: "json" },
      ).value!,
    );
    const again = parseText(JSON.stringify(native), "json").value!;
    expect(flattenText(again)[1]?.sprite).toEqual({
      atlas: "minecraft:gui",
      sprite: "minecraft:icon/trial_available",
    });
  });
  it("materializes aligned native objects rather than replacement characters", () => {
    const serialized = serializeText(
      changed(),
      { format: "json" },
      {
        layout: { profile: java263Profile, width: 100, alignments: ["center"] },
      },
    );
    expect(serialized.value).not.toBeNull();
    const output = JSON.parse(serialized.value!);
    expect(
      output.extra.some(
        (c: Record<string, unknown>) =>
          c.sprite === "minecraft:icon/trial_available",
      ),
    ).toBe(true);
    expect(JSON.stringify(output)).not.toContain("\ufffc");
  });
  it("diagnoses older-client omission and uses that same projection in status output", () => {
    const text = parsed();
    const layout = layoutText(text, { profile: java1211Profile, width: 100 });
    expect(layout.glyphs.map((g) => g.advance)).toEqual([6, 0, 6]);
    expect(layout.diagnostics.map((d) => d.code)).toContain(
      "sprite-unsupported-client",
    );
    const context = {
      base: { version: { protocol: 767, name: "1.21.1" }, description: "" },
      clientProtocol: 767,
      values: {},
      motdLayout: { profile: java1211Profile, width: 100 },
    };
    const out = evaluateStatus(createDocument(text), context);
    expect(JSON.stringify(out.value?.description)).not.toContain('"sprite"');
    expect(out.diagnostics.map((d) => d.code)).toContain(
      "sprite-unsupported-client",
    );
  });
  it("refuses silent legacy conversion and preserves unknown object metadata", () => {
    expect(
      serializeText(changed(), { format: "legacy-section" }).value,
    ).toBeNull();
    const raw = JSON.stringify({
      atlas: "minecraft:gui",
      sprite: "minecraft:icon/trial_available",
      future: { x: 1 },
      extra: [{ text: "tail" }],
    });
    const text = parseText(raw, "json").value!;
    expect(text.nodes[0]?.type).toBe("opaque");
    expect(
      JSON.parse(
        serializeText({ ...text, revision: 1 }, { format: "json" }).value!,
      ).extra[0],
    ).toEqual(JSON.parse(raw));
  });
});

it("keeps modern native sprites when aligned status output has no explicit layout context", () => {
  const doc = createDocument(parsed());
  doc.motd.alignments = ["center", "left"];
  const out = evaluateStatus(doc, {
    base: { version: { protocol: 777, name: "26.3" }, description: "" },
    clientProtocol: 777,
    values: {},
  });
  expect(out.value).not.toBeNull();
  expect(JSON.stringify(out.value?.description)).toContain(
    '"sprite":"minecraft:icon/trial_available"',
  );
  expect(out.diagnostics.map((d) => d.code)).not.toContain(
    "sprite-unsupported-client",
  );
});
it("preserves sprite intent in canonical MiniMessage fallbacks using legacy text-layout defaults", () => {
  const source = serializeText(
    changed(),
    { format: "minimessage" },
    {
      layout: { profile: java1211Profile, width: 271, alignments: ["center"] },
    },
  );
  expect(source.value).toContain(
    '<sprite:"minecraft:gui":"minecraft:icon/trial_available">',
  );
  const roundtrip = parseText(source.value!, "minimessage").value!;
  const glyph = layoutText(roundtrip, {
    profile: java263Profile,
    width: 271,
  }).glyphs.find((g) => g.sprite);
  expect(glyph?.x).toBe(132);
});
