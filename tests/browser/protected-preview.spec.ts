import { expect, test } from "@playwright/test";
import { openEntryTool, placeCaretAtTextEnd } from "./editor-actions.js";

const protectedComponent = {
  text: "<b>Click</b>",
  color: "red",
  bold: true,
  clickEvent: {
    action: "open_url",
    value: "https://example.invalid/should-not-open",
  },
  hoverEvent: { action: "show_text", contents: { text: "not MOTD text" } },
  extra: [
    {
      text: " here",
      color: "gold",
      bold: false,
      italic: true,
      underlined: true,
    },
  ],
};

test("protected-first arrays retain inherited paint and source through neighboring edit and undo", async ({
  page,
}) => {
  const dependent = [
    {
      text: "A",
      color: "red",
      bold: true,
      insertion: "preserve inherited metadata",
    },
    { text: "B", bold: false },
    "C",
  ];
  await page.evaluate((dependent) => {
    window.editor.execute({
      type: "replace-source",
      format: "json",
      source: JSON.stringify({ text: "", extra: [dependent, " tail"] }),
    });
    const saved = window.api.readDocument(
      window.api.writeDocument(window.doc),
    ).value;
    window.setEditorOptions({ document: saved });
  }, dependent);
  const input = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await expect(input).toHaveText("ABC tail");
  const token = input.locator(".mce-token");
  await expect(token).toHaveCount(1);
  await expect(token).toHaveText("ABC");
  await expect(token).toHaveAttribute("contenteditable", "false");
  const paint = (elements: Element[]) =>
    elements.map((element) => ({
      text: element.textContent,
      color: getComputedStyle(element).color,
      bold: getComputedStyle(element).fontWeight,
      width: element.getBoundingClientRect().width,
    }));
  const editor = await token.locator(".mce-effect-glyph").evaluateAll(paint);
  const viewer = (
    await page.locator("#preview .mcp-motd .mcp-glyph").evaluateAll(paint)
  ).slice(0, 3);
  expect(editor).toEqual(viewer);
  expect(
    editor.map(({ text, color, bold }) => ({ text, color, bold })),
  ).toEqual([
    { text: "A", color: "rgb(255, 85, 85)", bold: "700" },
    { text: "B", color: "rgb(255, 85, 85)", bold: "400" },
    { text: "C", color: "rgb(255, 85, 85)", bold: "700" },
  ]);
  await expect(token.locator("a, img, script")).toHaveCount(0);
  await placeCaretAtTextEnd(input);
  await page.keyboard.type("!");
  await expect(input).toHaveText("ABC tail!");
  const exported = await page.evaluate(
    () =>
      window.api.serializeText(window.doc.motd.text, { format: "json" }).value,
  );
  expect(JSON.parse(exported!).extra[0].extra[0]).toEqual(dependent);
  await input.press("Control+z");
  await expect(input).toHaveText("ABC tail");
  const undone = await page.evaluate(
    () =>
      window.api.serializeText(window.doc.motd.text, { format: "json" }).value,
  );
  expect(JSON.parse(undone!).extra[0]).toEqual(dependent);
  await expect(input.locator(".mce-token")).toHaveText("ABC");
  await expect(page.locator("#editor .mce-diagnostics")).toContainText(
    "Protected component is shown approximately",
  );
});
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

test("protected literal styles and measured glyph widths match in viewer and editor", async ({
  page,
}) => {
  const token = page.locator("#editor .mce-token");
  const count = "<b>Click</b> here".length;
  await expect(token.locator(".mce-effect-glyph")).toHaveCount(count);
  const paint = (elements: Element[]) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        text: element.textContent,
        color: style.color,
        bold: style.fontWeight,
        italic:
          element.classList.contains("mcp-pixel-italic") ||
          style.fontStyle === "italic",
        underlined: element.hasAttribute("data-underlined"),
        width: element.getBoundingClientRect().width,
      };
    });
  const editor = await token.locator(".mce-effect-glyph").evaluateAll(paint);
  const viewer = (
    await page.locator("#preview .mcp-motd .mcp-glyph").evaluateAll(paint)
  ).slice(0, count);
  expect(editor).toEqual(viewer);
  expect(editor[0]).toMatchObject({
    color: "rgb(255, 85, 85)",
    bold: "700",
    italic: false,
  });
  expect(editor.at(-1)).toMatchObject({
    color: "rgb(255, 170, 0)",
    bold: "400",
    italic: true,
    underlined: true,
  });
  await expect(token).toHaveAttribute("contenteditable", "false");
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

test("custom-font hover fields display protected styles without a MOTD layout or pixel renderer", async ({
  page,
}) => {
  await page.evaluate((component) => {
    window.doc.hover = {
      mode: "custom",
      text: window.api.parseText(JSON.stringify(component), "json").value,
    };
    window.context = {
      ...window.context,
      assetProvider: () => ({ fontFamily: "monospace" }),
    };
    window.setEditorOptions({ document: window.doc, context: window.context });
  }, protectedComponent);
  await openEntryTool(page, "Player hover");
  const token = page.locator("[data-editor-field=hover] .mce-token");
  await expect(token.locator(".mce-effect-glyph")).toHaveCount(
    "<b>Click</b> here".length,
  );
  await expect(token.locator(".mce-effect-glyph").first()).toHaveCSS(
    "color",
    "rgb(255, 85, 85)",
  );
  await expect(token.locator(".mce-effect-glyph").first()).toHaveCSS(
    "font-weight",
    "700",
  );
  await expect(token.locator(".mce-effect-glyph").last()).toHaveCSS(
    "font-style",
    "italic",
  );
  await expect(token.locator(".mcp-pixel-glyph")).toHaveCount(0);
  await expect(token.locator("a, b, img, script")).toHaveCount(0);
});
