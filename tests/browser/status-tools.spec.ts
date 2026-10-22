import { openEntryTool } from "./editor-actions.js";
import { expect, test, type Page } from "@playwright/test";
async function openTool(page: Page, name: string) {
  await page
    .locator("#editor")
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Server entry tools", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
});

test("player count rules stay in context and evaluate every supported mode", async ({
  page,
}) => {
  await page.locator("#editor .mcp-status-action").click();
  const tool = page.getByRole("dialog", {
    name: "Player display",
    exact: true,
  });
  await expect(tool).toBeVisible();
  for (const [mode, value, want] of [
    ["fixed", "7", 7],
    ["offset", "5", 47],
    ["percent", "50", 21],
  ] as const) {
    await tool.getByLabel("Online players mode").selectOption(mode);
    await tool.getByLabel("Online players value").fill(value);
    await tool.getByLabel("Online players value").press("Tab");
    expect(
      await page.evaluate(
        () =>
          window.api.evaluateStatus(window.doc, window.context).value.players
            .online,
      ),
    ).toBe(want);
  }
  await tool.getByLabel("Online players mode").selectOption("inherit");
  for (const [mode, value, want] of [
    ["fixed", "100", 100],
    ["offset", "50", 550],
    ["percent", "50", 250],
    ["headroom", "10", 52],
  ] as const) {
    await tool.getByLabel("Maximum players mode").selectOption(mode);
    await tool.getByLabel("Maximum players value").fill(value);
    await tool.getByLabel("Maximum players value").press("Tab");
    expect(
      await page.evaluate(
        () =>
          window.api.evaluateStatus(window.doc, window.context).value.players
            .max,
      ),
    ).toBe(want);
  }
  expect(await page.evaluate(() => window.doc.players.maximum)).toEqual({
    mode: "headroom",
    value: 10,
  });
  await page.keyboard.press("Escape");
  await expect(tool).toBeHidden();
  await expect(page.locator("#preview .mcp-players")).toHaveText("42/52");
});

test("hidden counts remain editable through the entry menu", async ({
  page,
}) => {
  await openTool(page, "Player display");
  await page.getByLabel("Hide player count").check();
  await page.keyboard.press("Escape");
  await expect(page.locator("#preview .mcp-players")).toHaveText("???");
  await openTool(page, "Player display");
  await page.getByLabel("Hide player count").uncheck();
  await expect(page.locator("#preview .mcp-players")).toHaveText("42/500");
});

test("version modes keep native exclusivity and expose hidden text explicitly", async ({
  page,
}) => {
  await openTool(page, "Version settings");
  await page.getByLabel("Version display").selectOption("always");
  await expect(page.locator("#preview .mcp-players")).toContainText(
    "Maintenance",
  );
  await page.getByLabel("Version display").selectOption("when-incompatible");
  await expect(page.locator("#preview .mcp-players")).toHaveText("42/500");
  await page
    .getByRole("button", { name: "Edit hidden version text", exact: true })
    .click();
  const field = page
    .getByRole("dialog", { name: "Version text editor", exact: true })
    .getByRole("textbox", { name: "Version inline editor", exact: true });
  await field.fill("Other client");
  await expect(page.locator("#preview .mcp-players")).toHaveText("42/500");
  await page.evaluate(() =>
    window.setEditorOptions({
      context: { ...window.context, compatible: false },
    }),
  );
  await expect(
    page.locator("#editor [data-editor-field=version] .ProseMirror"),
  ).toBeVisible();
  await expect(page.locator("#editor .mcp-players")).toContainText(
    "Other client",
  );
});

test("custom player hover is pinned, multiline and formatted without losing its surface", async ({
  page,
}) => {
  await openTool(page, "Player hover");
  const panel = page.getByRole("dialog", {
    name: "Player hover editor",
    exact: true,
  });
  await panel
    .getByLabel("Player hover", { exact: true })
    .selectOption("custom");
  const field = panel.getByRole("textbox", {
    name: "Hover inline editor",
    exact: true,
  });
  await field.focus();
  await field.press("Control+A");
  await page.keyboard.type("one");
  for (const word of ["two", "three", "four"]) {
    await field.press("Enter");
    await page.keyboard.type(word);
  }
  expect(
    await page.evaluate(
      () =>
        window.api
          .flattenText(window.doc.hover.text)
          .filter((g) => g.text === "\n").length,
    ),
  ).toBe(3);
  await field.press("Control+A");
  await field.press("Alt+F10");
  await expect(
    page.getByRole("button", { name: "Bold", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.hover.text)
        .filter((g) => g.text !== "\n")
        .every((g) => g.style.bold),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Text color", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Text color", exact: true })
    .getByLabel("Hex color")
    .fill("#ff0000");
  await page.keyboard.press("Escape");
  await expect(field).toBeVisible();
  await expect(field).toBeFocused();
  await panel
    .getByRole("button", { name: "Close player hover", exact: true })
    .click();
  await expect(panel).toBeHidden();
  await page.locator("#preview .mcp-status-action").hover();
  await expect(page.locator("#preview [role=tooltip]:visible")).toContainText(
    "four",
  );
});

