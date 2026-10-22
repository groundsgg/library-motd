import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixtures: { input: string; component: unknown }[] = JSON.parse(
  readFileSync("tests/fixtures/text/adventure.json", "utf8"),
);
for (const fixture of fixtures.filter((f) =>
  /<(gradient|rainbow)/.test(f.input),
)) {
  test(`inline colors match Adventure reference: ${fixture.input}`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/host.html");
    await page.waitForFunction(() => !!window.editor);
    const expected = await page.evaluate(({ input, component }) => {
      window.editor.execute({
        type: "replace-source",
        source: input,
        format: "minimessage",
      });
      return window.api
        .flattenText(
          window.api.parseText(JSON.stringify(component), "json").value,
        )
        .filter((glyph) => glyph.text !== "\n")
        .map((glyph) => ({
          text: glyph.text,
          color: glyph.color.toLowerCase(),
        }));
    }, fixture);
    expect(await inlineColors(page)).toEqual(expected);
  });
}

async function inlineColors(page: Page) {
  return await page
    .locator("#editor [data-editor-field=motd] .ProseMirror")
    .evaluate((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const glyphs: { text: string; color: string }[] = [];
      let node;
      while ((node = walker.nextNode())) {
        const color = getComputedStyle(node.parentElement!).color;
        const rgb = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map((c) => Number(c).toString(16).padStart(2, "0"))
          .join("");
        for (const part of new Intl.Segmenter(undefined, {
          granularity: "grapheme",
        }).segment(node.textContent ?? ""))
          glyphs.push({ text: part.segment, color: `#${rgb}` });
      }
      return glyphs;
    });
}

for (const [text, visible] of [
  ["WiWi", ["W", "i", "W", "i"]],
  ["Wi<newline>Wi", ["W", "i", "W", "i"]],
  ["{{players}}Wi", ["4", "2", "W", "i"]],
] as const) {
  test(`uses per-glyph positions for ${text}`, async ({ page }) => {
    await page.goto("/tests/browser/host.html");
    await page.waitForFunction(() => !!window.editor);
    await page.evaluate(
      (text) =>
        window.editor.execute({
          type: "replace-source",
          source: `<gradient:#ff0000:#0000ff>${text}</gradient>`,
        }),
      text,
    );
    expect(await inlineColors(page)).toEqual(
      visible.map((text, i) => ({
        text,
        color: ["#ff0000", "#aa0055", "#5500aa", "#0000ff"][i],
      })),
    );
  });
}

test("keeps selection, effect semantics, placeholders and protected source through typing and undo", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  const before = await page.evaluate(() => {
    window.editor.execute({
      type: "replace-source",
      source:
        "<gradient:#ff0000:#0000ff>Wi {{players}}<font:custom>X</font></gradient>",
    });
    return window.api.serializeText(window.doc.motd.text, {
      format: "minimessage",
      rgb: true,
    }).value;
  });
  const editor = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await editor.click();
  await editor.evaluate((root) => {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  const original = await editor.elementHandle();
  await page.keyboard.type("W");
  await expect(editor).toBeFocused();
  expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
  const after = await page.evaluate(
    () =>
      window.api.serializeText(window.doc.motd.text, {
        format: "minimessage",
        rgb: true,
      }).value,
  );
  expect(after).toContain("{{players}}");
  expect(after).toContain("<font:custom>X</font>");
  expect(after.match(/<gradient:/g)).toHaveLength(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        window.api.serializeText(window.doc.motd.text, {
          format: "minimessage",
          rgb: true,
        }).value,
    ),
  ).toBe(before);
});

test("defers effect recoloring during synthetic composition and refreshes after it ends", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<gradient:#ff0000:#0000ff>Wi</gradient>",
    }),
  );
  const editor = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await editor.click();
  const original = await editor.elementHandle();
  await editor.evaluate((root) =>
    root.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    ),
  );
  // Firefox's automation insertText completes its own trusted composition.
  // Insert within our explicit synthetic composition without that extra cycle.
  await editor.evaluate((root) =>
    root.ownerDocument.execCommand("insertText", false, "漢"),
  );
  expect((await inlineColors(page)).map((glyph) => glyph.color)).not.toEqual([
    "#ff0000",
    "#800080",
    "#0000ff",
  ]);
  await editor.evaluate((root) =>
    root.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "漢" }),
    ),
  );
  await expect(editor).toContainText("漢");
  await expect(editor).toBeFocused();
  expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
  await expect.poll(async () => (await inlineColors(page)).length).toBe(3);
  const actual = await inlineColors(page);
  expect(actual.map((glyph) => glyph.color)).toEqual([
    "#ff0000",
    "#800080",
    "#0000ff",
  ]);
});
