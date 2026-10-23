import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { openEntryTool } from "./editor-actions.js";

test.use({ screenshot: "only-on-failure" });
const windows = process.platform === "win32";
// DirectWrite softens the horizontal edges even at integer GUI scale. Compare
// occupied foreground cells separately from that platform-specific fringe.
function coverage(image: PNG, color: number[]) {
  return Array.from({ length: image.width * image.height }, (_, i) => {
    const [r, g, b] = image.data.subarray(i * 4, i * 4 + 3);
    return color[0] === 255
      ? Number(r! > 200 && g! > 130 && b! < 40)
      : color[2] === 85
        ? Number(g! > 200 && r! < 110 && b! < 110)
        : Number(g! > 200 && b! > 200 && r! < 110);
  });
}
const shadowAnchors: Record<string, number[][]> = {
  ascii: [
    [65, 13],
    [49, 30],
  ],
  bold: [
    [28, 14],
    [28, 32],
  ],
  latin1: [
    [81, 12],
    [24, 31],
  ],
  underlined: [
    [91, 16],
    [21, 38],
  ],
  strikethrough: [
    [23, 12],
    [23, 30],
  ],
  shadow: [
    [113, 12],
    [49, 30],
  ],
};

const versions = [
  ["1.20.4", "java1204Profile"],
  ["1.21.1", "java1211Profile"],
  ["1.21.11", "java12111Profile"],
  ["26.1", "java261Profile"],
  ["26.1.1", "java2611Profile"],
  ["26.1.2", "java2612Profile"],
  ["26.2", "java262Profile"],
  ["26.3", "java263Profile"],
] as const;
type CaptureCase = { id: string; description: unknown };
function mask(image: PNG, color: number[]) {
  return Array.from({ length: image.width * image.height }, (_, i) =>
    color.every((value, c) => image.data[i * 4 + c] === value) ? 1 : 0,
  );
}

test("pinned hover underlines follow the larger tool font", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
  await page.evaluate(() => {
    window.doc.hover = {
      mode: "custom",
      text: window.api.parseText(
        "<gold>H</gold><green><u>H</u></green>",
        "minimessage",
      ).value!,
    };
    window.setEditorOptions();
  });
  await openEntryTool(page, "Player hover");
  await page.evaluate(() => document.fonts.ready);
  const im = PNG.sync.read(
    await page
      .getByRole("textbox", { name: "Hover inline editor", exact: true })
      .screenshot(),
  );
  const bottom = (color: number[]) =>
    Math.max(
      ...(windows ? coverage(im, color) : mask(im, color)).flatMap(
        (value, index) => (value ? [Math.floor(index / im.width)] : []),
      ),
    );
  expect(bottom([255, 170, 0])).toBeGreaterThan(0);
  expect(bottom([85, 255, 85])).toBeGreaterThan(bottom([255, 170, 0]));
});

for (const wrapping of [false, true])
  test(`extra ${wrapping ? "wrapped" : "imported"} lines stay in the document without leaking into the row`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/host.html");
    await page.waitForFunction(
      () => typeof window.editor?.execute === "function",
    );
    await page.evaluate((wrapping) => {
      window.context = {
        ...window.context,
        profile: window.api.java263Profile,
      };
      window.setEditorOptions({ context: window.context });
      window.editor.execute({
        type: "replace-source",
        source: wrapping
          ? `<gold>${"M".repeat(88)}</gold><light_purple>Hidden`
          : "<u>First<newline>Second</u><newline><light_purple>Hidden",
      });
      window.preview.update({ document: window.doc, context: window.context });
    }, wrapping);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("#editor .ProseMirror").first()).toContainText(
      "Hidden",
    );
    for (const host of ["preview", "editor"]) {
      const row = PNG.sync.read(
        await page.locator(`#${host} .mcp-row`).screenshot(),
      );
      expect(mask(row, [255, 85, 255]).some(Boolean)).toBe(false);
    }
  });

