import { expect, test } from "@playwright/test";
import { openEntryTool } from "./editor-actions.js";
test("player settings show evaluated examples when native counts are hidden", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() => {
    window.editor.execute({
      type: "set-field",
      field: "players",
      value: { ...window.doc.players, hidden: true },
    });
    window.changes = [];
  });
  await openEntryTool(page, "Player display");
  const result = page.getByRole("status", {
    name: "Evaluated player counts",
    exact: true,
  });
  await expect(result).toContainText("42/500");
  await page.getByLabel("Maximum players mode").selectOption("headroom");
  await page.getByLabel("Maximum players value").fill("10");
  await expect(result).toContainText("42/52");
  await expect(page.locator("#preview .mcp-players")).toHaveText("???");
  const before = await page.evaluate(() => {
    window.changes = [];
    return JSON.stringify(window.doc);
  });
  await page.evaluate(() =>
    window.setEditorOptions({
      context: {
        ...window.context,
        base: {
          ...window.context.base,
          players: { ...window.context.base.players, online: 80 },
        },
      },
    }),
  );
  await expect(result).toContainText("80/90");
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
test("incompatible version text does not hide calculated player-rule feedback", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() =>
    window.editor.execute({
      type: "set-field",
      field: "version",
      value: {
        mode: "always",
        text: window.api.parseText("Maintenance", "minimessage").value,
      },
    }),
  );
  await openEntryTool(page, "Player display");
  const result = page.getByRole("status", {
    name: "Evaluated player counts",
    exact: true,
  });
  await page.getByLabel("Online players mode").selectOption("percent");
  await page.getByLabel("Online players value").fill("50");
  await page.getByLabel("Maximum players mode").selectOption("headroom");
  await page.getByLabel("Maximum players value").fill("10");
  await expect(result).toContainText("21/31");
  await expect(page.locator("#preview .mcp-players")).toHaveText("Maintenance");
  expect(await page.evaluate(() => window.doc.players.online)).toEqual({
    mode: "percent",
    value: 50,
  });
});

test("missing base data remains unknown instead of inventing live player counts", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() => {
    const base = { ...window.context.base };
    delete base.players;
    window.setEditorOptions({ context: { ...window.context, base } });
  });
  await openEntryTool(page, "Player display");
  const result = page.getByRole("status", {
    name: "Evaluated player counts",
    exact: true,
  });
  await expect(result).toContainText("?/?");
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
  await page.getByLabel("Online players mode").selectOption("offset");
  await expect(result).toContainText("missing base player data");
});
