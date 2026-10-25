import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./selection-diagnostics.js";
import { placeCaretAtTextEnd, selectRenderedText } from "./editor-actions.js";
async function expectPixelRendering(input: Locator, letter = "B") {
  const glyph = input
    .locator(".mcp-pixel-glyph")
    .filter({ hasText: new RegExp(`^${letter}$`) })
    .first();
  await expect(glyph).toHaveCSS("-webkit-text-fill-color", "rgba(0, 0, 0, 0)");
  await expect
    .poll(() =>
      glyph.evaluate((el) => getComputedStyle(el, "::before").content),
    )
    .not.toBe("none");
}
async function beginComposition(page: Page) {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() =>
    window.editor.execute({ type: "replace-source", source: "Before" }),
  );
  const input = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await selectRenderedText(input, 0, 0);
  await input.press("Control+Home");
  const session = await page.context().newCDPSession(page);
  await session.send("Input.imeSetComposition", {
    text: "に",
    selectionStart: 1,
    selectionEnd: 1,
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.api
          .flattenText(window.editor.getDocument().motd.text)
          .map((g) => g.text)
          .join(""),
      ),
    )
    .toBe("にBefore");
  return { input, session };
}
test("native composition cannot overwrite a replacement document", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Chromium CDP composition coverage; other engines have lifecycle coverage.",
  );
  const { input, session } = await beginComposition(page);
  const replacement = await page.evaluate(() => {
    window.doc = window.api.createDocument(
      window.api.parseText("EXTERNAL DOCUMENT", "minimessage").value,
    );
    window.setEditorOptions({ document: window.doc });
    window.changes = [];
    return JSON.stringify(window.editor.getDocument());
  });
  await session.send("Input.imeSetComposition", {
    text: "にほん",
    selectionStart: 3,
    selectionEnd: 3,
  });
  expect(
    await page.evaluate(() => JSON.stringify(window.editor.getDocument())),
  ).toBe(replacement);
  await session.send("Input.insertText", { text: "にほん" });
  await expect(input).toHaveText("EXTERNAL DOCUMENT");
  await expectPixelRendering(input, "E");
  expect(
    await page.evaluate(() => JSON.stringify(window.editor.getDocument())),
  ).toBe(replacement);
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
for (const patch of [
  { readOnly: true },
  { disabled: true },
  { features: { motd: false } },
])
  test(`revoked composition is discarded after ${JSON.stringify(patch)}`, async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Chromium CDP composition coverage; other engines have lifecycle coverage.",
    );
    const { input, session } = await beginComposition(page);
    await page.evaluate((patch) => {
      window.setEditorOptions(patch);
      window.changes = [];
    }, patch);
    await session.send("Input.imeSetComposition", {
      text: "にほん",
      selectionStart: 3,
      selectionEnd: 3,
    });
    await session.send("Input.insertText", { text: "にほん" });
    expect(
      await page.evaluate(() =>
        window.api
          .flattenText(window.editor.getDocument().motd.text)
          .map((g) => g.text)
          .join(""),
      ),
    ).toBe("にBefore");
    expect(await page.evaluate(() => window.changes.length)).toBe(0);
    await page.evaluate(() =>
      window.setEditorOptions({
        readOnly: false,
        disabled: false,
        features: { motd: true },
      }),
    );
    await expect(input).toHaveText("にBefore");
    await expectPixelRendering(input);
    await placeCaretAtTextEnd(input);
    await input.press("Control+End");
    await page.keyboard.type("X");
    await expect(input).toHaveText("にBeforeX");
    expect(
      await page.evaluate(() =>
        window.api
          .flattenText(window.doc.motd.text)
          .map((g) => g.text)
          .join(""),
      ),
    ).toBe("にBeforeX");
  });

test("restoring access before composition ends does not resurrect rejected input", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Chromium CDP composition coverage; other engines have lifecycle coverage.",
  );
  const { input, session } = await beginComposition(page);
  await page.evaluate(() => {
    window.setEditorOptions({ readOnly: true });
    window.setEditorOptions({ readOnly: false });
    window.changes = [];
  });
  await session.send("Input.imeSetComposition", {
    text: "にほん",
    selectionStart: 3,
    selectionEnd: 3,
  });
  await session.send("Input.insertText", { text: "にほん" });
  await expect(input).toHaveText("にBefore");
  await expectPixelRendering(input);
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});

test("a newer preedit keeps live text until its own composition ends", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() =>
    window.editor.execute({ type: "replace-source", source: "Before" }),
  );
  const input = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await selectRenderedText(input, 0, 0);
  const before = await page.evaluate(() =>
    JSON.stringify(window.editor.getDocument()),
  );
  await input.dispatchEvent("compositionstart");
  const glyph = input
    .locator(".mcp-pixel-glyph")
    .filter({ hasText: /^B$/ })
    .first();
  await expect
    .poll(() =>
      glyph.evaluate((el) => getComputedStyle(el, "::before").content),
    )
    .toBe("none");
  await input.evaluate((root) => {
    root.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true }),
    );
    root.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
  });
  await expect
    .poll(() =>
      glyph.evaluate((el) => getComputedStyle(el, "::before").content),
    )
    .toBe("none");
  await input.dispatchEvent("compositionend");
  await expectPixelRendering(input);
  expect(
    await page.evaluate(() => JSON.stringify(window.editor.getDocument())),
  ).toBe(before);
});
