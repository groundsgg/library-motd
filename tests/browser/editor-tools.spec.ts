import { expect, test, type Page } from "@playwright/test";

async function selectAlpha(page: Page) {
  await page.evaluate(() =>
    window.editor.execute({ type: "replace-source", source: "Alpha Beta" }),
  );
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.focus();
  await input.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
      text = walker.nextNode()!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
}
test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
});

test("defaults_to_fixed_toolbar", async ({ page }) => {
  const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
  await expect(toolbar).toBeVisible();
  await page.getByRole("button", { name: "Text tools", exact: true }).click();
  await expect(
    toolbar.getByRole("button", { name: "Bold", exact: true }),
  ).toBeFocused();
});

test("selection_toolbar_follows_keyboard_selection", async ({ page }) => {
  await page.evaluate(() => window.setEditorOptions({ toolbar: "selection" }));
  const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
  await expect(toolbar).toBeHidden();
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(toolbar).toBeVisible();
  await input.evaluate((root) =>
    root.ownerDocument.getSelection()!.collapseToEnd(),
  );
  await expect(toolbar).toBeHidden();
  await page.keyboard.press("Alt+F10");
  await expect(toolbar).toBeVisible();
  await expect(
    toolbar.getByRole("button", { name: "Bold", exact: true }),
  ).toBeFocused();
});

test("switching_toolbar_preserves_selection_and_undo", async ({ page }) => {
  await page.evaluate(() => window.setEditorOptions({ toolbar: "selection" }));
  await selectAlpha(page);
  await expect(
    page.getByRole("toolbar", { name: "Text formatting" }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.changes = [];
    window.setEditorOptions({ toolbar: "fixed" });
  });
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  const bold = await page.evaluate(() =>
    window.api
      .flattenText(window.doc.motd.text)
      .map((g) => g.style.bold ?? false),
  );
  expect(bold).toEqual([
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
  ]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.api.flattenText(window.doc.motd.text).some((g) => g.style.bold),
    ),
  ).toBe(false);
});

test("popover_formats_original_field", async ({ page }) => {
  await page.getByLabel("Version display").selectOption("always");
  await selectAlpha(page);
  await page.getByRole("button", { name: "Text color", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Text color" });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => window.editor.focus("version"));
  await dialog.getByLabel("Hex color").fill("#ff0000");
  await dialog.getByLabel("Hex color").press("Tab");
  const colors = await page.evaluate(() =>
    window.api.flattenText(window.doc.motd.text).map((g) => g.color),
  );
  expect(colors).toEqual([
    "#ff0000",
    "#ff0000",
    "#ff0000",
    "#ff0000",
    "#ff0000",
    "#aaaaaa",
    "#aaaaaa",
    "#aaaaaa",
    "#aaaaaa",
    "#aaaaaa",
  ]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.locator("#editor [data-editor-field=version]"),
  ).toContainText("Maintenance");
});

test("tools_fit_scaled_scrolled_and_iframe_previews", async ({ page }) => {
  await page.setContent(
    '<iframe style="width:700px;height:450px" src="http://127.0.0.1:4173/tests/browser/host.html"></iframe>',
  );
  const frame = page.frameLocator("iframe"),
    input = frame.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.waitFor();
  await input.evaluate((root) => {
    window.setEditorOptions({ toolbar: "selection" });
    document.querySelector<HTMLElement>("#editor")!.style.transform =
      "scale(.8)";
    root.focus();
  });
  await input.press("Control+Home");
  await input.press("Shift+ArrowRight");
  const toolbar = frame.getByRole("toolbar", { name: "Text formatting" });
  await expect(toolbar).toBeVisible();
  const bounds = await toolbar.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      right: r.right,
      bottom: r.bottom,
      width: innerWidth,
      height: innerHeight,
    };
  });
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
});