test("inline gradients use the same quarter-brightness shadows as the viewer", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
  await page.evaluate(() => {
    window.context = { ...window.context, profile: window.api.java263Profile };
    window.setEditorOptions({ context: window.context });
    window.editor.execute({
      type: "replace-source",
      source:
        "<gradient:#ff0000:#0000ff>HHH</gradient><newline><rainbow>HHH</rainbow>",
    });
    window.preview.update({ document: window.doc, context: window.context });
  });
  await page.evaluate(() => document.fonts.ready);
  const viewer = PNG.sync.read(
    await page.locator("#preview .mcp-motd").screenshot(),
  );
  const editor = PNG.sync.read(
    await page.locator("#editor .mcp-motd").screenshot(),
  );
  for (const color of [
    [63, 0, 0],
    [32, 0, 32],
    [0, 0, 63],
    [0, 63, 0],
  ]) {
    expect(mask(viewer, color).some(Boolean), `viewer ${color}`).toBe(true);
    expect(mask(editor, color), `editor ${color}`).toEqual(mask(viewer, color));
  }
});

test("changing the viewport recomputes the editor's visible glyphs", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
  await page.evaluate(() => {
    window.editor.execute({
      type: "replace-source",
      source: `<gold>${"M".repeat(40)}</gold><light_purple>End`,
    });
  });
  await page.evaluate(() => document.fonts.ready);
  for (const [width, visible] of [
    [300, false],
    [854, true],
  ] as const) {
    await page.evaluate((width) => {
      window.context = { ...window.context, viewportWidth: width };
      window.setEditorOptions({ context: window.context });
    }, width);
    const row = PNG.sync.read(
      await page.locator("#editor .mcp-row").screenshot(),
    );
    expect(mask(row, [255, 85, 255]).some(Boolean)).toBe(visible);
  }
});

for (const atom of [false, true])
  test(`editor and viewer share glyph wrapping near ${atom ? "atomic placeholders" : "word boundaries"}`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/host.html");
    await page.waitForFunction(
      () => typeof window.editor?.execute === "function",
    );
    await page.evaluate((atom) => {
      window.context = {
        ...window.context,
        profile: window.api.java263Profile,
        viewportWidth: 854,
        values: { long: "M".repeat(85) + "X" },
      };
      window.setEditorOptions({ context: window.context });
      window.editor.execute({
        type: "replace-source",
        source: atom
          ? "<gold>{{long}}</gold>"
          : `<gold>${"M".repeat(40)} ${"M".repeat(43)} </gold><light_purple>X`,
      });
      window.preview.update({ document: window.doc, context: window.context });
    }, atom);
    await page.evaluate(() => document.fonts.ready);
    const viewer = PNG.sync.read(
      await page.locator("#preview .mcp-row").screenshot(),
    );
    const editor = PNG.sync.read(
      await page.locator("#editor .mcp-row").screenshot(),
    );
    for (const color of [
      [255, 170, 0],
      [255, 85, 255],
    ]) {
      const reference = mask(viewer, color);
      expect(
        mask(editor, color).filter((value, index) => value !== reference[index])
          .length,
        `${color} mismatched pixels`,
      ).toBe(0);
    }
    if (atom) {
      await expect(page.locator("#editor .mce-token")).toHaveCount(1);
      expect(
        await page.evaluate(
          () =>
            window.api.serializeText(window.doc.motd.text, {
              format: "minimessage",
              rgb: true,
            }).value,
        ),
      ).toContain("{{long}}");
    }
  });

test("multiline placeholder values keep line breaks inside one atom", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
  await page.evaluate(() => {
    window.context = {
      ...window.context,
      profile: window.api.java263Profile,
      values: { long: "First\nSecond\nHidden" },
    };
    window.setEditorOptions({ context: window.context });
    window.editor.execute({
      type: "replace-source",
      source: "<gold>{{long}}</gold>",
    });
    window.preview.update({ document: window.doc, context: window.context });
  });
  await page.evaluate(() => document.fonts.ready);
  const viewer = PNG.sync.read(
    await page.locator("#preview .mcp-row").screenshot(),
  );
  const editor = PNG.sync.read(
    await page.locator("#editor .mcp-row").screenshot(),
  );
  expect(mask(editor, [255, 170, 0])).toEqual(mask(viewer, [255, 170, 0]));
  await expect(page.locator("#editor .mce-token")).toHaveCount(1);
  await expect(page.locator("#editor .mce-token")).toHaveText(
    "First\nSecond\nHidden",
  );
});

