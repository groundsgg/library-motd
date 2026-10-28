import type { Page } from "@playwright/test";
import { expect, test } from "./selection-diagnostics.js";
import { PNG } from "pngjs";
import { placeCaretAtTextEnd } from "./editor-actions.js";

const field = (page: Page) =>
  page.getByRole("textbox", { name: "MOTD inline editor", exact: true });
async function setup(page: Page, source: string, modern = false) {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
  await page.evaluate(
    ({ source, modern }) => {
      window.context = {
        ...window.context,
        background: "none",
        animations: false,
        ...(modern ? { profile: window.api.java263Profile } : {}),
      };
      window.setEditorOptions({ context: window.context });
      window.editor.execute({ type: "replace-source", source });
      window.changes = [];
    },
    { source, modern },
  );
  await page.evaluate(() => document.fonts.ready);
}
const sourceText = (page: Page) =>
  page.evaluate(() =>
    window.api
      .flattenText(window.doc.motd.text)
      .map((g) => g.text)
      .join(""),
  );
async function paste(page: Page, value: string) {
  await page.evaluate((value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    document.activeElement?.dispatchEvent(event);
  }, value);
}

test("browser spellcheck stays disabled after editor option updates", async ({
  page,
}) => {
  await setup(page, "Grounndsgg");
  expect(
    await field(page).evaluate((el) => (el as HTMLElement).spellcheck),
  ).toBe(false);
  await page.evaluate(() => window.setEditorOptions({ toolbar: "selection" }));
  expect(
    await field(page).evaluate((el) => (el as HTMLElement).spellcheck),
  ).toBe(false);
});

test("focusing text adds no underline decoration to the rendered MOTD", async ({
  page,
}) => {
  await setup(page, "<gold><u>Alpha<newline>Beta</u>");
  const box = page.locator("#editor .mcp-motd");
  const before = PNG.sync.read(await box.screenshot({ caret: "hide" }));
  await placeCaretAtTextEnd(field(page));
  const after = PNG.sync.read(await box.screenshot({ caret: "hide" }));
  expect(after.data.equals(before.data)).toBe(true);
});

for (const zoom of [1, 0.9])
  test(`a host image reset cannot move the caret after the second-line placeholder to a third row at zoom ${zoom}`, async ({
    page,
  }) => {
    await setup(page, "First<newline>{{end}}", true);
    await page.evaluate((zoom) => {
      document.body.style.zoom = String(zoom);
      window.context = { ...window.context, values: { end: "Second" } };
      window.setEditorOptions({ context: window.context });
      window.changes = [];
    }, zoom);
    // Common responsive image resets must not turn the editor's invisible
    // cursor separator into a block or a full-width image.
    await page.addStyleTag({
      content:
        "img { display:block!important; width:100%; max-width:100%; height:auto; border:2px solid red; margin:4px; }",
    });
    const input = field(page);
    await input.scrollIntoViewIfNeeded();
    const paragraphs = input.locator("p");
    await expect(paragraphs).toHaveCount(2);
    for (const p of await paragraphs.all())
      expect((await p.boundingBox())!.height).toBeCloseTo(18 * zoom, 1);
    const before = await sourceText(page);
    const token = await paragraphs.last().locator(".mce-token").boundingBox();
    await page.mouse.click(
      token!.x + token!.width + 8,
      token!.y + token!.height / 2,
    );
    await expect(input).toBeFocused();
    expect(await sourceText(page)).toBe(before);
    expect(await page.evaluate(() => window.changes.length)).toBe(0);
    const rootBox = (await input.boundingBox())!;
    const breakBox = (await paragraphs
      .last()
      .locator(".ProseMirror-trailingBreak")
      .boundingBox())!;
    expect(Math.abs(breakBox.y - rootBox.y - 18 * zoom)).toBeLessThan(0.25);
    await page.keyboard.type("!");
    await expect(input).toHaveText("FirstSecond!");
    expect(await sourceText(page)).toBe("First\n{{end}}!");
    await input.evaluate(
      (root) =>
        new Promise<void>((resolve) => {
          root.ownerDocument.defaultView!.requestAnimationFrame(() =>
            resolve(),
          );
        }),
    );
    const caretLine = await input.evaluate((root) => {
      const selection = root.ownerDocument.getSelection()!;
      const prefix = root.ownerDocument.createRange();
      prefix.selectNodeContents(root);
      prefix.setEnd(selection.anchorNode!, selection.anchorOffset);
      // Firefox/WebKit may report an empty rectangle for a collapsed element
      // boundary. Measure the preceding typed character on that caret line.
      const walker = root.ownerDocument.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
      );
      let last: Node | null = null,
        node: Node | null;
      while ((node = walker.nextNode())) last = node;
      const range = root.ownerDocument.createRange();
      range.setStart(last!, last!.textContent!.length - 1);
      range.setEnd(last!, last!.textContent!.length);
      const rect = range.getBoundingClientRect();
      return {
        prefix: prefix.cloneContents().textContent,
        y: rect.y - root.getBoundingClientRect().y,
      };
    });
    expect(caretLine.prefix).toBe("FirstSecond!");
    // Font ascenders round differently across engines under fractional zoom.
    expect(Math.abs(caretLine.y - 18 * zoom)).toBeLessThan(1.1);
    await expect(paragraphs).toHaveCount(2);
  });

