import { openEntryTool } from "./editor-actions.js";
import { expect, test } from "@playwright/test";
test("keeps current inline version text when switching version modes", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await openEntryTool(page, "Version settings");
  await page.getByLabel("Version display").selectOption("always");
  await page.keyboard.press("Escape");
  await page.getByLabel("Version inline editor").fill("Edited version");
  await openEntryTool(page, "Version settings");
  await page.getByLabel("Version display").selectOption("when-incompatible");
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.version.text)
        .map((c) => c.text)
        .join(""),
    ),
  ).toBe("Edited version");
});
test("shows the reason a configured hover cannot be reached", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await openEntryTool(page, "Player display");
  await page.getByLabel("Hide player count").check();
  await openEntryTool(page, "Player hover");
  await page.getByLabel("Player hover", { exact: true }).selectOption("custom");
  await expect(page.locator("#editor .mce-diagnostics")).toContainText(
    "Hidden player data",
  );
});
test("document metadata participates in the same undo transaction", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  const result = await page.evaluate(() => {
    window.doc.extensions.intent = [];
    window.editor.update({
      document: window.doc,
      context: window.context,
      mapChange: (next, change) => ({
        ...next,
        extensions: { ...next.extensions, intent: change.changedFields },
      }),
      onChange: (doc, change) => {
        window.doc = doc;
        window.changes.push(change);
      },
    });
    window.editor.execute({ type: "replace-source", source: "New text" });
    const applied = window.editor.getDocument().extensions.intent;
    window.editor.execute({ type: "undo" });
    return {
      applied,
      undone: window.editor.getDocument().extensions.intent,
      fields: window.changes.at(-1).changedFields,
    };
  });
  expect(result).toEqual({ applied: ["motd"], undone: [], fields: ["motd"] });
});
test("resolves reserved player values even when the count is hidden", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() => {
    window.editor.execute({
      type: "replace-source",
      source: "Online {{players}}",
    });
    window.editor.execute({
      type: "set-field",
      field: "players",
      value: { ...window.doc.players, hidden: true },
    });
  });
  await expect(page.locator("#preview .mcp-motd")).toContainText("Online 42");
  await expect(page.getByLabel("MOTD inline editor")).toContainText(
    "Online 42",
  );
});
test("treats each native sample player name as an independent style scope", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.preview);
  await page.evaluate(() => {
    window.context.base.players.sample = [
      { name: "§cfirst", id: "a" },
      { name: "second", id: "b" },
    ];
    window.preview.update({ document: window.doc, context: window.context });
  });
  await page.locator("#preview .mcp-players").hover();
  const second = page
    .locator("#preview .mcp-tooltip .mcp-glyph")
    .filter({ hasText: "s" })
    .last();
  await expect(second).toHaveCSS("color", "rgb(255, 255, 255)");
});
