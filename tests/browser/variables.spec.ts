import { expect, test, type Page } from "@playwright/test";
import { openEntryTool, selectRenderedText } from "./editor-actions.js";

async function open(page: Page) {
  await page.getByRole("button", { name: "Variables", exact: true }).click();
  return page.getByRole("dialog", { name: "Insert placeholder", exact: true });
}
test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!(window as any).editor);
  await page.evaluate(() => {
    const w = window as any;
    w.editor.execute({ type: "replace-source", source: "Alpha Beta" });
    w.setEditorOptions({
      context: { ...w.context, values: { region: "EU", private: "hidden" } },
      variableCatalog: [
        {
          name: "region",
          label: "Region",
          description: "Chosen region",
          exampleValue: "SAMPLE",
        },
        { name: "reason", label: "Maintenance reason", fields: ["hover"] },
      ],
      onChange: (document: any, change: any) => {
        w.doc = document;
        w.changes.push(change);
        w.preview.update({ document, context: w.editorOptions.context });
      },
    });
    w.changes = [];
  });
});
test("discovery stays visible with a selection toolbar and distinguishes preview from metadata", async ({
  page,
}) => {
  await page.evaluate(() =>
    (window as any).setEditorOptions({ toolbar: "selection" }),
  );
  await expect(
    page.getByRole("toolbar", { name: "Text formatting" }),
  ).toBeHidden();
  const dialog = await open(page);
  await expect(
    dialog.getByRole("button", { name: "Region (region)", exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText("Chosen region");
  await expect(dialog).toContainText("Preview: EU");
  await expect(dialog).toContainText("Example: SAMPLE");
  await expect(
    dialog.getByRole("button", { name: "private", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", {
      name: "Maintenance reason (reason)",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).changes.length)).toBe(0);
});
test("catalog insertion preserves selected formatting, source syntax and one undo", async ({
  page,
}) => {
  await page.evaluate(() =>
    (window as any).editor.execute({
      type: "replace-source",
      source: "<b>Alpha</b> Beta",
    }),
  );
  await selectRenderedText(page.locator("#editor .ProseMirror"), 0, 5);
  const dialog = await open(page);
  await dialog
    .getByRole("button", { name: "Region (region)", exact: true })
    .click();
  await expect(page.locator("#editor .mce-token")).toHaveText("EU");
  const result = await page.evaluate(() => {
    const w = window as any;
    return {
      source: w.api.serializeText(w.doc.motd.text, { format: "minimessage" })
        .value,
      bold: w.api.flattenText(w.doc.motd.text)[0].style.bold,
    };
  });
  expect(result.bold).toBe(true);
  expect(result.source).toContain("{{region}}");
  expect(result.source).not.toContain("SAMPLE");
  expect(result.source).not.toContain("EU");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#editor .ProseMirror")).toHaveText("Alpha Beta");
});
test("an open catalog refreshes context and metadata without losing the search control", async ({
  page,
}) => {
  const dialog = await open(page);
  const search = dialog.getByRole("searchbox", { name: "Search variables" });
  await search.fill("reg");
  const control = await search.elementHandle();
  await page.evaluate(() => {
    const w = window as any;
    w.setEditorOptions({
      context: { ...w.editorOptions.context, values: { region: "US" } },
      variableCatalog: [{ name: "region", label: "New region" }],
    });
  });
  await expect(search).toHaveValue("reg");
  await expect(search).toBeFocused();
  expect(await control!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(dialog).toContainText("Preview: US");
  await expect(
    dialog.getByRole("button", { name: "New region (region)", exact: true }),
  ).toBeVisible();
});
test("read-only users can inspect metadata while disabled editors cannot open controls", async ({
  page,
}) => {
  await page.evaluate(() =>
    (window as any).setEditorOptions({ readOnly: true }),
  );
  const before = await page.evaluate(() => JSON.stringify((window as any).doc));
  const dialog = await open(page);
  await expect(
    dialog.getByRole("button", { name: "Region (region)", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Insert", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => JSON.stringify((window as any).doc))).toBe(
    before,
  );
  await page.evaluate(() =>
    (window as any).setEditorOptions({ disabled: true }),
  );
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Variables", exact: true }),
  ).toBeDisabled();
});
test("empty and unknown catalogs keep imported placeholders and allow an explicit custom name", async ({
  page,
}) => {
  await page.evaluate(() => {
    const w = window as any;
    w.editor.execute({
      type: "replace-source",
      source: "Unknown {{external}}",
    });
    w.setEditorOptions({ variableCatalog: [] });
  });
  const input = page.locator("#editor .ProseMirror");
  await input.focus();
  await input.press("Control+End");
  const dialog = await open(page);
  await expect(dialog).toContainText("No variables are listed for this field.");
  await dialog
    .getByLabel("Placeholder name", { exact: true })
    .fill("custom.name");
  await expect(dialog).toContainText("not listed");
  await dialog.getByRole("button", { name: "Insert", exact: true }).click();
  const source = await page.evaluate(() => {
    const w = window as any;
    return w.api.serializeText(w.doc.motd.text, { format: "minimessage" })
      .value;
  });
  expect(source).toContain("{{external}}");
  expect(source).toContain("{{custom.name}}");
});
test("field-scoped variables follow the active pinned hover editor", async ({
  page,
}) => {
  await openEntryTool(page, "Player hover");
  const hover = page.getByRole("dialog", {
    name: "Player hover editor",
    exact: true,
  });
  await hover
    .getByLabel("Player hover", { exact: true })
    .selectOption("custom");
  await hover
    .getByRole("textbox", { name: "Hover inline editor", exact: true })
    .focus();
  const dialog = await open(page);
  await expect(
    dialog.getByRole("button", {
      name: "Maintenance reason (reason)",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Maintenance reason (reason)", exact: true })
    .click();
  expect(
    await page.evaluate(() => JSON.stringify((window as any).doc.hover)),
  ).toContain('"name":"reason"');
});
test("hiding discovery preserves tokens and keyboard navigation skips hidden tools", async ({
  page,
}) => {
  await page.evaluate(() =>
    (window as any).setEditorOptions({ features: { variables: false } }),
  );
  await expect(
    page.getByRole("button", { name: "Variables", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Insert placeholder", exact: true }),
  ).toHaveCount(0);
  const gradient = page.getByRole("button", { name: "Gradient", exact: true });
  await gradient.focus();
  await gradient.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Align left", exact: true }),
  ).toBeFocused();
});

test("inferred variables use the same derived player values as the editor", async ({
  page,
}) => {
  await page.evaluate(() => {
    const w = window as any;
    w.setEditorOptions({
      variableCatalog: undefined,
      context: { ...w.context, values: { players: "999", own: "Custom" } },
    });
  });
  const dialog = await open(page);
  await expect(
    dialog.getByRole("button", { name: "players", exact: true }),
  ).toContainText("Preview: 42");
  await expect(
    dialog.getByRole("button", { name: "max", exact: true }),
  ).toContainText("Preview: 500");
  await expect(
    dialog.getByRole("button", { name: "own", exact: true }),
  ).toContainText("Preview: Custom");
});
test("language updates preserve the focused search and metadata without saving", async ({
  page,
}) => {
  await open(page);
  const search = page.getByRole("searchbox", { name: "Search variables" });
  await search.fill("reg");
  const control = await search.elementHandle();
  await page.evaluate(() => {
    const w = window as any;
    w.setEditorOptions({ labels: w.api.germanLabels });
  });
  const dialog = page.getByRole("dialog", {
    name: "Platzhalter einfügen",
    exact: true,
  });
  await expect(
    page.getByRole("button", { name: "Variablen", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("searchbox", { name: "Variablen suchen" }),
  ).toBeFocused();
  await expect(dialog).toContainText("Vorschau: EU");
  await expect(dialog).toContainText("Beispiel: SAMPLE");
  expect(await control!.evaluate((node) => node.isConnected)).toBe(true);
  expect(await page.evaluate(() => (window as any).changes.length)).toBe(0);
});
test("keyboard discovery focuses search and inserts a choice into the saved selection", async ({
  page,
}) => {
  const button = page.getByRole("button", { name: "Variables", exact: true });
  await button.focus();
  await button.press("Enter");
  const search = page.getByRole("searchbox", { name: "Search variables" });
  await expect(search).toBeFocused();
  await page.keyboard.type("reg");
  await search.press("Tab");
  await expect(
    page.getByRole("button", { name: "Region (region)", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#editor .ProseMirror")).toBeFocused();
  expect(
    await page.evaluate(() => JSON.stringify((window as any).doc.motd.text)),
  ).toContain('"name":"region"');
});
test("a replaced document cannot receive a detached old catalog selection", async ({
  page,
}) => {
  const dialog = await open(page);
  const choice = await dialog
    .getByRole("button", { name: "Region (region)", exact: true })
    .elementHandle();
  await page.evaluate(() => {
    const w = window as any;
    w.doc = w.api.createDocument(
      w.api.parseText("Replacement", "minimessage").value,
    );
    w.setEditorOptions({ document: w.doc });
  });
  await expect(dialog).toHaveCount(0);
  await choice!.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.locator("#editor .ProseMirror")).toHaveText("Replacement");
  expect(await page.evaluate(() => (window as any).changes.length)).toBe(0);
});
test("two editor catalogs and cleanup stay isolated", async ({ page }) => {
  await page.evaluate(() => {
    const w = window as any;
    w.second.destroy();
    w.otherDoc = w.api.createDocument(
      w.api.parseText("Other", "minimessage").value,
    );
    w.other = w.dom.createEditor(document.querySelector("#second"), {
      document: w.otherDoc,
      context: { ...w.context, values: { other: "X" } },
      variableCatalog: [{ name: "other", label: "Other" }],
      onChange: (document: any) => {
        w.otherDoc = document;
      },
    });
  });
  await page
    .locator("#second")
    .getByRole("button", { name: "Variables", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Insert placeholder",
    exact: true,
  });
  await expect(
    dialog.getByRole("button", { name: "Region (region)", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => (window as any).editor.destroy());
  await dialog
    .getByRole("button", { name: "Other (other)", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as any).otherDoc.motd.text),
    ),
  ).toContain('"name":"other"');
  expect(
    await page.evaluate(() => JSON.stringify((window as any).doc.motd.text)),
  ).not.toContain('"name":"other"');
});
test("an overflowing variable leaves the two-line source unchanged", async ({
  page,
}) => {
  await page.evaluate(() => {
    const w = window as any;
    w.editor.execute({
      type: "replace-source",
      source: "a".repeat(45) + "<newline>" + "b".repeat(45),
    });
    w.setEditorOptions({
      variableCatalog: [{ name: "long" }],
      context: { ...w.context, values: { long: "X".repeat(30) } },
    });
  });
  const input = page.locator("#editor .ProseMirror");
  await input.focus();
  await input.press("Control+End");
  const before = await page.evaluate(() =>
    JSON.stringify((window as any).editor.getDocument()),
  );
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "long", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("could not be inserted");
  expect(
    await page.evaluate(() =>
      JSON.stringify((window as any).editor.getDocument()),
    ),
  ).toBe(before);
});
test("search bounds visible results while treating host metadata as text", async ({
  page,
}) => {
  await page.evaluate(() => {
    const w = window as any;
    w.setEditorOptions({
      variableCatalog: Array.from({ length: 61 }, (_, i) => ({
        name: `item${i}`,
        label: i === 60 ? "<img src=x>" : `Item ${i}`,
        description: i === 60 ? "Find this description" : "Other",
      })),
    });
  });
  const dialog = await open(page);
  await expect(dialog.locator(".mce-variable-choice")).toHaveCount(60);
  await expect(dialog).toContainText("More matches");
  await dialog
    .getByRole("searchbox", { name: "Search variables" })
    .fill("Find this");
  await expect(dialog.locator(".mce-variable-choice")).toHaveCount(1);
  await expect(dialog).toContainText("<img src=x>");
  await expect(dialog.locator("img")).toHaveCount(0);
  await dialog
    .getByRole("searchbox", { name: "Search variables" })
    .fill("unmatched");
  await expect(dialog).toContainText("No matching variables.");
});

for (const adapter of ["dom", "react"]) {
  test(`${adapter} demo forwards custom catalog metadata and preserves tokens through prop updates`, async ({
    page,
  }) => {
    await page.goto(`/examples/${adapter}/`);
    const dialog = await open(page);
    await dialog
      .getByRole("searchbox", { name: "Search variables" })
      .fill("server.name");
    await dialog
      .getByRole("button", { name: "Server name (server.name)", exact: true })
      .click();
    await expect(
      page.locator(".mce-token").filter({ hasText: "Grounds Network" }),
    ).toHaveCount(1);
    if (adapter === "dom") await page.locator("#language").selectOption("de");
    else
      await page
        .getByLabel("Interface language", { exact: true })
        .selectOption("de");
    await expect(
      page.getByRole("button", { name: "Variablen", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".mce-token").filter({ hasText: "Grounds Network" }),
    ).toHaveCount(1);
  });
}

test("replacing a selected formatted atomic placeholder keeps its style path", async ({
  page,
}) => {
  await page.evaluate(() =>
    (window as any).editor.execute({
      type: "replace-source",
      source: "<b>{{players}}</b>",
    }),
  );
  const input = page.locator("#editor .ProseMirror");
  await input.focus();
  await input.press("Control+A");
  const dialog = await open(page);
  await dialog
    .getByRole("button", { name: "Region (region)", exact: true })
    .click();
  const result = await page.evaluate(() => {
    const w = window as any;
    return {
      bold: w.api.flattenText(w.doc.motd.text)[0].style.bold,
      source: w.api.serializeText(w.doc.motd.text, { format: "minimessage" })
        .value,
    };
  });
  expect(result.bold).toBe(true);
  expect(result.source).toContain("{{region}}");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(() => {
      const w = window as any;
      return w.api.serializeText(w.doc.motd.text, { format: "minimessage" })
        .value;
    }),
  ).toContain("<b>{{players}}</b>");
});

test("a caret's pending bold formatting survives opening the variable picker", async ({
  page,
}) => {
  await page.evaluate(() =>
    (window as any).editor.execute({ type: "replace-source", source: "" }),
  );
  const input = page.locator("#editor .ProseMirror");
  await input.focus();
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bold", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const dialog = await open(page);
  await dialog
    .getByRole("button", { name: "Region (region)", exact: true })
    .click();
  expect(
    await page.evaluate(() => {
      const w = window as any;
      return w.api.flattenText(w.doc.motd.text)[0].style.bold;
    }),
  ).toBe(true);
  await page.keyboard.type("x");
  expect(
    await page.evaluate(() => {
      const w = window as any;
      return w.api
        .flattenText(w.doc.motd.text)
        .every((glyph: any) => glyph.style.bold === true);
    }),
  ).toBe(true);
});
test("variable insertion is a separate undo step from typing on either side", async ({
  page,
}) => {
  await page.clock.setFixedTime(1_000_000);
  await page.evaluate(() =>
    (window as any).editor.execute({ type: "replace-source", source: "Alpha" }),
  );
  const input = page.locator("#editor .ProseMirror");
  await input.focus();
  await input.press("Control+End");
  await page.keyboard.type("x");
  const dialog = await open(page);
  await dialog
    .getByRole("button", { name: "Region (region)", exact: true })
    .click();
  await page.keyboard.type("y");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(input).toHaveText("AlphaxEU");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(input).toHaveText("Alphax");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(input).toHaveText("Alpha");
});

test("closing a picker invalidates its detached choice callbacks", async ({
  page,
}) => {
  const dialog = await open(page);
  const choice = await dialog
    .getByRole("button", { name: "Region (region)", exact: true })
    .elementHandle();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await choice!.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.locator("#editor .ProseMirror")).toHaveText("Alpha Beta");
  expect(await page.evaluate(() => (window as any).changes.length)).toBe(0);
});
