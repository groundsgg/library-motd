import { expect, test, type Locator, type Page } from "@playwright/test";
import { PNG } from "pngjs";

const inputFor = (page: Page) =>
  page.getByRole("textbox", { name: "MOTD inline editor", exact: true });
const imageOf = async (input: Locator) =>
  PNG.sync.read(await input.screenshot({ caret: "hide" }));
const countColor = (image: PNG, color: number[]) => {
  let count = 0;
  for (let i = 0; i < image.data.length; i += 4)
    if (color.every((value, channel) => image.data[i + channel] === value))
      count++;
  return count;
};

async function setup(
  page: Page,
  {
    customFont = false,
    source = "<gold>Ab <b>Bd</b> <i>It</i> <u>Un</u> <st>St</st> {{region}}</gold>",
  } = {},
) {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(
    ({ customFont, source }) => {
      window.context = {
        ...window.context,
        animations: false,
        background: "none",
        values: { region: "A" },
        ...(customFont
          ? { assetProvider: () => ({ fontFamily: "monospace" }) }
          : {}),
      };
      window.setEditorOptions({ context: window.context });
      window.editor.execute({
        type: "replace-source",
        source,
      });
    },
    { customFont, source },
  );
  await page.evaluate(() => document.fonts.ready);
  return inputFor(page);
}

async function selectAll(input: Locator) {
  const expected = await input.textContent();
  await input.focus();
  await input.evaluate((root) => {
    const range = root.ownerDocument.createRange();
    // End after the final atom, rather than inside its non-editable text node.
    range.selectNodeContents(root);
    const selection = root.ownerDocument.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    root.ownerDocument.dispatchEvent(new Event("selectionchange"));
  });
  await expect
    .poll(() =>
      input.evaluate(
        (root) =>
          root.ownerDocument.getSelection()?.getRangeAt(0).cloneContents()
            .textContent,
      ),
    )
    .toBe(expected);
}

// Remove only the highlight background so the before/after image measures ink.
// A contrasting native selection color makes a duplicate browser silhouette visible.
const inkOnlySelection =
  "#editor .ProseMirror::selection { background-color: transparent; color: white; } " +
  "#editor .ProseMirror *::selection { background-color: transparent; }";

for (const dpr of [1, 2])
  test.describe(`DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    test("selection keeps one pixel foreground and shadow for styled text and tokens", async ({
      page,
    }) => {
      const input = await setup(page);
      await page.addStyleTag({ content: inkOnlySelection });
      const original = await page.evaluate(() =>
        JSON.stringify(window.editor.getDocument()),
      );
      // Include ink extending outside the text line's own box (e.g. underline/shadow).
      const motd = page.locator("#editor .mcp-motd");
      const before = await imageOf(motd);
      expect(countColor(before, [255, 170, 0])).toBeGreaterThan(0);
      await selectAll(input);
      const selected = await imageOf(motd);
      expect(selected.data.equals(before.data)).toBe(true);
      expect(
        await page.evaluate(() => JSON.stringify(window.editor.getDocument())),
      ).toBe(original);
    });
  });

test("native selection highlighting remains visible over pixel text", async ({
  page,
}) => {
  const input = await setup(page);
  const before = await imageOf(input);
  await selectAll(input);
  const selected = await imageOf(input);
  expect(selected.data.equals(before.data)).toBe(false);
  expect(
    await input.evaluate(
      () => document.getSelection()?.getRangeAt(0).cloneContents().textContent,
    ),
  ).toBe("Ab Bd It Un St A");
});

test("custom fonts retain their visible native selection foreground", async ({
  page,
}) => {
  const input = await setup(page, {
    customFont: true,
    source: "<gold>Visible</gold>",
  });
  await page.addStyleTag({ content: inkOnlySelection });
  expect(countColor(await imageOf(input), [255, 170, 0])).toBeGreaterThan(0);
  await selectAll(input);
  const selected = await imageOf(input);
  expect(
    countColor(selected, [255, 170, 0]) + countColor(selected, [255, 255, 255]),
  ).toBeGreaterThan(0);
});

test("live preedit retains its visible native selection foreground", async ({
  page,
}) => {
  const input = await setup(page, { source: "<gold>Visible</gold>" });
  await page.addStyleTag({ content: inkOnlySelection });
  await input.focus();
  await input.dispatchEvent("compositionstart");
  expect(countColor(await imageOf(input), [255, 170, 0])).toBeGreaterThan(0);
  await selectAll(input);
  const selected = await imageOf(input);
  expect(
    countColor(selected, [255, 170, 0]) + countColor(selected, [255, 255, 255]),
  ).toBeGreaterThan(0);
  await input.dispatchEvent("compositionend");
});
