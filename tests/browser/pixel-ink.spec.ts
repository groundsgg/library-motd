import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { placeCaretAtTextEnd } from "./editor-actions.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
});
const mask = (image: PNG, color: number[]) =>
  Array.from({ length: image.width * image.height }, (_, i) =>
    color.every((v, c) => image.data[i * 4 + c] === v) ? 1 : 0,
  );

for (const dpr of [1, 2])
  test.describe(`DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    for (const scale of [1, 2, 3])
      test(`normal, bold, italic and decorated ink agree at GUI ${scale}`, async ({
        page,
      }) => {
        await page.evaluate((scale) => {
          window.context = {
            ...window.context,
            profile: window.api.java263Profile,
            guiScale: scale,
            animations: false,
            values: { region: "AB" },
          };
          window.setEditorOptions({ context: window.context });
          window.editor.execute({
            type: "replace-source",
            source:
              "<gold>A<i>A</i><b>A</b><i><b>A</b></i><u>A</u><st>A</st></gold><newline><gradient:#ff0000:#0000ff>A<b>A</b></gradient>{{region}}",
          });
          window.preview.update({
            document: window.doc,
            context: window.context,
          });
        }, scale);
        const original = await page.evaluate(() => JSON.stringify(window.doc));
        await expect(
          page.locator("#preview .mcp-motd .mcp-pixel-glyph"),
        ).toHaveCount(10);
        await expect(
          page.locator("#editor [data-editor-field=motd] .mcp-pixel-glyph"),
        ).toHaveCount(10);
        await expect(
          page.locator("#preview .mcp-motd .mcp-pixel-italic"),
        ).toHaveCount(2);
        const images = [];
        for (const host of ["preview", "editor"])
          images.push(
            PNG.sync.read(await page.locator(`#${host} .mcp-row`).screenshot()),
          );
        for (const color of [
          [255, 170, 0],
          [63, 42, 0],
          [255, 0, 0],
          [0, 0, 255],
        ]) {
          expect(
            mask(images[0]!, color).some(Boolean),
            `visible ${color}`,
          ).toBe(true);
          expect(mask(images[1]!, color)).toEqual(mask(images[0]!, color));
        }
        expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(
          original,
        );
      });
  });

test("custom fonts retain visible normal text without pixel masks", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.context = {
      ...window.context,
      assetProvider: () => ({ fontFamily: "monospace" }),
    };
    window.setEditorOptions({ context: window.context });
    window.editor.execute({
      type: "replace-source",
      source: "Normal <b>bold</b>",
    });
    window.preview.update({ document: window.doc, context: window.context });
  });
  await expect(page.locator("#editor [data-editor-field=motd]")).toHaveText(
    "Normal bold",
  );
  await expect(page.locator("#preview .mcp-pixel-glyph")).toHaveCount(0);
  await expect(page.locator("#editor .mcp-pixel-glyph")).toHaveCount(0);
});

test("normal obfuscation resumes pixel paint after an unsupported random glyph", async ({
  page,
}) => {
  await page.clock.install();
  await page.evaluate(() => {
    window.context = {
      ...window.context,
      profile: {
        ...window.context.profile,
        font: {
          ...window.context.profile.font,
          advances: { A: 6, B: 6, "\uffff": 6 },
        },
      },
      animations: true,
    };
    window.setEditorOptions({ context: window.context });
    window.editor.execute({
      type: "replace-source",
      source: "<gold><b><obfuscated>A</obfuscated></b></gold>",
    });
    window.preview.update({ document: window.doc, context: window.context });
    Math.random = () => 0.99;
  });
  const original = await page.evaluate(() => JSON.stringify(window.doc));
  const glyph = page.locator("#preview .mcp-motd [data-obfuscated]");
  await page.clock.fastForward(80);
  await expect(glyph).toHaveText("\uffff");
  await expect(glyph).not.toHaveClass(/mcp-pixel-glyph/);
  await page.evaluate(() => {
    Math.random = () => 0.4;
  });
  await page.clock.fastForward(80);
  await expect(glyph).toHaveText("B");
  await expect(glyph).toHaveClass(/mcp-pixel-glyph/);
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(original);
});

test("native composition shows changing preedit text and restores pixel paint after commit", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP composition visibility probe");
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<gold>Ab</gold>",
    }),
  );
  const input = page.locator('#editor [data-editor-field="motd"] .ProseMirror');
  await placeCaretAtTextEnd(input);
  const original = await input.elementHandle();
  const cdp = await page.context().newCDPSession(page);
  for (const text of ["に", "日本"]) {
    await cdp.send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
    await expect(input).toContainText(text);
    const fill = await input.evaluate((root, text) => {
      const walker = root.ownerDocument.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
      );
      let node: Node | null;
      while ((node = walker.nextNode()))
        if (node.textContent?.includes(text))
          return getComputedStyle(node.parentElement!).webkitTextFillColor;
      return "missing";
    }, text);
    expect(fill).not.toBe("rgba(0, 0, 0, 0)");
    expect(fill).not.toBe("missing");
    expect(await original!.evaluate((e) => e.isConnected)).toBe(true);
  }
  await cdp.send("Input.insertText", { text: "日本" });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.api
          .flattenText(window.doc.motd.text)
          .map((c) => c.text)
          .join(""),
      ),
    )
    .toBe("Ab日本");
  await expect(input.locator(".mcp-pixel-glyph")).toHaveCount(2);
  await input.press("Control+z");
  await expect(input).toHaveText("Ab");
});

test("enabled and disabled menu labels retain quarter-brightness shadows", async ({
  page,
}) => {
  for (const selected of [false, true]) {
    await page.evaluate(
      (selected) =>
        window.preview.update({
          document: window.doc,
          context: { ...window.context, selected },
        }),
      selected,
    );
    const button = page.locator("#preview .mcp-menu-button").first();
    await button.evaluate((e) => {
      e.style.background = "#111111";
      e.style.border = "0";
      e.style.boxShadow = "none";
    });
    const image = PNG.sync.read(
      await button.locator(".mcp-button-label").screenshot(),
    );
    expect(
      mask(image, selected ? [63, 63, 63] : [40, 40, 40]).some(Boolean),
    ).toBe(true);
  }
});

test("deferred context changes restore pixel paint when composition ends", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<gold>Ab</gold>",
    }),
  );
  const input = page.locator('#editor [data-editor-field="motd"] .ProseMirror');
  await input.focus();
  const original = await input.elementHandle();
  await input.evaluate((root) =>
    root.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    ),
  );
  await page.evaluate(() =>
    window.setEditorOptions({
      context: { ...window.context, profile: window.api.java263Profile },
    }),
  );
  await input.evaluate((root) =>
    root.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true }),
    ),
  );
  await expect(input).not.toHaveAttribute("data-pixel-composing");
  expect(await original!.evaluate((e) => e.isConnected)).toBe(true);
  await expect(input.locator(".mcp-pixel-glyph")).toHaveCount(2);
});
