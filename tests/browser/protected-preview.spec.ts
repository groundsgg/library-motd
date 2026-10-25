import { expect, test } from "@playwright/test";
import { placeCaretAtTextEnd } from "./editor-actions.js";

const protectedComponent = {
  text: "<b>Click</b>",
  clickEvent: {
    action: "open_url",
    value: "https://example.invalid/should-not-open",
  },
  hoverEvent: { action: "show_text", contents: { text: "not MOTD text" } },
  extra: [{ text: " here" }],
};
test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
  await page.evaluate((component) => {
    window.context = {
      ...window.context,
      background: "none",
      animations: false,
    };
    window.setEditorOptions({ context: window.context });
    window.editor.execute({
      type: "replace-source",
      format: "json",
      source: JSON.stringify({
        text: "",
        extra: [component, { text: " tail" }],
      }),
    });
  }, protectedComponent);
});

test("viewer and editor show protected literal descendants as inert text", async ({
  page,
}) => {
  const input = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await expect(input).toHaveText("<b>Click</b> here tail");
  await expect(page.locator("#preview .mcp-motd")).toHaveText(
    "<b>Click</b> here tail",
  );
  await expect(input.locator(".mce-token")).toHaveCount(1);
  await expect(input.locator(".mce-token")).toHaveAttribute(
    "contenteditable",
    "false",
  );
  // ProseMirror may add its own separator image outside atomic nodes.
  await expect(
    input.locator(".mce-token").locator("b, a, img, script"),
  ).toHaveCount(0);
  await page.locator("#preview .mcp-motd").click();
  await expect(page).toHaveURL(/\/tests\/browser\/host\.html$/);
  await expect(page.locator("#editor .mce-diagnostics")).toContainText(
    "Protected component is shown approximately",
  );
});

test("a neighboring edit and undo keep the protected raw subtree intact", async ({
  page,
}) => {
  const input = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await placeCaretAtTextEnd(input);
  await page.keyboard.type("!");
  await expect(input).toHaveText("<b>Click</b> here tail!");
  const serialized = await page.evaluate(
    () =>
      window.api.serializeText(window.doc.motd.text, { format: "json" }).value,
  );
  expect(serialized).toContain(JSON.stringify(protectedComponent));
  await input.press("Control+z");
  await expect(input).toHaveText("<b>Click</b> here tail");
  const afterUndo = await page.evaluate(
    () =>
      window.api.serializeText(window.doc.motd.text, { format: "json" }).value,
  );
  expect(afterUndo).toContain(JSON.stringify(protectedComponent));
  await expect(input.locator(".mce-token")).toHaveCount(1);
});

test("saved protected components keep their localized approximation warning", async ({
  page,
}) => {
  await page.evaluate(() => {
    const document = window.api.readDocument(
      window.api.writeDocument(window.doc),
    ).value;
    window.setEditorOptions({ document, labels: window.api.germanLabels });
  });
  await expect(page.locator("#editor .mce-diagnostics")).toContainText(
    "Geschützte Komponente wird angenähert dargestellt",
  );
  await expect(
    page.getByRole("textbox", { name: "MOTD direkt bearbeiten", exact: true }),
  ).toHaveText("<b>Click</b> here tail");
});
