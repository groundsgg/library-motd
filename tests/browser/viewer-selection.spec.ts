import { expect, test, type Locator, type Page } from "@playwright/test";

async function dragFirstLine(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + 1, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 8, { steps: 12 });
  await page.mouse.up();
}

for (const adapter of ["DOM", "React"]) {
  test(`${adapter} viewer text cannot be dragged into a selection; inline editor text can`, async ({
    page,
  }) => {
    await page.goto(
      adapter === "DOM" ? "/tests/browser/host.html" : "/examples/react/",
    );
    const input = page.locator(
      adapter === "DOM"
        ? "#editor [data-editor-field=motd] .ProseMirror"
        : "[data-editor-field=motd] .ProseMirror",
    );
    await expect(input).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const viewer = page.locator(
      adapter === "DOM" ? "#preview .mcp-motd" : ".preview-output .mcp-motd",
    );
    await page.evaluate(() => document.getSelection()?.removeAllRanges());
    await dragFirstLine(page, viewer);
    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe(
      "",
    );
    await dragFirstLine(page, input);
    await expect
      .poll(() =>
        page.evaluate(() => document.getSelection()?.toString().length ?? 0),
      )
      .toBeGreaterThan(0);
    await expect(input).toBeFocused();
  });
}
