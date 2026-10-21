import { expect, test } from "@playwright/test";
test("ignores a server response that arrives after a newer inline edit", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
  await page.evaluate(() =>
    window.editor.update({
      document: window.doc,
      context: window.context,
      onChange: (d, c) => {
        window.doc = d;
        window.changes.push(c);
      },
      imports: {
        adapter: () =>
          new Promise((resolve) => {
            window.finishImport = resolve;
          }),
      },
    }),
  );
  await page.getByLabel("Server address").fill("example.test");
  await page
    .getByRole("button", { name: "Import server", exact: true })
    .click();
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("newer ");
  await page.evaluate(() =>
    window.finishImport({
      ...window.context.base,
      description: "stale import",
    }),
  );
  await expect(input).toContainText("newer");
  expect(await page.evaluate(() => JSON.stringify(window.doc))).not.toContain(
    "stale import",
  );
});
test("imports all fields as one undoable transaction", async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
  await page.evaluate(() =>
    window.editor.update({
      document: window.doc,
      context: window.context,
      onChange: (d, c) => {
        window.doc = d;
        window.changes.push(c);
      },
      imports: {
        adapter: async () => ({
          ...window.context.base,
          description: "Imported",
          players: { online: 99, max: 120, sample: [] },
        }),
      },
    }),
  );
  await page.getByLabel("Server address").fill("example.test");
  await page
    .getByRole("button", { name: "Import server", exact: true })
    .click();
  await expect(page.locator("#editor .ProseMirror").first()).toContainText(
    "Imported",
  );
  expect(await page.evaluate(() => window.changes.at(-1))).toMatchObject({
    origin: "import",
    changedFields: ["motd", "version", "icon", "players", "hover"],
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => window.doc.players.online.mode)).toBe(
    "inherit",
  );
});