for (const bold of [false, true])
  test(`obfuscation keeps measured advance classes (${bold ? "bold" : "regular"})`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto("/tests/browser/host.html");
    await page.waitForFunction(
      () => typeof window.editor?.execute === "function",
    );
    await page.evaluate((bold) => {
      window.editor.execute({
        type: "replace-source",
        source: `<obfuscated>${bold ? "<b>" : ""}Ab iMW 42`,
      });
    }, bold);
    const frames = [];
    for (let frame = 0; frame < 4; frame++) {
      await page.clock.fastForward(80);
      frames.push(
        await page
          .locator("#preview .mcp-motd .mcp-glyph")
          .evaluateAll((glyphs) =>
            glyphs.map((node) => {
              const glyph = node as HTMLElement;
              return {
                text: glyph.textContent!,
                x: glyph.style.left,
                width: glyph.style.width,
                advance:
                  window.context.profile.font.advances[glyph.textContent!],
              };
            }),
          ),
      );
    }
    expect(
      new Set(frames.map((frame) => frame.map((glyph) => glyph.text).join("")))
        .size,
    ).toBeGreaterThan(1);
    for (const frame of frames) {
      expect(frame.map((g) => g.advance)).toEqual([6, 6, 4, 2, 6, 6, 4, 6, 6]);
      expect(frame.map((g) => [g.x, g.width])).toEqual(
        frames[0]!.map((g) => [g.x, g.width]),
      );
      expect(frame[2]!.text).toBe(" ");
      expect(frame[6]!.text).toBe(" ");
    }
  });
for (const [version, profile] of versions) {
  const path = `tests/fixtures/client/native-font/${version}`;
  const cases = (
    JSON.parse(readFileSync(`${path}/manifest.json`, "utf8")) as {
      cases: CaptureCase[];
    }
  ).cases;
  for (const id of [
    "ascii",
    "bold",
    "latin1",
    "shadow",
    "underlined",
    "strikethrough",
  ]) {
    test(`native ${version} ${id} ink and shadows in viewer and editor`, async ({
      page,
    }) => {
      await page.goto("/tests/browser/host.html");
      await page.waitForFunction(
        () => typeof window.editor?.execute === "function",
      );
      await page.evaluate(
        ({ profile, description }) => {
          const text = window.api.parseText(
            JSON.stringify(description),
            "json",
          ).value!;
          window.doc = window.api.createDocument(text);
          window.context = {
            ...window.context,
            profile: window.api[profile],
            viewportWidth: 854,
            viewportHeight: 480,
            animations: false,
          };
          window.preview.update({
            document: window.doc,
            context: window.context,
          });
          window.setEditorOptions({ context: window.context });
        },
        { profile, description: cases.find((c) => c.id === id)!.description },
      );
      await page.evaluate(() => document.fonts.ready);
      const native = PNG.sync.read(readFileSync(`${path}/${id}.png`));
      for (const host of ["preview", "editor"]) {
        const row = PNG.sync.read(
          await page.locator(`#${host} .mcp-row`).screenshot(),
        );
        const crop = new PNG({ width: 440, height: 42 });
        PNG.bitblt(row, crop, 68, 22, 440, 42, 0, 0);
        for (const [colorIndex, color] of [
          [255, 170, 0],
          [85, 255, 255],
          [63, 42, 0],
          [21, 63, 63],
        ].entries()) {
          const reference = mask(native, color);
          if (windows && colorIndex >= 2 && reference.some(Boolean)) {
            const [x, y] = shadowAnchors[id]![colorIndex - 2]!;
            const offset = (y! * native.width + x!) * 4;
            expect([...native.data.subarray(offset, offset + 3)]).toEqual(
              color,
            );
            expect
              .soft(
                [...crop.data.subarray(offset, offset + 3)],
                `${host} shadow anchor`,
              )
              .toEqual(color);
            continue;
          }
          expect
            .soft(
              (windows && colorIndex < 2
                ? coverage(crop, color)
                : mask(crop, color)
              ).filter((value, index) => value !== reference[index]).length,
              `${host} ${color} mismatched pixels`,
            )
            .toBe(0);
        }
      }
    });
  }
}
