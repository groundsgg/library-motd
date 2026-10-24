import { expect, test } from "@playwright/test";
import { openEntryTool } from "./editor-actions.js";
import { PNG } from "pngjs";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
});

test("German catalogs cover visible text, dynamic fields and diagnostics", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.editor.execute({ type: "replace-source", source: "{{missing}}" });
    window.setEditorOptions({ labels: window.api.germanLabels });
  });
  await expect(
    page
      .locator("#editor .mce-entry-actions")
      .getByRole("button", { name: "Textwerkzeuge", exact: true }),
  ).toHaveText("Textwerkzeuge");
  await expect(page.locator("#editor .mce-diagnostics")).toContainText(
    "Für {{missing}} ist kein Wert vorhanden.",
  );
  await page.getByRole("button", { name: "Farbverlauf", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Farbverlauf", exact: true });
  await expect(
    dialog.getByLabel("Verlaufsfarbe 1", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Position im Verlauf 2", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Farbpunkt hinzufügen", exact: true }),
  ).toBeVisible();
});

test("changing language in an open color tool preserves its control, draft selection and undo", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({ type: "replace-source", source: "Alpha Beta" }),
  );
  const input = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await input.focus();
  await input.evaluate((root) => {
    const text = root.ownerDocument
      .createTreeWalker(root, NodeFilter.SHOW_TEXT)
      .nextNode()!;
    const range = root.ownerDocument.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);
    const selection = root.ownerDocument.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    root.ownerDocument.dispatchEvent(new Event("selectionchange"));
  });
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString()))
    .toBe("Alpha");
  await page.getByRole("button", { name: "Text color", exact: true }).click();
  const hex = page.getByLabel("Hex color", { exact: true });
  await hex.fill("#00ff00");
  const control = await hex.elementHandle();
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await page.evaluate(() =>
    window.setEditorOptions({ labels: window.api.germanLabels }),
  );
  const translated = page.getByLabel("Hexfarbe", { exact: true });
  await expect(translated).toBeFocused();
  await expect(translated).toHaveValue("#00ff00");
  expect(await control!.evaluate((e) => e.isConnected)).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  await translated.fill("#ff0000");
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.motd.text)
        .map((g) => g.style.color ?? null),
    ),
  ).toEqual([...Array(5).fill("#ff0000"), ...Array(5).fill(null)]);
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.motd.text)
        .slice(0, 5)
        .every((g) => g.style.color === "#00ff00"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.api.flattenText(window.doc.motd.text).some((g) => g.style.color),
    ),
  ).toBe(false);
});

test("source drafts and focus survive a language change without committing content", async ({
  page,
}) => {
  await openEntryTool(page, "Source");
  const source = page.getByLabel("MOTD source", { exact: true });
  await source.fill("<gold>Uncommitted");
  const control = await source.elementHandle();
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await page.evaluate(() =>
    window.setEditorOptions({ labels: window.api.germanLabels }),
  );
  const translated = page.getByLabel("MOTD-Quelltext", { exact: true });
  await expect(translated).toBeFocused();
  await expect(translated).toHaveValue("<gold>Uncommitted");
  expect(await control!.evaluate((e) => e.isConnected)).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
});

test("overrides are literal and independent from another editor", async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "localized-second";
    document.body.append(host);
    window.dom.createEditor(host, {
      document: window.doc,
      context: window.context,
      labels: window.api.germanLabels,
      onChange() {},
    });
    window.setEditorOptions({
      labels: { bold: "<img src=x onerror=alert(1)>" },
    });
  });
  await expect(
    page.locator("#editor").getByRole("button", {
      name: "<img src=x onerror=alert(1)>",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(page.locator("#editor .mce-toolbar img")).toHaveCount(0);
  await expect(
    page
      .locator("#localized-second")
      .getByRole("button", { name: "Fett", exact: true }),
  ).toHaveCount(1);
  await expect(
    page
      .locator("#localized-second .mce-entry-actions")
      .getByRole("button", { name: "Textwerkzeuge", exact: true }),
  ).toHaveText("Textwerkzeuge");
});

test("numbered fields can change word order without replacing their inputs", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Gradient", exact: true }).click();
  const input = page.getByLabel("Gradient color 1", { exact: true });
  await input.focus();
  const control = await input.elementHandle();
  await page.evaluate(() =>
    window.setEditorOptions({
      labels: {
        ...window.api.germanLabels,
        gradientColorNumber: "Farbe {index}: {label}",
      },
    }),
  );
  await expect(
    page.getByLabel("Farbe 1: Verlaufsfarbe", { exact: true }),
  ).toBeFocused();
  expect(await control!.evaluate((e) => e.isConnected)).toBe(true);
});

test("invalidated source drafts show a translated reason", async ({ page }) => {
  await openEntryTool(page, "Source");
  await page.evaluate(() => {
    window.setEditorOptions({ labels: window.api.germanLabels });
    const replacement = structuredClone(window.doc);
    replacement.players.hidden = true;
    window.editor.execute({ type: "replace-document", document: replacement });
  });
  await expect(
    page
      .getByRole("dialog", { name: "Quelltexteditor", exact: true })
      .getByRole("status"),
  ).toContainText("Das Dokument oder die Editorkonfiguration wurde geändert.");
});

