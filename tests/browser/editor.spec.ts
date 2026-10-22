import { openEntryTool } from "./editor-actions.js";
import { expect, test } from "@playwright/test";
test("edits inside the server row and supports selection formatting and undo", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("Hello ");
  await expect(page.locator("#preview .mcp-motd")).toContainText("Hello");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#preview .mcp-motd")).not.toContainText("Hello ");
  await input.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.up("Shift");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  expect(await page.evaluate(() => window.changes.at(-1).origin)).toBe(
    "visual",
  );
});
test("keeps invalid source text and read-only state without losing the last valid draft", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await openEntryTool(page, "Source");
  const source = page.getByRole("textbox", { name: "MOTD source" });
  await source.fill("<red>New message");
  await page
    .getByRole("dialog", { name: "Source editor", exact: true })
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(page.locator("#preview .mcp-motd")).toContainText("New message");
  await page.evaluate(() =>
    window.editor.update({
      document: window.doc,
      context: window.context,
      readOnly: true,
      onChange: () => {
        throw Error("read-only change");
      },
    }),
  );
  await expect(page.locator("#editor .ProseMirror").first()).toHaveAttribute(
    "contenteditable",
    "false",
  );
});