for (const [label, source, extra, modern] of [
  ["regular", "M".repeat(90), "M", false],
  ["bold", "<b>" + "M".repeat(76), "M", false],
  ["narrow glyphs", "i".repeat(270), "i", false],
  ["modern profile", "M".repeat(88), "M", true],
] as const)
  test(`typing cannot create a third visual line with ${label}`, async ({
    page,
  }) => {
    await setup(page, source, modern);
    const before = await sourceText(page);
    await field(page).focus();
    await field(page).press("Control+End");
    await page.keyboard.type(extra);
    expect(await sourceText(page)).toBe(before);
    await expect(field(page)).toHaveText(before);
    expect(await page.evaluate(() => window.changes.length)).toBe(0);
    expect(
      await page.locator("#editor .mcp-motd").evaluate((el) => el.scrollTop),
    ).toBe(0);
  });

test("a rejected overflow adds no undo step and leaves the selection usable", async ({
  page,
}) => {
  await setup(page, "M".repeat(89));
  await field(page).focus();
  await field(page).press("Control+End");
  await page.keyboard.type("M");
  await expect(field(page)).toHaveText("M".repeat(90));
  await page.keyboard.type("M");
  expect(await sourceText(page)).toBe("M".repeat(90));
  await field(page).press("Control+z");
  expect(await sourceText(page)).toBe("M".repeat(89));
  await field(page).press("Control+End");
  await page.keyboard.type("i");
  expect(await sourceText(page)).toBe("M".repeat(89) + "i");
});

for (const explicit of [false, true])
  test(`paste respects ${explicit ? "explicit" : "soft"} two-line boundaries`, async ({
    page,
  }) => {
    const source = explicit ? "First<newline>Second" : "M".repeat(90);
    await setup(page, source);
    const before = await sourceText(page);
    await field(page).focus();
    await field(page).press("Control+End");
    await paste(page, explicit ? "\nThird" : "MMMM");
    expect(await sourceText(page)).toBe(before);
    expect(await page.evaluate(() => window.changes.length)).toBe(0);
  });

test("formatting cannot push selected text into a third line", async ({
  page,
}) => {
  await setup(page, "M".repeat(90));
  await field(page).focus();
  await field(page).press("Control+A");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.api.flattenText(window.doc.motd.text).some((g) => g.style.bold),
    ),
  ).toBe(false);
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
  await page.getByRole("button", { name: "Underline", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.api
        .flattenText(window.doc.motd.text)
        .every((g) => g.style.underlined),
    ),
  ).toBe(true);
});

test("resolved placeholder width counts toward the input limit without splitting its source token", async ({
  page,
}) => {
  await setup(page, "<gold>{{long}}");
  await page.evaluate(() => {
    window.context = { ...window.context, values: { long: "M".repeat(89) } };
    window.setEditorOptions({ context: window.context });
    window.changes = [];
  });
  await field(page).focus();
  await field(page).press("Control+End");
  await page.keyboard.type("M");
  await page.keyboard.type("M");
  const source = await page.evaluate(
    () =>
      window.api.serializeText(window.doc.motd.text, { format: "minimessage" })
        .value,
  );
  expect(source).toContain("{{long}}");
  await expect(page.locator("#editor .mce-token")).toHaveCount(1);
  await expect(field(page)).toHaveText("M".repeat(90));
});

