import { selectRenderedText } from "./editor-actions.js";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
});

for (const [style, label] of [
  ["bold", "Bold"],
  ["italic", "Italic"],
  ["underlined", "Underline"],
] as const) {
  test(`full selections toggle ${style} on and off`, async ({ page }) => {
    await page.evaluate(() =>
      window.editor.execute({ type: "replace-source", source: "Alpha Beta" }),
    );
    const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
    await input.focus();
    await input.press("Control+A");
    await expect
      .poll(() => page.evaluate(() => document.getSelection()?.toString()))
      .toBe("Alpha Beta");
    const button = page.getByRole("button", { name: label, exact: true });
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(
        (style) =>
          window.api
            .flattenText(window.doc.motd.text)
            .every((glyph) => glyph.style[style]),
        style,
      ),
    ).toBe(true);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    expect(
      await page.evaluate(
        (style) =>
          window.api
            .flattenText(window.doc.motd.text)
            .some((glyph) => glyph.style[style]),
        style,
      ),
    ).toBe(false);
    await expect(input).toHaveText("Alpha Beta");
  });
}

test("mixed selected styles become uniform and styled placeholders participate", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<b>Alpha</b> Beta {{players}}",
    }),
  );
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.focus();
  await input.press("Control+A");
  const bold = page.getByRole("button", { name: "Bold", exact: true });
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  const state = await page.evaluate(() => ({
    bold: window.api
      .flattenText(window.doc.motd.text)
      .some((glyph) => glyph.style.bold),
    source: window.api.serializeText(window.doc.motd.text, {
      format: "minimessage",
    }).value,
  }));
  expect(state.bold).toBe(false);
  expect(state.source).toContain("{{players}}");
});

test("formatting has its own undo boundary after typing", async ({ page }) => {
  await page.evaluate(() =>
    window.editor.execute({ type: "replace-source", source: "Editable" }),
  );
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.focus();
  await input.press("Control+Home");
  await page.keyboard.type("New ");
  await expect(input).toHaveText("New Editable");
  await input.press("Control+A");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(input).toHaveText("New Editable");
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.motd.text)
        .some((glyph) => glyph.style.bold),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(input).toHaveText("Editable");
});

test("a partial selection removes and reapplies bold without changing its neighbors", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<b>Alpha Beta</b>",
    }),
  );
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await selectRenderedText(input, 0, 5);
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString()))
    .toBe("Alpha");
  const bold = page.getByRole("button", { name: "Bold", exact: true });
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.motd.text)
        .map((glyph) => !!glyph.style.bold),
    ),
  ).toEqual([false, false, false, false, false, true, true, true, true, true]);
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.motd.text)
        .every((glyph) => glyph.style.bold),
    ),
  ).toBe(true);
  await expect(input).toHaveText("Alpha Beta");
});

test("version text uses the same selection formatting toggle", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      field: "version",
      source: "<b>Maintenance</b>",
    }),
  );
  const input = page.locator(
    "#editor [data-editor-field=version] .ProseMirror",
  );
  await expect(input).toBeVisible();
  await input.focus();
  await input.press("Control+A");
  const bold = page.getByRole("button", { name: "Bold", exact: true });
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await expect(input.locator('span[style*="font-weight: 700"]')).toHaveCount(0);
  await expect(input).toHaveText("Maintenance");
});

test("controlled React keeps selected formatting removable", async ({
  page,
}) => {
  await page.goto("/tests/browser/react.html");
  const input = page.locator("[data-editor-field=motd] .ProseMirror");
  await input.focus();
  await input.press("Control+A");
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString().trim()))
    .toBe("Editable");
  const bold = page.getByRole("button", { name: "Bold", exact: true });
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await expect(input.locator('span[style*="font-weight: 700"]')).toHaveCount(1);
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await expect(input.locator('span[style*="font-weight: 700"]')).toHaveCount(0);
  await expect(input).toHaveText("Editable");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await expect(input.locator('span[style*="font-weight: 700"]')).toHaveCount(1);
});
