import { expect, type Page, type Locator } from "@playwright/test";

/** Select rendered UTF-16 offsets across actual text nodes, including glyph wrappers. */
export async function selectRenderedText(
  input: Locator,
  from: number,
  to: number,
): Promise<void> {
  const expected = (await input.textContent())!.slice(from, to);
  await input.focus();
  await input.evaluate(
    (root, { from, to }) => {
      const doc = root.ownerDocument;
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const range = doc.createRange();
      let node: Node | null,
        offset = 0,
        started = false,
        ended = false;
      while ((node = walker.nextNode())) {
        const length = node.textContent!.length;
        if (!started && from <= offset + length) {
          range.setStart(node, from - offset);
          started = true;
        }
        if (started && to <= offset + length) {
          range.setEnd(node, to - offset);
          ended = true;
          break;
        }
        offset += length;
      }
      if (!started || !ended)
        throw new Error("Rendered selection offsets outside field text");
      const selection = doc.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      doc.dispatchEvent(new Event("selectionchange"));
      root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    },
    { from, to },
  );
  await expect
    .poll(() =>
      input.evaluate((root) => root.ownerDocument.getSelection()?.toString()),
    )
    .toBe(expected);
}
/** Set a source-text caret independently of platform shortcut/selection timing. */
export async function placeCaretAtTextEnd(input: Locator): Promise<void> {
  const text = await input.textContent();
  await input.focus();
  await input.evaluate((root) => {
    const doc = root.ownerDocument;
    const paragraph = root.lastElementChild ?? root;
    const walker = doc.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    let node: Node | null, last: Node | undefined;
    while ((node = walker.nextNode())) last = node;
    const range = doc.createRange();
    const atom = last?.parentElement?.closest("[contenteditable=false]");
    if (atom) range.setStartAfter(atom);
    else if (last) range.setStart(last, last.textContent!.length);
    else range.setStart(paragraph, 0);
    range.collapse(true);
    const selection = doc.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    doc.dispatchEvent(new Event("selectionchange"));
  });
  await expect
    .poll(() =>
      input.evaluate((root) => {
        const selection = root.ownerDocument.getSelection()!;
        const range = root.ownerDocument.createRange();
        range.selectNodeContents(root);
        range.setEnd(selection.anchorNode!, selection.anchorOffset);
        return range.cloneContents().textContent;
      }),
    )
    .toBe(text);
  await input.evaluate(
    (root) =>
      new Promise<void>((resolve) =>
        root.ownerDocument.defaultView!.requestAnimationFrame(() => resolve()),
      ),
  );
}
export async function openEntryTool(page: Page, name: string) {
  await page.keyboard.press("Escape");
  await page
    .locator("#editor")
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Server entry tools", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
}
