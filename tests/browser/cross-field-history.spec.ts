import { expect, test } from "@playwright/test";
import { openEntryTool } from "./editor-actions.js";
test("rapid typing in MOTD, version and hover has independent undo groups", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() => {
    const text = (value) => window.api.parseText(value, "minimessage").value;
    const document = window.api.createDocument(text("M"));
    document.version = { mode: "always", text: text("V") };
    document.hover = { mode: "custom", text: text("H") };
    window.doc = document;
    window.setEditorOptions({ document });
  });
  await openEntryTool(page, "Player hover");
  for (const [name, prefix] of [
    ["MOTD inline editor", "X"],
    ["Version inline editor", "Y"],
    ["Hover inline editor", "Z"],
  ]) {
    const field = page.getByRole("textbox", { name, exact: true });
    await field.focus();
    await field.press("Control+Home");
    await page.keyboard.type(prefix);
  }
  const values = () =>
    page.evaluate(() => {
      const plain = (text) =>
        window.api
          .flattenText(text)
          .map((g) => g.text)
          .join("");
      return [
        plain(window.doc.motd.text),
        plain(window.doc.version.text),
        plain(window.doc.hover.text),
      ];
    });
  expect(await values()).toEqual(["XM", "YV", "ZH"]);
  for (const expected of [
    ["XM", "YV", "H"],
    ["XM", "V", "H"],
    ["M", "V", "H"],
  ]) {
    await page
      .locator("#editor")
      .getByRole("button", { name: "Undo", exact: true })
      .click();
    expect(await values()).toEqual(expected);
  }
  for (const expected of [
    ["XM", "V", "H"],
    ["XM", "YV", "H"],
    ["XM", "YV", "ZH"],
  ]) {
    await page
      .locator("#editor")
      .getByRole("button", { name: "Redo", exact: true })
      .click();
    expect(await values()).toEqual(expected);
  }
});