test("touch_sheet_keeps_keyboard_access", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.evaluate(() => window.setEditorOptions({ toolbar: "selection" }));
  await selectAlpha(page);
  await page.getByRole("button", { name: "Gradient", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Gradient" });
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  await sheet.getByLabel("Gradient position 1").fill("0.1");
  await page.setViewportSize({ width: 900, height: 850 });
  await expect(page.getByRole("dialog", { name: "Gradient" })).toHaveAttribute(
    "aria-modal",
    "false",
  );
  await expect(
    page
      .getByRole("dialog", { name: "Gradient" })
      .getByLabel("Gradient position 1"),
  ).toHaveValue("0.1");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("gradient stops affect only the saved word and support a third color", async ({
  page,
}) => {
  await selectAlpha(page);
  await page.getByRole("button", { name: "Gradient", exact: true }).click();
  const tool = page.getByRole("dialog", { name: "Gradient" });
  await tool.getByLabel("Gradient position 1").fill("0");
  expect(
    await page.evaluate(() =>
      window.api.flattenText(window.doc.motd.text).map((g) => g.color),
    ),
  ).toEqual([
    "#ff0000",
    "#bf0040",
    "#800080",
    "#4000bf",
    "#0000ff",
    "#aaaaaa",
    "#aaaaaa",
    "#aaaaaa",
    "#aaaaaa",
    "#aaaaaa",
  ]);
  await tool
    .getByRole("button", { name: "Add color stop", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => window.api.flattenText(window.doc.motd.text)[2].color,
    ),
  ).toBe("#ffffff");
});

test("placeholder insertion preserves an atomic source token and undo", async ({
  page,
}) => {
  await selectAlpha(page);
  await page
    .getByRole("button", { name: "Insert placeholder", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Insert placeholder" })
    .getByRole("button", { name: "players", exact: true })
    .click();
  await expect(page.locator("#editor .mce-token")).toHaveText("42");
  await expect(
    page.locator("#editor [data-editor-field=motd] .ProseMirror"),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        window.api.serializeText(window.doc.motd.text, {
          format: "minimessage",
          rgb: true,
        }).value,
    ),
  ).toBe("{{players}} Beta");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#editor [data-editor-field=motd]")).toHaveText(
    "Alpha Beta",
  );
});

test("rainbow replaces an existing gradient on the selected text", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<gradient:#ff0000:#0000ff>ABCD</gradient>",
    }),
  );
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.focus();
  await input.press("Control+A");
  await page
    .getByRole("button", { name: "More formatting", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "More formatting" })
    .getByRole("button", { name: "Rainbow", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Rainbow" })
    .getByRole("button", { name: "Apply rainbow", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      window.api.flattenText(window.doc.motd.text).map((g) => g.color),
    ),
  ).toEqual(["#ff0000", "#7fff00", "#00ffff", "#7f00ff"]);
});

test("revoking the active field closes its mutating text tool", async ({
  page,
}) => {
  await selectAlpha(page);
  await page.getByRole("button", { name: "Text color", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Text color" })).toBeVisible();
  await page.evaluate(() => {
    window.changes = [];
    window.setEditorOptions({ features: { motd: false } });
  });
  await expect(page.getByRole("dialog", { name: "Text color" })).toBeHidden();
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});

test("returning to automatic version mode removes its editing surface and tools", async ({
  page,
}) => {
  await page.getByLabel("Version display").selectOption("always");
  const input = page.locator(
    "#editor [data-editor-field=version] .ProseMirror",
  );
  await input.focus();
  await input.press("Control+A");
  await page.getByRole("button", { name: "Text color", exact: true }).click();
  await page.evaluate(() =>
    window.editor.execute({
      type: "set-field",
      field: "version",
      value: { mode: "automatic" },
    }),
  );
  await expect(page.getByRole("dialog", { name: "Text color" })).toBeHidden();
  await expect(input).toBeHidden();
  await expect(page.locator("#editor .mcp-players")).toHaveText("42/500");
});

test("a gradient includes the resolved glyphs of a protected placeholder", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({ type: "replace-source", source: "Wi{{players}}" }),
  );
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.focus();
  await input.press("Control+A");
  await page.getByRole("button", { name: "Gradient", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Gradient" })
    .getByLabel("Gradient position 1")
    .fill("0");
  const colors = await page.evaluate(() =>
    window.api
      .flattenText(
        window.api.resolveText(window.doc.motd.text, { players: "42" }).value,
      )
      .map((g) => g.color),
  );
  expect(colors).toEqual(["#ff0000", "#aa0055", "#5500aa", "#0000ff"]);
  await expect(page.locator("#editor .mce-token")).toHaveText("42");
});

test("a source replacement invalidates an open tool selection", async ({
  page,
}) => {
  await selectAlpha(page);
  await page.getByRole("button", { name: "Text color", exact: true }).click();
  await page.evaluate(() =>
    window.editor.execute({ type: "replace-source", source: "Other text" }),
  );
  const tool = page.getByRole("dialog", { name: "Text color" });
  await tool.getByLabel("Hex color").fill("#ff0000");
  await expect(tool.getByRole("status")).toContainText("selection");
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.motd.text)
        .some((g) => g.color !== "#aaaaaa"),
    ),
  ).toBe(false);
});

test("inline alignment uses the same quantized padding as the viewer", async ({
  page,
}) => {
  await selectAlpha(page);
  await page.getByRole("button", { name: "Align center", exact: true }).click();
  const positions = await page.evaluate(() => {
    const root = document.querySelector(
      "#editor [data-editor-field=motd] .ProseMirror",
    )!;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
      text = walker.nextNode()!,
      range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 1);
    const editorBox = document
        .querySelector("#editor .mcp-motd")
        .getBoundingClientRect(),
      viewerBox = document
        .querySelector("#preview .mcp-motd")
        .getBoundingClientRect();
    return {
      editor: range.getBoundingClientRect().x - editorBox.x,
      viewer:
        document
          .querySelector("#preview .mcp-motd .mcp-glyph")
          .getBoundingClientRect().x - viewerBox.x,
    };
  });
  expect(positions.editor).toBeCloseTo(positions.viewer, 1);
});
