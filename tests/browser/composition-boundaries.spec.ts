import { expect, test } from "@playwright/test";
import { openEntryTool } from "./editor-actions.js";
test("a deferred external replacement closes a pinned composing field", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await openEntryTool(page, "Player hover");
  await page.getByLabel("Player hover", { exact: true }).selectOption("custom");
  const field = page.getByRole("textbox", {
    name: "Hover inline editor",
    exact: true,
  });
  await field.focus();
  await field.dispatchEvent("compositionstart");
  const replacement = await page.evaluate(() => {
    const next = structuredClone(window.doc);
    next.hover = {
      mode: "custom",
      text: window.api.parseText("External hover", "minimessage").value,
    };
    window.doc = next;
    window.setEditorOptions({ document: next });
    window.changes = [];
    return JSON.stringify(next);
  });
  await expect(field).toBeVisible();
  await field.dispatchEvent("compositionend");
  await expect(
    page.getByRole("dialog", { name: "Player hover editor", exact: true }),
  ).toBeHidden();
  expect(
    await page.evaluate(() => JSON.stringify(window.editor.getDocument())),
  ).toBe(replacement);
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
