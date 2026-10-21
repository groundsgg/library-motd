import { expect, test } from "@playwright/test";
test("controlled React echoes preserve focus and destroy all DOM on unmount", async ({
  page,
}) => {
  await page.goto("/tests/browser/react.html");
  const editor = page.locator("[data-editor-field=motd] .ProseMirror");
  await expect(editor).toBeVisible();
  await editor.click();
  // This tests controlled React echoes, independently of native Home handling.
  await editor.evaluate((element) => {
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    const selection = element.ownerDocument.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  const originalEditor = await editor.elementHandle();
  await page.keyboard.type("React ");
  await expect(editor).toBeFocused();
  await expect(editor).toContainText("React Editable");
  expect(await originalEditor!.evaluate((element) => element.isConnected)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Toggle editor" }).click();
  await expect(page.locator(".mce-root")).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle editor" }).click();
  await expect(page.locator(".mce-root")).toHaveCount(1);
  await expect(editor).toContainText("React Editable");
});