test("count modes and calculated status stay localized", async ({ page }) => {
  await openEntryTool(page, "Player display");
  await page.evaluate(() =>
    window.setEditorOptions({ labels: window.api.germanLabels }),
  );
  const panel = page.getByRole("dialog", {
    name: "Spieleranzeige",
    exact: true,
  });
  await expect(
    panel.getByRole("option", { name: "Livewert", exact: true }),
  ).toHaveCount(2);
  await panel
    .getByLabel("Modus für Spieler online", { exact: true })
    .selectOption("fixed");
  await panel.getByLabel("Wert für Spieler online", { exact: true }).fill("12");
  await expect(panel.getByRole("status")).toContainText(
    "Berechnete Vorschau: 12/500",
  );
});

test("crop controls translate in place while retaining their draft", async ({
  page,
}) => {
  const png = new PNG({ width: 64, height: 64 });
  png.data.fill(255);
  await page.locator('#editor input[type="file"]').setInputFiles({
    name: "icon.png",
    mimeType: "image/png",
    buffer: PNG.sync.write(png),
  });
  const width = page.getByLabel("Crop size", { exact: true });
  await expect(width).toBeVisible();
  await width.fill("32");
  const control = await width.elementHandle();
  await page.evaluate(() =>
    window.setEditorOptions({ labels: window.api.germanLabels }),
  );
  const translated = page.getByLabel("Größe des Zuschnitts", { exact: true });
  await expect(translated).toBeFocused();
  await expect(translated).toHaveValue("32");
  await expect(
    page.getByLabel("X-Position des Zuschnitts", { exact: true }),
  ).toBeVisible();
  expect(await control!.evaluate((e) => e.isConnected)).toBe(true);
});

test("protected-source tooltips follow language without changing source", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      format: "json",
      source: JSON.stringify({
        translate: "example.protected",
        fallback: "Protected",
      }),
    }),
  );
  const token = page.locator("#editor .mce-token").first();
  await expect(token).toHaveCount(1);
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await page.evaluate(() =>
    window.setEditorOptions({ labels: window.api.germanLabels }),
  );
  await expect(token).toHaveAttribute(
    "title",
    "Geschütztes Quelltextkonstrukt; im Quelltextmodus bearbeiten",
  );
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
});

test("passive preview labels and existing icon descriptions translate too", async ({
  page,
}) => {
  await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    window.doc.icon = { pngBase64: canvas.toDataURL().split(",")[1]! };
    window.preview.update({ document: window.doc, context: window.context });
  });
  const icon = page.locator("#preview .mcp-icon img");
  await expect(icon).toHaveAttribute("alt", "Server icon");
  const original = await icon.elementHandle();
  await page.evaluate(() =>
    window.preview.update({
      document: window.doc,
      context: window.context,
      labels: window.api.germanLabels,
    }),
  );
  await expect(icon).toHaveAttribute("alt", "Server-Icon");
  await expect(page.locator("#preview .mcp-menu-title")).toHaveText(
    "Mehrspieler",
  );
  expect(await original!.evaluate((e) => e.isConnected)).toBe(true);
});

test("invalid-image diagnostics are translated in the upload tool", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setEditorOptions({ labels: window.api.germanLabels }),
  );
  await page.locator('#editor input[type="file"]').setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await expect(
    page
      .getByRole("dialog", { name: "Server-Icon bearbeiten", exact: true })
      .getByRole("status"),
  ).toContainText("Ungültiges Bild: Wähle PNG oder JPEG.");
});

for (const adapter of ["dom", "react"]) {
  test(`${adapter} example switches editor and preview language`, async ({
    page,
  }) => {
    await page.goto(`/examples/${adapter}/`);
    await page
      .getByRole("combobox", { name: "Interface language", exact: true })
      .selectOption("de");
    await expect(
      page.getByRole("button", { name: "Fett", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Presentation", exact: true })
      .selectOption("server-list");
    await expect(page.locator(".preview-output .mcp-menu-title")).toHaveText(
      "Mehrspieler",
    );
    await page
      .getByRole("combobox", { name: "Interface language", exact: true })
      .selectOption("en");
    await expect(
      page.getByRole("button", { name: "Bold", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".preview-output .mcp-menu-title")).toHaveText(
      "Play Multiplayer",
    );
  });
}

test("comparison translates background names and diagnostic messages", async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "localized-comparison";
    document.body.append(host);
    window.dom.createComparison(host, {
      document: window.doc,
      clients: [
        { id: "one", context: { ...window.context, background: "none" } },
      ],
      labels: window.api.germanLabels,
    });
  });
  await expect(
    page.locator("#localized-comparison .mcp-comparison-context"),
  ).toContainText("Hintergrund: Kein Hintergrund");
});
