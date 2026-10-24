import { expect, type Page, type Locator } from "@playwright/test";
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
