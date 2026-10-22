import { expect, test } from "@playwright/test";
import { openEntryTool } from "./editor-actions.js";
test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
});
test("source is a cancellable draft and Apply records one source transaction", async ({
  page,
}) => {
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await openEntryTool(page, "Source");
  const dialog = page.getByRole("dialog", {
    name: "Source editor",
    exact: true,
  });
  await dialog
    .getByLabel("MOTD source", { exact: true })
    .fill("<red>Local draft");
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  await openEntryTool(page, "Source");
  await dialog.getByLabel("MOTD source", { exact: true }).fill("<red>Applied");
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  expect(await page.evaluate(() => window.changes)).toEqual([
    { origin: "source", changedFields: ["motd"] },
  ]);
  await expect(page.locator("#preview .mcp-motd")).toContainText("Applied");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
});
test("source errors and protected conversions preserve the draft and document", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<font:custom>X</font>",
    }),
  );
  await openEntryTool(page, "Source");
  const dialog = page.getByRole("dialog", {
      name: "Source editor",
      exact: true,
    }),
    source = dialog.getByLabel("MOTD source", { exact: true });
  const original = await source.inputValue();
  await dialog.getByLabel("Source format").selectOption("json");
  await expect(source).toHaveValue(original);
  await expect(dialog.getByRole("status")).toContainText(
    "Protected constructs",
  );
  await expect(dialog.getByLabel("Source format")).toHaveValue("minimessage");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() =>
    window.editor.execute({ type: "replace-source", source: "Plain" }),
  );
  await openEntryTool(page, "Source");
  await dialog.getByLabel("Source format").selectOption("json");
  await source.fill("{broken");
  await expect(source).toHaveValue("{broken");
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#preview .mcp-motd")).toHaveText("Plain");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});
test("source drafts across custom fields apply atomically", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.editor.execute({
      type: "set-field",
      field: "version",
      value: {
        mode: "always",
        text: window.api.parseText("Old", "minimessage").value,
      },
    });
    window.changes = [];
  });
  await openEntryTool(page, "Source");
  const dialog = page.getByRole("dialog", {
    name: "Source editor",
    exact: true,
  });
  await dialog.getByLabel("MOTD source", { exact: true }).fill("New MOTD");
  await dialog.getByLabel("Source field").selectOption("version");
  await dialog
    .getByLabel("Version source", { exact: true })
    .fill("New version");
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  expect(await page.evaluate(() => window.changes)).toEqual([
    { origin: "source", changedFields: ["motd", "version"] },
  ]);
  await expect(page.locator("#preview .mcp-players")).toContainText(
    "New version",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#preview .mcp-players")).toContainText("Old");
});
test("external replacement invalidates a source draft", async ({ page }) => {
  await openEntryTool(page, "Source");
  const dialog = page.getByRole("dialog", {
    name: "Source editor",
    exact: true,
  });
  await dialog.getByLabel("MOTD source", { exact: true }).fill("Stale");
  await page.evaluate(() =>
    window.setEditorOptions({ document: window.api.createDocument() }),
  );
  await expect(dialog.getByRole("status")).toContainText(
    "can no longer be applied",
  );
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
test("readonly export uses successful serializer output and cannot copy diagnostics", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.editor.execute({
      type: "replace-source",
      source: "<font:custom>X</font>",
    });
    window.changes = [];
    window.setEditorOptions({ readOnly: true });
  });
  await openEntryTool(page, "Export");
  const dialog = page.getByRole("dialog", { name: "Export", exact: true });
  await expect(dialog.getByLabel("Export output")).toHaveAttribute(
    "readonly",
    "",
  );
  await expect(
    dialog.getByRole("button", { name: "Copy output", exact: true }),
  ).toBeEnabled();
  await dialog.getByLabel("Export format").selectOption("json");
  await expect(dialog.getByLabel("Export output")).toHaveValue("");
  await expect(dialog.getByRole("status")).toContainText(
    "Protected constructs",
  );
  await expect(
    dialog.getByRole("button", { name: "Copy output", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
test("an explicit adapter response is staged and disabled fields survive import Apply", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setEditorOptions({
      features: { players: false },
      imports: {
        adapter: async () => ({
          ...window.context.base,
          description: "Imported",
          players: { online: 99, max: 120, sample: [] },
        }),
      },
    }),
  );
  await openEntryTool(page, "Import");
  const dialog = page.getByRole("dialog", {
    name: "Import server status",
    exact: true,
  });
  await dialog.getByLabel("Server address").fill("example.test");
  await dialog
    .getByRole("button", { name: "Import server", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator("#preview .mcp-motd")).toContainText("Imported");
  expect(await page.evaluate(() => window.doc.players.online.mode)).toBe(
    "inherit",
  );
  expect(
    await page.evaluate(() => window.changes.at(-1).changedFields),
  ).not.toContain("players");
});
for (const action of ["cancel", "replace", "readonly", "destroy"] as const)
  test(`late import is discarded after ${action}`, async ({ page }) => {
    await page.evaluate(() =>
      window.setEditorOptions({
        imports: {
          adapter: (_address, signal) =>
            new Promise((resolve) => {
              window.finishImport = resolve;
              signal.addEventListener(
                "abort",
                () => (window.importAborted = true),
              );
            }),
        },
      }),
    );
    await openEntryTool(page, "Import");
    const dialog = page.getByRole("dialog", {
      name: "Import server status",
      exact: true,
    });
    await dialog.getByLabel("Server address").fill("example.test");
    await dialog
      .getByRole("button", { name: "Import server", exact: true })
      .click();
    await page.waitForFunction(() => !!window.finishImport);
    if (action === "cancel")
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    else
      await page.evaluate((action) => {
        if (action === "replace")
          window.setEditorOptions({ document: window.api.createDocument() });
        else if (action === "readonly")
          window.setEditorOptions({ readOnly: true });
        else window.editor.destroy();
      }, action);
    await page.evaluate(() =>
      window.finishImport({ ...window.context.base, description: "Too late" }),
    );
    expect(await page.evaluate(() => window.importAborted)).toBe(true);
    expect(await page.evaluate(() => window.changes.length)).toBe(0);
    if (action === "replace") {
      await expect(dialog.getByRole("status")).toContainText(
        "can no longer be applied",
      );
      await expect(
        dialog.getByRole("button", { name: "Apply", exact: true }),
      ).toBeDisabled();
    } else await expect(dialog).toBeHidden();
  });
test("adapter errors are nonempty and requests respect the configured timeout", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setEditorOptions({
      imports: {
        adapter: async () => {
          throw Error("");
        },
      },
    }),
  );
  await openEntryTool(page, "Import");
  const dialog = page.getByRole("dialog", {
    name: "Import server status",
    exact: true,
  });
  await dialog.getByLabel("Server address").fill("example.test");
  await dialog
    .getByRole("button", { name: "Import server", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Import failed");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() =>
    window.setEditorOptions({
      imports: { timeoutMs: 30, adapter: () => new Promise(() => {}) },
    }),
  );
  await openEntryTool(page, "Import");
  await dialog.getByLabel("Server address").fill("example.test");
  await dialog
    .getByRole("button", { name: "Import server", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("timed out");
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});

test("synchronous adapter failures remain safe when the dialog closes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() =>
    window.setEditorOptions({
      imports: {
        adapter: () => {
          throw Error("Immediate failure");
        },
      },
    }),
  );
  await openEntryTool(page, "Import");
  const dialog = page.getByRole("dialog", {
    name: "Import server status",
    exact: true,
  });
  await dialog.getByLabel("Server address").fill("example.test");
  await dialog
    .getByRole("button", { name: "Import server", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Immediate failure");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(errors).toEqual([]);
});

test("newer import requests supersede older responses without committing either", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setEditorOptions({
      imports: {
        adapter: (_address, signal) =>
          new Promise((resolve) => {
            (window.requests ??= []).push({ resolve, signal });
          }),
      },
    }),
  );
  await openEntryTool(page, "Import");
  const dialog = page.getByRole("dialog", {
    name: "Import server status",
    exact: true,
  });
  await dialog.getByLabel("Server address").fill("first.test");
  await dialog
    .getByRole("button", { name: "Import server", exact: true })
    .click();
  await dialog.getByLabel("Server address").fill("second.test");
  await dialog
    .getByRole("button", { name: "Import server", exact: true })
    .click();
  await page.evaluate(() =>
    window.requests[1].resolve({
      ...window.context.base,
      description: "Second result",
    }),
  );
  await expect(dialog.getByLabel("Imported server status")).toHaveValue(
    /Second result/,
  );
  await page.evaluate(() =>
    window.requests[0].resolve({
      ...window.context.base,
      description: "Old result",
    }),
  );
  expect(await page.evaluate(() => window.requests[0].signal.aborted)).toBe(
    true,
  );
  await expect(dialog.getByLabel("Imported server status")).not.toHaveValue(
    /Old result/,
  );
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
test("changing the import adapter invalidates and aborts its request", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setEditorOptions({
      imports: {
        adapter: (_address, signal) =>
          new Promise((resolve) => {
            window.finishImport = resolve;
            signal.addEventListener(
              "abort",
              () => (window.importAborted = true),
            );
          }),
      },
    }),
  );
  await openEntryTool(page, "Import");
  const dialog = page.getByRole("dialog", {
    name: "Import server status",
    exact: true,
  });
  await dialog.getByLabel("Server address").fill("example.test");
  await dialog
    .getByRole("button", { name: "Import server", exact: true })
    .click();
  await page.evaluate(() =>
    window.setEditorOptions({
      imports: { adapter: async () => window.context.base },
    }),
  );
  await expect(dialog.getByRole("status")).toContainText(
    "can no longer be applied",
  );
  expect(await page.evaluate(() => window.importAborted)).toBe(true);
  await page.evaluate(() =>
    window.finishImport({
      ...window.context.base,
      description: "Stale adapter",
    }),
  );
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
test("host edits invalidate a pending import and source permissions invalidate its draft", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setEditorOptions({
      imports: {
        adapter: () =>
          new Promise((resolve) => {
            window.finishImport = resolve;
          }),
      },
    }),
  );
  await openEntryTool(page, "Import");
  const dialog = page.getByRole("dialog", {
    name: "Import server status",
    exact: true,
  });
  await dialog.getByLabel("Server address").fill("example.test");
  await dialog
    .getByRole("button", { name: "Import server", exact: true })
    .click();
  await page.evaluate(() =>
    window.editor.execute({ type: "replace-source", source: "Newer edit" }),
  );
  await expect(dialog.getByRole("status")).toContainText(
    "can no longer be applied",
  );
  await page.evaluate(() =>
    window.finishImport({ ...window.context.base, description: "Stale" }),
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#editor .mcp-motd")).toHaveText("Newer edit");
  await openEntryTool(page, "Source");
  await page.getByLabel("MOTD source", { exact: true }).fill("Do not save");
  await page.evaluate(() =>
    window.setEditorOptions({ features: { motd: false } }),
  );
  await expect(
    page.getByRole("dialog", { name: "Source editor", exact: true }),
  ).toBeHidden();
  expect(await page.evaluate(() => window.changes.length)).toBe(1);
});

test("an open entry menu updates mutation permissions while keeping readonly export reachable", async ({
  page,
}) => {
  await page
    .locator("#editor")
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click();
  const menu = page.getByRole("dialog", {
    name: "Server entry tools",
    exact: true,
  });
  await page.evaluate(() => window.setEditorOptions({ readOnly: true }));
  for (const name of [
    "Player display",
    "Version settings",
    "Player hover",
    "Server icon",
    "Source",
  ])
    await expect(
      menu.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await expect(
    menu.getByRole("button", { name: "Export", exact: true }),
  ).toBeEnabled();
});