test("an unreachable hover stays editable without inventing native tooltip content", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "set-field",
      field: "players",
      value: { ...window.doc.players, hidden: true },
    }),
  );
  await openTool(page, "Player hover");
  const panel = page.getByRole("dialog", {
    name: "Player hover editor",
    exact: true,
  });
  await panel
    .getByLabel("Player hover", { exact: true })
    .selectOption("custom");
  await expect(
    panel.getByRole("textbox", { name: "Hover inline editor" }),
  ).toBeVisible();
  await expect(panel.getByRole("status")).toContainText("cannot display");
  await page.locator("#preview .mcp-status-action").hover();
  await expect(page.locator("#preview [role=tooltip]:visible")).toHaveCount(0);
});

test("read-only and feature-disabled entry actions do not open mutating tools", async ({
  page,
}) => {
  await page.evaluate(() => window.setEditorOptions({ readOnly: true }));
  await page
    .locator("#editor")
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click();
  const menu = page.getByRole("dialog", {
    name: "Server entry tools",
    exact: true,
  });
  for (const name of ["Player display", "Version settings", "Player hover"])
    await expect(
      menu.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.locator("#editor .mcp-status-action").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() =>
    window.setEditorOptions({
      readOnly: false,
      features: { version: false, players: false, hover: false },
    }),
  );
  await page
    .locator("#editor")
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click();
  for (const name of ["Player display", "Version settings", "Player hover"])
    await expect(
      menu.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});

test("document replacement and permission revocation close pinned editing", async ({
  page,
}) => {
  await openTool(page, "Player hover");
  await page.getByLabel("Player hover", { exact: true }).selectOption("custom");
  await page.evaluate(() =>
    window.setEditorOptions({ document: window.api.createDocument() }),
  );
  await expect(
    page.getByRole("dialog", { name: "Player hover editor", exact: true }),
  ).toBeHidden();
  await openTool(page, "Player hover");
  await page.evaluate(() => window.setEditorOptions({ readOnly: true }));
  await expect(
    page.getByRole("dialog", { name: "Player hover editor", exact: true }),
  ).toBeHidden();
});

test("inherited and disabled hover require an explicit custom mode and keep history", async ({
  page,
}) => {
  await openTool(page, "Player hover");
  const panel = page.getByRole("dialog", {
    name: "Player hover editor",
    exact: true,
  });
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await panel
    .getByLabel("Player hover", { exact: true })
    .selectOption("disabled");
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await panel
    .getByLabel("Player hover", { exact: true })
    .selectOption("custom");
  await panel.getByRole("textbox").focus();
  await panel.getByRole("textbox").press("Control+A");
  await page.keyboard.type("Saved hover");
  await page
    .locator("#editor")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(panel.getByRole("textbox")).toContainText("Welcome");
  await page
    .locator("#editor")
    .getByRole("button", { name: "Redo", exact: true })
    .click();
  await expect(panel.getByRole("textbox")).toContainText("Saved hover");
  await page.evaluate(() => window.setEditorOptions({ disabled: true }));
  await expect(panel).toBeHidden();
});

test("a pinned hover keeps its view through viewport and context changes", async ({
  page,
}) => {
  await openTool(page, "Player hover");
  await page.getByLabel("Player hover", { exact: true }).selectOption("custom");
  await page
    .getByRole("textbox", { name: "Hover inline editor" })
    .fill("Persistent");
  await page.evaluate(() => {
    window.pinnedView = document.querySelector(
      "[data-editor-field=hover] .ProseMirror",
    );
  });
  await page.setViewportSize({ width: 390, height: 700 });
  await page.evaluate(() =>
    window.setEditorOptions({
      context: { ...window.context, guiScale: 1, compatible: false },
    }),
  );
  expect(
    await page.evaluate(
      () =>
        window.pinnedView ===
        document.querySelector("[data-editor-field=hover] .ProseMirror"),
    ),
  ).toBe(true);
  const panel = page.getByRole("dialog", {
    name: "Player hover editor",
    exact: true,
  });
  await expect(panel.getByRole("status")).toContainText("cannot display");
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});

test("status tools are owned by their editor and clean up on destroy", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.otherEditor = window.dom.createEditor(
      document.querySelector("#second"),
      {
        document: window.api.createDocument(),
        context: window.context,
        onChange: () => {},
      },
    );
  });
  await openTool(page, "Player hover");
  await page.getByLabel("Player hover", { exact: true }).selectOption("custom");
  await page
    .locator("#second")
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Server entry tools", exact: true })
    .getByRole("button", { name: "Player display", exact: true })
    .click();
  await page.getByLabel("Hide player count").check();
  expect(await page.evaluate(() => window.doc.players.hidden)).toBe(false);
  expect(
    await page.evaluate(() => window.otherEditor.getDocument().players.hidden),
  ).toBe(true);
  await page.evaluate(() => {
    window.editor.destroy();
    window.otherEditor.destroy();
  });
  await expect(page.locator(".mce-popout")).toHaveCount(0);
});

test("count inputs apply live before blur and a closed pin returns tools to MOTD", async ({
  page,
}) => {
  await openTool(page, "Player display");
  await page.getByLabel("Online players mode").selectOption("fixed");
  await page.getByLabel("Online players value").fill("123");
  await expect
    .poll(() => page.evaluate(() => window.doc.players.online.value))
    .toBe(123);
  await openEntryTool(page, "Player hover");
  await page.getByLabel("Player hover", { exact: true }).selectOption("custom");
  await page.getByRole("textbox", { name: "Hover inline editor" }).focus();
  await page
    .getByRole("button", { name: "Close player hover", exact: true })
    .click();
  await page.getByRole("button", { name: "Text tools", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Align center", exact: true }),
  ).toBeEnabled();
});
