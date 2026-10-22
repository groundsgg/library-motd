import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
});

test("context and labels preserve the focused input, selection and undo", async ({
  page,
}) => {
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("Hello ");
  await page.keyboard.press("Shift+ArrowLeft");
  await page.evaluate(() => {
    window.originalInput = document.querySelector(
      "#editor [data-editor-field=motd] .ProseMirror",
    );
    window.originalSelection = document.getSelection().toString();
    window.setEditorOptions({
      context: { ...window.context, serverName: "Updated name" },
      labels: { undo: "Undo change" },
    });
  });
  expect(
    await page.evaluate(
      () =>
        window.originalInput ===
        document.querySelector("#editor [data-editor-field=motd] .ProseMirror"),
    ),
  ).toBe(true);
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => document.getSelection().toString())).toBe(
    " ",
  );
  await page.getByRole("button", { name: "Undo change", exact: true }).click();
  await expect(input).not.toContainText("Hello ");
});

test("in-place context changes and resolver identity update the scene without emitting changes", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.context.serverName = "Mutated context";
    window.setEditorOptions({ context: window.context });
  });
  await expect(page.locator("#editor .mcp-server-name")).toHaveText(
    "Mutated context",
  );
  await page.evaluate(() =>
    window.setEditorOptions({
      context: {
        ...window.context,
        assetProvider: () => ({
          defaultServerIcon: "/tests/fixtures/client/reference-icon.png",
        }),
      },
    }),
  );
  await expect(page.locator("#editor .mcp-icon img")).toHaveAttribute(
    "src",
    "/tests/fixtures/client/reference-icon.png",
  );
  await page.evaluate(() =>
    window.setEditorOptions({
      context: {
        ...window.context,
        assetProvider: () => ({
          defaultServerIcon: "/tests/fixtures/client/transparent-icon.png",
        }),
      },
    }),
  );
  await expect(page.locator("#editor .mcp-icon img")).toHaveAttribute(
    "src",
    "/tests/fixtures/client/transparent-icon.png",
  );
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});

test("acknowledged documents preserve input and external replacement resets undo", async ({
  page,
}) => {
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("Before ");
  await page.evaluate(() => {
    window.originalInput = document.querySelector(
      "#editor [data-editor-field=motd] .ProseMirror",
    );
    window.setEditorOptions();
  });
  expect(
    await page.evaluate(
      () =>
        window.originalInput ===
        document.querySelector("#editor [data-editor-field=motd] .ProseMirror"),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    const next = window.api.createDocument(
      window.api.parseText("Replacement", "minimessage").value,
    );
    window.doc = next;
    window.setEditorOptions({ document: next });
    window.editor.execute({ type: "undo" });
  });
  await expect(input).toHaveText("Replacement");
});

test("presentation updates during composition retain the active input", async ({
  page,
}) => {
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.focus();
  await input.evaluate((el) => {
    window.originalInput = el;
    el.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true, data: "" }),
    );
    window.setEditorOptions({
      context: { ...window.context, serverName: "After composition" },
    });
  });
  expect(await page.evaluate(() => window.originalInput.isConnected)).toBe(
    true,
  );
  await input.evaluate((el) =>
    el.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "" }),
    ),
  );
  await expect(page.locator("#editor .mcp-server-name")).toHaveText(
    "After composition",
  );
  expect(
    await page.evaluate(
      () =>
        window.originalInput ===
        document.querySelector("#editor [data-editor-field=motd] .ProseMirror"),
    ),
  ).toBe(true);
});

test("viewer and editor retain the same row, icon and MOTD geometry", async ({
  page,
}) => {
  const geometry = await page.evaluate(() => {
    const measure = (host) => {
      const row = document
        .querySelector(host + " .mcp-row")
        .getBoundingClientRect();
      return [".mcp-icon", ".mcp-motd"].map((selector) => {
        const r = document
          .querySelector(host + " " + selector)
          .getBoundingClientRect();
        return [r.x - row.x, r.y - row.y, r.width, r.height];
      });
    };
    return { viewer: measure("#preview"), editor: measure("#editor") };
  });
  expect(geometry.editor).toEqual(geometry.viewer);
});

test("destroying one editor twice leaves the other instance usable", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.other = window.dom.createEditor(document.querySelector("#second"), {
      ...window.editorOptions,
      onChange: () => {},
    });
    window.editor.destroy();
    window.editor.destroy();
    window.other.execute({ type: "replace-source", source: "Independent" });
  });
  await expect(page.locator("#editor .mce-root")).toHaveCount(0);
  await expect(
    page.locator("#second [data-editor-field=motd] .ProseMirror"),
  ).toHaveText("Independent");
});
