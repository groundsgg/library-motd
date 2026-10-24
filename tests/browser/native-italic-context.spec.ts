import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { openEntryTool } from "./editor-actions.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
});

test("overflow imports retain source without generating invisible italic bitmaps", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.context = {
      ...window.context,
      profile: window.api.java263Profile,
      viewportWidth: 854,
    };
    window.setEditorOptions({ context: window.context });
    window.editor.execute({
      type: "replace-source",
      source: `<i><gradient:#ff0000:#0000ff>${"M".repeat(120)}</gradient></i>`,
    });
  });
  const input = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await expect(input).toHaveText("M".repeat(120));
  await expect(input.locator(".mcp-pixel-italic")).toHaveCount(88);
});

test("the non-pixel missing-glyph outline retains browser fallback", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<i>A\uffffB</i>",
    }),
  );
  await expect(
    page.locator("#editor [data-editor-field=motd] .mcp-pixel-italic"),
  ).toHaveCount(2);
  await expect(
    page.locator("#preview .mcp-motd .mcp-pixel-italic"),
  ).toHaveCount(2);
});

for (const field of ["version", "hover"] as const)
  test(`unchanged ${field} text refreshes italic ink after context changes without losing history`, async ({
    page,
  }) => {
    await page.evaluate(
      (field) =>
        window.editor.execute({
          type: "replace-source",
          field,
          source: "<gold><i>AbMW</i></gold>",
        }),
      field,
    );
    if (field === "hover") await openEntryTool(page, "Player hover");
    const input = page.getByRole("textbox", {
      name: field === "hover" ? "Hover inline editor" : "Version inline editor",
      exact: true,
    });
    await expect(input).toBeVisible();
    await input.focus();
    await input.press("Control+End");
    await page.keyboard.type("M");
    await expect(input).toHaveText("AbMWM");
    const oldSize = await input
      .locator(".mcp-pixel-italic")
      .first()
      .evaluate((e) =>
        (e as HTMLElement).style.getPropertyValue("--mcp-ink-size"),
      );
    const oldDocument = await page.evaluate(() => JSON.stringify(window.doc));
    const original = await input.elementHandle();
    await page.evaluate(() => {
      window.context = { ...window.context, guiScale: 3 };
      window.setEditorOptions({ context: window.context });
    });
    await expect
      .poll(() =>
        input
          .locator(".mcp-pixel-italic")
          .first()
          .evaluate((e) =>
            (e as HTMLElement).style.getPropertyValue("--mcp-ink-size"),
          ),
      )
      .not.toBe(oldSize);
    await page.evaluate(() => {
      window.context = {
        ...window.context,
        assetProvider: () => ({ fontFamily: "monospace" }),
      };
      window.setEditorOptions({ context: window.context });
    });
    await expect(input.locator(".mcp-pixel-italic")).toHaveCount(0);
    await expect(input).toBeFocused();
    expect(await original!.evaluate((e) => e.isConnected)).toBe(true);
    expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(
      oldDocument,
    );
    await page.evaluate(() => {
      window.context = {
        ...window.context,
        guiScale: 2,
        assetProvider: undefined,
      };
      window.setEditorOptions({ context: window.context });
    });
    await expect(input.locator(".mcp-pixel-italic")).toHaveCount(5);
    await input.press("Control+z");
    await expect(input).toHaveText("AbMW");
  });

for (const bold of [false, true])
  test(`italic decorations cover the complete full-width space (${bold ? "bold" : "regular"})`, async ({
    page,
  }) => {
    await page.evaluate((bold) => {
      window.context = {
        ...window.context,
        profile: window.api.java263Profile,
      };
      window.setEditorOptions({ context: window.context });
      window.editor.execute({
        type: "replace-source",
        source: `<gold><i><u>${bold ? "<b>" : ""}\u3000${bold ? "</b>" : ""}</u></i></gold>`,
      });
      window.preview.update({ document: window.doc, context: window.context });
    }, bold);
    await page.evaluate(() => document.fonts.ready);
    for (const host of ["preview", "editor"]) {
      const image = PNG.sync.read(
        await page.locator(`#${host} .mcp-row`).screenshot(),
      );
      const width = (16 + (bold ? 1 : 0) + 1) * 2;
      for (let x = 68; x < 68 + width; x++) {
        const offset = (40 * image.width + x) * 4;
        expect(
          [...image.data.subarray(offset, offset + 3)],
          `${host} underline x=${x}`,
        ).toEqual([255, 170, 0]);
      }
    }
  });