test("imported overflow stays intact and cannot scroll the visible rows or grow invisibly", async ({
  page,
}) => {
  await setup(page, "<gold>" + "M".repeat(120));
  const box = page.locator("#editor .mcp-motd");
  const before = PNG.sync.read(await box.screenshot({ caret: "hide" }));
  await placeCaretAtTextEnd(field(page));
  await field(page).press("Control+End");
  expect(await box.evaluate((el) => el.scrollTop)).toBe(0);
  const after = PNG.sync.read(await box.screenshot({ caret: "hide" }));
  expect(after.data.equals(before.data)).toBe(true);
  expect(await sourceText(page)).toBe("M".repeat(120));
  await page.keyboard.type("M");
  expect(await sourceText(page)).toBe("M".repeat(120));
  // Rejected native DOM input is redrawn asynchronously by ProseMirror. Wait
  // for that observable redraw before testing the next recovery action.
  await expect(field(page)).toHaveText("M".repeat(120));
  await expect(field(page)).toBeFocused();
  await field(page).press("Backspace");
  await expect.poll(() => sourceText(page)).toBe("M".repeat(119));
});

test("the controlled React editor enforces the same soft-wrap boundary", async ({
  page,
}) => {
  await page.goto("/examples/react/");
  await page
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Server entry tools", exact: true })
    .getByRole("button", { name: "Source", exact: true })
    .click();
  const source = page.getByRole("dialog", {
    name: "Source editor",
    exact: true,
  });
  await source.getByLabel("MOTD source", { exact: true }).fill("M".repeat(88));
  await source.getByRole("button", { name: "Apply", exact: true }).click();
  const input = page.locator("[data-editor-field=motd] .ProseMirror");
  await input.focus();
  await input.press("Control+End");
  await page.keyboard.type("M");
  await expect(input).toHaveText("M".repeat(88));
});

test("moving to a far imported caret cannot scroll the client canvas", async ({
  page,
}) => {
  await setup(page, "M".repeat(1200));
  await page.evaluate(() => {
    window.context = { ...window.context, background: "auto" };
    window.setEditorOptions({ context: window.context });
  });
  await placeCaretAtTextEnd(field(page));
  await field(page).press("Control+End");
  const scrolling = await page.evaluate(() =>
    [".mcp-motd", ".mcp-row", ".mcp-scene", ".mcp-stage"].map((selector) => {
      const el = document.querySelector<HTMLElement>("#editor " + selector)!;
      return [el.scrollTop, el.scrollLeft];
    }),
  );
  expect(scrolling).toEqual([
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  expect(await sourceText(page)).toBe("M".repeat(1200));
});

test("an imported cluster and placeholder remain intact until explicitly cleared", async ({
  page,
}) => {
  const original = "M".repeat(120) + "e\u0301{{players}}";
  await setup(page, original);
  expect(await sourceText(page)).toBe(original);
  await field(page).focus();
  await field(page).press("Control+End");
  await page.keyboard.type("M");
  expect(await sourceText(page)).toBe(original);
  await field(page).press("Control+A");
  await field(page).press("Backspace");
  await expect.poll(() => sourceText(page)).toBe("");
});

test("a visually shorter replacement can recover imported placeholder overflow", async ({
  page,
}) => {
  await setup(page, "M".repeat(120) + "{{long}}");
  await page.evaluate(() => {
    window.context = { ...window.context, values: { long: "M".repeat(1000) } };
    window.setEditorOptions({ context: window.context });
    window.changes = [];
  });
  await placeCaretAtTextEnd(field(page));
  await field(page).press("Control+End");
  await field(page).press("Shift+ArrowLeft");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getSelection()?.getRangeAt(0).cloneContents().textContent,
      ),
    )
    .toBe("M".repeat(1000));
  await paste(page, "MM");
  await expect.poll(() => sourceText(page)).toBe("M".repeat(122));
  expect(await page.evaluate(() => window.changes.length)).toBe(1);
  await field(page).press("Control+End");
  await page.keyboard.type("M");
  expect(await sourceText(page)).toBe("M".repeat(122));
});

test("native composition at the visual boundary cannot commit hidden overflow", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Native composition uses Chromium CDP; other engines have lifecycle coverage.",
  );
  await setup(page, "M".repeat(90));
  await field(page).focus();
  await field(page).press("Control+End");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", {
    text: "に",
    selectionStart: 1,
    selectionEnd: 1,
  });
  await cdp.send("Input.insertText", { text: "に" });
  await expect(field(page)).toHaveText("M".repeat(90));
  expect(await sourceText(page)).toBe("M".repeat(90));
  await cdp.detach();
});
