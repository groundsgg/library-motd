import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

// Compare ink, not DOM span bounds: Windows font metrics can move the baseline
// while absolutely positioned preview spans keep their declared dimensions.
function inkRows(image: PNG, color: number[], from: number, to: number) {
  const rows: number[] = [];
  for (let y = from; y < to; y++) {
    let pixels = 0;
    for (let x = 0; x < image.width; x++) {
      const offset = (y * image.width + x) * 4;
      if (
        color.every((value, channel) => image.data[offset + channel] === value)
      )
        pixels++;
    }
    rows.push(pixels);
  }
  return rows;
}

for (const mixed of [true, false]) {
  test(`bold text keeps its baseline and both MOTD lines (${mixed ? "mixed" : "fully bold"})`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/host.html");
    await page.waitForFunction(
      () => typeof window.editor?.execute === "function",
    );
    await page.evaluate((mixed) => {
      const line = mixed
        ? "<red>Hg</red><green><b>Hg</b></green>"
        : "<green><b>HgHg</b></green>";
      window.editor.execute({
        type: "replace-source",
        source: `${line}<newline>${line}`,
      });
    }, mixed);
    await page.evaluate(() => document.fonts.ready);
    const paragraphs = page.locator("#editor [data-editor-field=motd] p");
    expect(
      await paragraphs.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().height),
      ),
    ).toEqual([18, 18]); // Native 9px lines at GUI scale 2.

    const viewer = PNG.sync.read(
      await page.locator("#preview .mcp-motd").screenshot(),
    );
    const editor = PNG.sync.read(
      await page.locator("#editor .mcp-motd").screenshot(),
    );
    for (const color of mixed
      ? [
          [255, 85, 85],
          [85, 255, 85],
        ]
      : [[85, 255, 85]]) {
      const first = inkRows(viewer, color, 0, 18);
      expect(first.some((pixels) => pixels > 0)).toBe(true);
      expect(inkRows(viewer, color, 18, 36)).toEqual(first);
      expect(inkRows(editor, color, 0, 18)).toEqual(first);
      expect(inkRows(editor, color, 18, 36)).toEqual(first);
    }
    if (mixed) {
      // H and g have identical vertical outlines at both weights.
      const occupied = (color: number[]) =>
        inkRows(viewer, color, 0, 18).map((pixels) => pixels > 0);
      expect(occupied([85, 255, 85])).toEqual(occupied([255, 85, 85]));
    }
  });
}

test("applying bold in React preserves two complete lines and undo", async ({
  page,
}) => {
  await page.goto("/examples/react/");
  const input = page.locator("[data-editor-field=motd] .ProseMirror");
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
  await source.getByLabel("MOTD source", { exact: true }).fill("Hg<newline>Hg");
  await source.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(input.locator("p")).toHaveCount(2);
  await input.focus();
  await input.press("Control+A");
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.getSelection()?.toString().replace(/\n+/g, "\n").trim(),
      ),
    )
    .toBe("Hg\nHg");
  const bold = page.getByRole("button", { name: "Bold", exact: true });
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await expect(input.locator('span[style*="font-weight: 700"]')).toHaveCount(0);
  await bold.click();
  await expect(input.locator('span[style*="font-weight: 700"]')).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await input
      .locator("p")
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().height),
      ),
  ).toEqual([18, 18]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(input).toHaveText("HgHg");
  await expect(input.locator('span[style*="font-weight: 700"]')).toHaveCount(0);
});
