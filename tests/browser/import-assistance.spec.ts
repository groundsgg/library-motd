import { expect, test } from "@playwright/test";
import { openEntryTool } from "./editor-actions.js";

const source = "&#ff0000A&#cc3300B&#996600C&#669900D&#33cc00E&#00ff00F";
test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
  await page.evaluate(
    (source) =>
      window.editor.execute({
        type: "replace-source",
        source,
        format: "legacy-ampersand",
      }),
    source,
  );
});

test("assistance is opt-in and Apply is one undoable transaction", async ({
  page,
}) => {
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await expect(
    page.getByRole("dialog", { name: "Import assistance", exact: true }),
  ).toHaveCount(0);
  await openEntryTool(page, "Import assistance");
  const dialog = page.getByRole("dialog", {
    name: "Import assistance",
    exact: true,
  });
  await expect(dialog.locator(".mce-assistance-before .mcp-motd")).toHaveText(
    "ABCDEF",
  );
  await expect(dialog.locator(".mce-assistance-after .mcp-motd")).toHaveText(
    "ABCDEF",
  );
  await expect(
    dialog.getByLabel("Original source", { exact: true }),
  ).toHaveValue(source);
  await expect(
    dialog.getByLabel("Suggested source", { exact: true }),
  ).toHaveAttribute("readonly", "");
  await expect(
    dialog.getByLabel("Suggested source", { exact: true }),
  ).toHaveValue(/<gradient:/);
  await expect(dialog.getByRole("status")).toContainText("RGB deviation: 0");
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  expect(await page.evaluate(() => window.doc.motd.text.nodes[0]?.type)).toBe(
    "group",
  );
  expect(await page.evaluate(() => JSON.stringify(window.doc))).not.toBe(
    before,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
});

test("Cancel and language changes keep source and focused controls", async ({
  page,
}) => {
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await openEntryTool(page, "Import assistance");
  const original = page.getByLabel("Original source", { exact: true });
  await original.focus();
  const control = await original.elementHandle();
  await page.evaluate(() =>
    window.setEditorOptions({ labels: window.api.germanLabels }),
  );
  await expect(
    page.getByLabel("Ursprünglicher Quelltext", { exact: true }),
  ).toBeFocused();
  expect(await control!.evaluate((e) => e.isConnected)).toBe(true);
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
});

for (const change of ["document", "context", "readOnly", "feature"] as const) {
  test(`stale ${change} changes cannot apply a proposal`, async ({ page }) => {
    await openEntryTool(page, "Import assistance");
    await page.evaluate((change) => {
      if (change === "document")
        window.editor.execute({ type: "replace-source", source: "External" });
      else if (change === "context")
        window.setEditorOptions({
          context: { ...window.context, viewportWidth: 300 },
        });
      else if (change === "readOnly")
        window.setEditorOptions({ readOnly: true });
      else window.setEditorOptions({ features: { assistance: false } });
    }, change);
    const before = await page.evaluate(() => JSON.stringify(window.doc));
    const dialog = page.getByRole("dialog", {
      name: "Import assistance",
      exact: true,
    });
    await expect(
      dialog.getByRole("button", { name: "Apply", exact: true }),
    ).toBeDisabled();
    await expect(dialog.getByRole("status")).toContainText("changed");
    await dialog
      .getByRole("button", { name: "Apply", exact: true })
      .evaluate((button) => (button as HTMLButtonElement).click());
    expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  });
}

test("protected content has no candidate and Apply stays disabled", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<red>{{players}}</red>",
    }),
  );
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await openEntryTool(page, "Import assistance");
  const dialog = page.getByRole("dialog", {
    name: "Import assistance",
    exact: true,
  });
  await expect(dialog.getByRole("status")).toContainText("No safe proposals");
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
});

test("alignment proposals replace padding only on acceptance and Undo restores source", async ({
  page,
}) => {
  await page.evaluate(() => {
    const context = {
      ...window.context,
      profile: {
        ...window.context.profile,
        geometry: { ...window.context.profile.geometry, contentWidth: 84 },
      },
    };
    window.setEditorOptions({ context });
    window.editor.execute({
      type: "replace-source",
      source: "    ABC<newline>        ABC",
    });
  });
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await openEntryTool(page, "Import assistance");
  const dialog = page.getByRole("dialog", {
    name: "Import assistance",
    exact: true,
  });
  await expect(dialog.getByRole("status")).toContainText(
    "leading spaces replaced: 12",
  );
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  expect(await page.evaluate(() => window.doc.motd.alignments)).toEqual([
    "center",
    "right",
  ]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
});

test("invalid numeric tolerances cannot enable Apply", async ({ page }) => {
  await openEntryTool(page, "Import assistance");
  const dialog = page.getByRole("dialog", {
    name: "Import assistance",
    exact: true,
  });
  for (const value of ["-1", "256", ""]) {
    await dialog
      .getByLabel("RGB tolerance (0–255)", { exact: true })
      .fill(value);
    await expect(
      dialog.getByRole("button", { name: "Apply", exact: true }),
    ).toBeDisabled();
  }
  await dialog.getByLabel("RGB tolerance (0–255)", { exact: true }).fill("0");
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeEnabled();
});

test("changing font support invalidates a previously measured alignment", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.setEditorOptions({
      context: {
        ...window.context,
        profile: {
          ...window.context.profile,
          geometry: { ...window.context.profile.geometry, contentWidth: 84 },
        },
      },
    });
    window.editor.execute({ type: "replace-source", source: "    ABC" });
  });
  await openEntryTool(page, "Import assistance");
  const dialog = page.getByRole("dialog", {
    name: "Import assistance",
    exact: true,
  });
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const context = window.editorOptions.context;
    window.setEditorOptions({
      context: {
        ...context,
        profile: {
          ...context.profile,
          font: { ...context.profile.font, supported: () => false },
        },
      },
    });
  });
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByRole("status")).toContainText("changed");
});

test("iframe controls and preview lifetimes belong to their owning document", async ({
  page,
}) => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const frame = document.createElement("iframe");
        frame.id = "assistance-frame";
        frame.width = "1000";
        frame.height = "800";
        frame.onload = () => {
          const doc = frame.contentDocument!;
          const editor = window.dom.createEditor(doc.body, {
            document: window.doc,
            context: window.context,
            onChange() {},
          });
          const dispose = doc.createElement("button");
          dispose.textContent = "Dispose";
          dispose.onclick = () => editor.destroy();
          doc.body.append(dispose);
          resolve();
        };
        frame.srcdoc =
          '<!doctype html><link rel="stylesheet" href="/src/dom/styles.css"><body></body>';
        document.body.append(frame);
      }),
  );
  // Own-document controls are tested with the complete embedded viewport visible.
  await page.locator("#assistance-frame").scrollIntoViewIfNeeded();
  const frame = page.frameLocator("#assistance-frame");
  await frame
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click();
  await frame
    .getByRole("button", { name: "Import assistance", exact: true })
    .click();
  await expect(
    frame.getByRole("dialog", { name: "Import assistance", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Import assistance", exact: true }),
  ).toHaveCount(0);
  await frame.getByRole("button", { name: "Cancel", exact: true }).click();
  await frame.getByRole("button", { name: "Dispose", exact: true }).click();
  await expect(frame.locator(".mcp-stage")).toHaveCount(0);
  await expect(frame.locator(".mce-root")).toHaveCount(0);
});
