import { openEntryTool } from "./editor-actions.js";
import { expect, test } from "@playwright/test";
test("keeps malformed JSON source and the last valid visual draft", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await openEntryTool(page, "Source");
  await page.getByLabel("Source format").selectOption("json");
  const source = page.getByRole("textbox", { name: "MOTD source" });
  await source.fill('{"text":"Valid JSON"}');
  await page
    .getByRole("dialog", { name: "Source editor", exact: true })
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(page.locator("#preview .mcp-motd")).toContainText("Valid JSON");
  await openEntryTool(page, "Source");
  await source.fill("{broken");
  await expect(source).toHaveValue("{broken");
  await expect(page.locator("#preview .mcp-motd")).toContainText("Valid JSON");
  await expect(
    page
      .getByRole("dialog", { name: "Source editor", exact: true })
      .getByRole("status"),
  ).toBeVisible();
});
