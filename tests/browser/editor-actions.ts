import type { Page } from "@playwright/test";
export async function openEntryTool(page: Page, name: string) {
  await page.keyboard.press("Escape");
  await page
    .locator("#editor")
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Server entry tools", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}
