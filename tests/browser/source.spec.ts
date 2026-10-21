import { expect, test } from "@playwright/test";
test("keeps malformed JSON source and the last valid visual draft", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await page.getByLabel("Source format").selectOption("json");
  const source = page.getByRole("textbox", { name: "MOTD source" });
  await source.fill('{"text":"Valid JSON"}');
  await expect(page.locator("#preview .mcp-motd")).toContainText("Valid JSON");
  await source.fill("{broken");
  await expect(source).toHaveValue("{broken");
  await expect(page.locator("#preview .mcp-motd")).toContainText("Valid JSON");
  await expect(page.locator("#editor .mce-diagnostics")).toBeVisible();
});
