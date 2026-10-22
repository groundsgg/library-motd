import { expect, test, type Page } from "@playwright/test";

async function removeRainbow(page: Page) {
  await page
    .getByRole("button", { name: "More formatting", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "More formatting", exact: true })
    .getByRole("button", { name: "Rainbow", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Rainbow", exact: true })
    .getByRole("button", { name: "Remove rainbow", exact: true })
    .click();
}
async function setup(page: Page, source: string) {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
  await page.evaluate(
    (source) => window.editor.execute({ type: "replace-source", source }),
    source,
  );
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.focus();
  await input.press("Control+A");
  return input;
}
for (const source of [
  "<rainbow><b>Alpha Beta</b></rainbow>",
  "<red><rainbow><b>Alpha Beta</b></rainbow></red>",
  "<rainbow><b>A{{players}}<newline>B</b></rainbow>",
]) {
  test(`removes rainbow while keeping other styles, source and undo: ${source}`, async ({
    page,
  }) => {
    await setup(page, source);
    const before = await page.evaluate(() => JSON.stringify(window.doc));
    await removeRainbow(page);
    const after = await page.evaluate(() => ({
      glyphs: window.api
        .flattenText(window.doc.motd.text)
        .filter((glyph) => glyph.text !== "\n")
        .map((glyph) => ({
          rainbow: !!glyph.style.rainbow,
          bold: !!glyph.style.bold,
          color: glyph.color,
        })),
      source: window.api.serializeText(window.doc.motd.text, {
        format: "minimessage",
      }).value,
      valid: !!window.api.validateDocument(window.doc).value,
    }));
    expect(after.glyphs.every((glyph) => !glyph.rainbow && glyph.bold)).toBe(
      true,
    );
    expect(after.source).not.toContain("<rainbow");
    expect(after.valid).toBe(true);
    if (source.includes("<red>"))
      expect(after.glyphs.every((glyph) => glyph.color === "#ff5555")).toBe(
        true,
      );
    if (source.includes("{{players}}"))
      expect(after.source).toContain("{{players}}");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  });
}

test("removes only the selected rainbow fragment", async ({ page }) => {
  const input = await setup(page, "<rainbow>Alpha Beta</rainbow>");
  await input.evaluate((root) => {
    const walker = root.ownerDocument.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
    );
    const first = walker.nextNode()!;
    let end = first,
      remaining = 5;
    while (remaining > (end.textContent?.length ?? 0)) {
      remaining -= end.textContent?.length ?? 0;
      end = walker.nextNode()!;
    }
    const range = root.ownerDocument.createRange();
    range.setStart(first, 0);
    range.setEnd(end, remaining);
    const selection = root.ownerDocument.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    root.ownerDocument.dispatchEvent(new Event("selectionchange"));
  });
  await removeRainbow(page);
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.motd.text)
        .map((glyph) => !!glyph.style.rainbow),
    ),
  ).toEqual([false, false, false, false, false, true, true, true, true, true]);
  await expect(input).toHaveText("Alpha Beta");
});

test("controlled React removes rainbow from the same selected text", async ({
  page,
}) => {
  await page.goto("/examples/react/");
  await page
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Server entry tools", exact: true })
    .getByRole("button", { name: "Source", exact: true })
    .click();
  const source = page.getByRole("dialog", {
    name: "Source editor",
    exact: true,
  });
  await source
    .getByLabel("MOTD source", { exact: true })
    .fill("<rainbow><b>Alpha Beta</b></rainbow>");
  await source.getByRole("button", { name: "Apply", exact: true }).click();
  const input = page.locator("[data-editor-field=motd] .ProseMirror");
  await input.focus();
  await input.press("Control+A");
  await removeRainbow(page);
  await expect(input.locator(".mce-effect-glyph")).toHaveCount(0);
  await expect(input.locator('span[style*="font-weight: 700"]')).toHaveCount(1);
  await expect(input).toHaveText("Alpha Beta");
  await expect(
    page.locator(".preview-output .mcp-motd .mcp-glyph").first(),
  ).toHaveCSS("color", "rgb(170, 170, 170)");
});

test("clearing rainbow at a caret affects future typing without changing existing text", async ({
  page,
}) => {
  const input = await setup(page, "<rainbow><b>Alpha</b></rainbow>");
  await input.press("Control+End");
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await removeRainbow(page);
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  await page.keyboard.press("Escape");
  await input.focus();
  await page.keyboard.type("!");
  expect(
    await page.evaluate(() =>
      window.api.flattenText(window.doc.motd.text).map((glyph) => ({
        text: glyph.text,
        rainbow: !!glyph.style.rainbow,
        bold: !!glyph.style.bold,
      })),
    ),
  ).toEqual([
    ...[..."Alpha"].map((text) => ({ text, rainbow: true, bold: true })),
    { text: "!", rainbow: false, bold: true },
  ]);
});

test("clear-format respects permissions", async ({ page }) => {
  await setup(page, "<rainbow>Alpha</rainbow>");
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  for (const patch of [
    { readOnly: true },
    { disabled: true },
    { features: { motd: false } },
  ]) {
    await page.evaluate((patch) => {
      window.setEditorOptions({
        readOnly: false,
        disabled: false,
        features: {},
        ...patch,
      });
      window.editor.execute({
        type: "clear-format",
        styles: ["rainbow"],
        field: "motd",
      });
    }, patch);
    expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  }
});

test("clearing an absent effect is a no-op, including placeholders and line breaks", async ({
  page,
}) => {
  await setup(page, "A{{players}}<newline>B");
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  const changes = await page.evaluate(() => window.changes.length);
  await page.evaluate(() =>
    window.editor.execute({ type: "clear-format", styles: ["rainbow"] }),
  );
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  expect(await page.evaluate(() => window.changes.length)).toBe(changes);
});

test("removing rainbow preserves protected source and leaves it untouched", async ({
  page,
}) => {
  await setup(page, "<rainbow><font:custom>X</font> Alpha</rainbow>");
  await removeRainbow(page);
  const state = await page.evaluate(() => ({
    glyphs: window.api.flattenText(window.doc.motd.text).map((glyph) => ({
      protected: !!glyph.opaque,
      rainbow: !!glyph.style.rainbow,
    })),
    source: window.api.serializeText(window.doc.motd.text, {
      format: "minimessage",
    }).value,
  }));
  expect(state.source).toContain("<font:custom>X</font>");
  expect(state.glyphs.some((glyph) => glyph.protected)).toBe(true);
  expect(
    state.glyphs
      .filter((glyph) => glyph.protected)
      .every((glyph) => glyph.rainbow),
  ).toBe(true);
  expect(
    state.glyphs
      .filter((glyph) => !glyph.protected)
      .every((glyph) => !glyph.rainbow),
  ).toBe(true);
});

test("clearing an absent effect from freshly typed unmarked text is a no-op", async ({
  page,
}) => {
  const input = await setup(page, "");
  await page.keyboard.type("Plain");
  await input.press("Control+A");
  const before = await page.evaluate(() => ({
    document: JSON.stringify(window.doc),
    changes: window.changes.length,
  }));
  await removeRainbow(page);
  expect(
    await page.evaluate(() => ({
      document: JSON.stringify(window.doc),
      changes: window.changes.length,
    })),
  ).toEqual(before);
});
