import { expect, test } from "./selection-diagnostics.js";
import { PNG } from "pngjs";
import {
  openEntryTool,
  placeCaretAtTextEnd,
  selectRenderedText,
} from "./editor-actions.js";

function mask(image: PNG, color: number[]) {
  return Array.from({ length: image.width * image.height }, (_, i) =>
    color.every((channel, c) => image.data[i * 4 + c] === channel) ? 1 : 0,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
});

for (const dpr of [1, 2])
  test.describe(`DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    for (const scale of [1, 2, 3])
      test(`italic combinations share ink, shadows and advances at GUI scale ${scale}`, async ({
        page,
      }) => {
        await page.evaluate((scale) => {
          window.context = {
            ...window.context,
            profile: window.api.java263Profile,
            guiScale: scale,
            animations: false,
          };
          window.setEditorOptions({ context: window.context });
          window.editor.execute({
            type: "replace-source",
            source:
              "<gold><i>Ab</i></gold><green><b><i>MW</i></b></green><aqua><i><u><st>42</st></u></i></aqua><newline><i><gradient:#ff0000:#0000ff>Ab</gradient><rainbow>MW</rainbow></i>",
          });
          window.preview.update({
            document: window.doc,
            context: window.context,
          });
        }, scale);
        await page.evaluate(() => document.fonts.ready);
        const preview = PNG.sync.read(
          await page.locator("#preview .mcp-row").screenshot(),
        );
        const editor = PNG.sync.read(
          await page.locator("#editor .mcp-row").screenshot(),
        );
        for (const color of [
          [255, 170, 0],
          [85, 255, 85],
          [85, 255, 255],
          [63, 42, 0],
          [21, 63, 21],
          [21, 63, 63],
          [255, 0, 0],
          [0, 0, 255],
        ]) {
          expect(mask(preview, color).some(Boolean), `visible ${color}`).toBe(
            true,
          );
          expect(mask(editor, color), `matching ${color}`).toEqual(
            mask(preview, color),
          );
        }
        const result = await page
          .locator("#editor [data-editor-field=motd] p")
          .evaluateAll((ps) => ps.map((p) => p.getBoundingClientRect().height));
        expect(result).toEqual([9 * scale, 9 * scale]);
      });
  });

test("italic obfuscation repaints ink while preserving source and advances", async ({
  page,
}) => {
  await page.clock.install();
  await page.evaluate(() => {
    window.context = { ...window.context, animations: true };
    window.setEditorOptions({ context: window.context });
    window.editor.execute({
      type: "replace-source",
      source: "<gold><i><obfuscated>AbM42</obfuscated></i></gold>",
    });
    window.preview.update({ document: window.doc, context: window.context });
  });
  const source = await page.evaluate(() => JSON.stringify(window.doc));
  const frames = [];
  for (let i = 0; i < 4; i++) {
    await page.clock.fastForward(80);
    const image = PNG.sync.read(
      await page.locator("#preview .mcp-motd").screenshot(),
    );
    frames.push(mask(image, [255, 170, 0]).join(""));
  }
  expect(new Set(frames).size).toBeGreaterThan(1);
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(source);
});

test("italic placeholders remain atomic, selectable and undoable", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.editor.execute({
      type: "replace-source",
      source: "<gold><i>A{{players}}B</i></gold>",
    });
  });
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await expect(input.locator(".mce-token")).toHaveCount(1);
  await expect(input).toHaveText("A42B");
  await input.focus();
  await input.locator(".mce-token").evaluate((token) => {
    const range = token.ownerDocument.createRange();
    range.selectNode(token);
    const selection = token.ownerDocument.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    token.ownerDocument.dispatchEvent(new Event("selectionchange"));
  });
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString()))
    .toBe("42");
  await input.press("Backspace");
  await expect(input).toHaveText("AB");
  await input.press("Control+z");
  await expect(input).toHaveText("A42B");
  expect(
    await page.evaluate(
      () =>
        window.api.serializeText(window.doc.motd.text, {
          format: "minimessage",
        }).value,
    ),
  ).toContain("{{players}}");
});

test("custom profile and asset-provider fonts keep their own italic outlines", async ({
  page,
}) => {
  for (const provider of [false, true]) {
    await page.evaluate((provider) => {
      window.context = {
        ...window.context,
        profile: {
          ...window.api.java263Profile,
          font: {
            ...window.api.java263Profile.font,
            family: provider ? "GroundsMinecraft" : "monospace",
          },
        },
        assetProvider: provider
          ? () => ({ fontFamily: "monospace" })
          : undefined,
      };
      window.setEditorOptions({ context: window.context });
      window.editor.execute({ type: "replace-source", source: "<i>AbMW</i>" });
      window.preview.update({ document: window.doc, context: window.context });
    }, provider);
    await expect(page.locator("#preview .mcp-pixel-italic")).toHaveCount(0);
    await expect(page.locator("#editor .mcp-pixel-italic")).toHaveCount(0);
  }
});

test("larger hover tools retain readable italic text", async ({ page }) => {
  await page.evaluate(() => {
    window.doc.hover = {
      mode: "custom",
      text: window.api.parseText("<gold><i>AbMW</i></gold>", "minimessage")
        .value!,
    };
    window.setEditorOptions();
  });
  await openEntryTool(page, "Player hover");
  const input = page.getByRole("textbox", {
    name: "Hover inline editor",
    exact: true,
  });
  await expect(input).toHaveText("AbMW");
  await page.evaluate(() => document.fonts.ready);
  const image = PNG.sync.read(await input.screenshot());
  const fontSize = await input.evaluate((e) =>
    parseFloat(getComputedStyle(e).fontSize),
  );
  expect(fontSize).toBeGreaterThan(9);
  const pixels = Array.from(
    { length: image.width * image.height },
    (_, i) => i,
  ).filter(
    (i) =>
      image.data[i * 4]! > 200 &&
      image.data[i * 4 + 1]! > 130 &&
      image.data[i * 4 + 2]! < 40,
  );
  const xs = pixels.map((i) => i % image.width),
    ys = pixels.map((i) => Math.floor(i / image.width));
  expect(Math.max(...xs) - Math.min(...xs) + 1).toBeGreaterThanOrEqual(
    (20 * fontSize) / 9 - 2,
  );
  expect(Math.max(...ys) - Math.min(...ys) + 1).toBeGreaterThanOrEqual(
    (7 * fontSize) / 9 - 2,
  );
});

test("italic text supports partial selection, clipboard, typing and undo without display markup", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<gold><i>Alpha Beta</i></gold>",
    }),
  );
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await selectRenderedText(input, 0, 0);
  await input.press("Control+Home");
  for (let i = 0; i < 5; i++) {
    await input.press("Shift+ArrowRight");
    await expect
      .poll(() =>
        page.evaluate(() => document.getSelection()?.toString().length),
      )
      .toBe(i + 1);
    await input.evaluate(
      (root) =>
        new Promise<void>((resolve) =>
          root.ownerDocument.defaultView!.requestAnimationFrame(() =>
            resolve(),
          ),
        ),
    );
  }
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString()))
    .toBe("Alpha");
  const copied = await input.evaluate((root) => {
    const data = new DataTransfer();
    const event = new Event("copy", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    root.dispatchEvent(event);
    return {
      plain: data.getData("text/plain"),
      html: data.getData("text/html"),
    };
  });
  expect(copied.plain).toBe("Alpha");
  expect(copied.html).not.toContain("data:image");
  await page.keyboard.type("New");
  await expect(input).toHaveText("New Beta");
  await input.press("Control+z");
  await expect(input).toHaveText("Alpha Beta");
  await page.getByRole("button", { name: "Italic", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.motd.text)
        .slice(0, 5)
        .some((g) => g.style.italic),
    ),
  ).toBe(false);
  await expect(input).toHaveText("Alpha Beta");
});

test("italic display defers updates during composition and refreshes without remounting", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.editor.execute({
      type: "replace-source",
      source: "<gold><i>Ab</i></gold>",
    }),
  );
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await placeCaretAtTextEnd(input);
  const original = await input.elementHandle();
  await input.evaluate((root) =>
    root.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    ),
  );
  await input.evaluate((root) =>
    root.ownerDocument.execCommand("insertText", false, "M"),
  );
  await input.evaluate((root) =>
    root.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "M" }),
    ),
  );
  await expect(input).toHaveText("AbM");
  await expect(input).toBeFocused();
  expect(await original!.evaluate((e) => e.isConnected)).toBe(true);
  await expect.poll(() => input.locator(".mcp-pixel-italic").count()).toBe(3);
  expect(
    await page.evaluate(() =>
      window.api.flattenText(window.doc.motd.text).every((g) => g.style.italic),
    ),
  ).toBe(true);
});
