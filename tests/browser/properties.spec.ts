import { expect, test } from "@playwright/test";
test("edits version, counts and hover independently", async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.getByLabel("Version display").selectOption("always");
  await expect(page.locator("#preview .mcp-players")).toContainText(
    "Maintenance",
  );
  await page.getByLabel("Maximum players mode").selectOption("headroom");
  await page.getByLabel("Maximum players value").fill("10");
  await page.getByLabel("Maximum players value").press("Tab");
  expect(
    await page.evaluate(
      () =>
        window.api.evaluateStatus(window.doc, window.context).value.players.max,
    ),
  ).toBe(52);
  await page.getByLabel("Player hover").selectOption("custom");
  await expect(
    page.locator("#editor [data-editor-field=hover] .ProseMirror"),
  ).toBeVisible();
});
test("normalizes an uploaded icon and keeps the draft after a corrupt image", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  const file = page.getByLabel("Server icon", { exact: true });
  // A real browser-generated 96x48 PNG exercises the image pipeline.
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 48;
    const g = c.getContext("2d");
    g.fillStyle = "red";
    g.fillRect(0, 0, 96, 48);
    return c.toDataURL().split(",")[1];
  });
  await file.setInputFiles({
    name: "icon.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.locator("#preview .mcp-icon img")).toBeVisible();
  const size = await page.evaluate(async () => {
    const image = new Image();
    image.src = "data:image/png;base64," + window.doc.icon.pngBase64;
    await image.decode();
    return [image.width, image.height];
  });
  expect(size).toEqual([64, 64]);
  const before = await page.evaluate(() => window.doc.icon.pngBase64);
  await page.getByLabel("Server icon", { exact: true }).setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("broken"),
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Invalid image" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.doc.icon.pngBase64)).toBe(before);
});

test("offers icon upload on hover and keyboard focus only in the editor", async ({
  page,
}) => {
  await page.goto("/examples/react/");
  const upload = page.getByRole("button", {
    name: "Upload server icon",
    exact: true,
  });
  await expect(upload).toHaveCount(1);
  await upload.hover();
  await expect(upload).toHaveCSS("opacity", "1");
  await upload.focus();
  await expect(upload).toHaveCSS("opacity", "1");
  const chooser = page.waitForEvent("filechooser");
  await upload.press("Enter");
  expect((await chooser).isMultiple()).toBe(false);
});
