import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { makeApng } from "../helpers/apng.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.editor?.execute === "function",
  );
});

test("viewer shows the PNG default image even when APNG animation excludes it", async ({
  page,
}) => {
  const { png } = makeApng();
  const base64 = png.toString("base64");
  await page.evaluate((pngBase64) => {
    const next = structuredClone(window.doc);
    next.icon = { pngBase64 };
    window.editor.execute({ type: "replace-document", document: next });
  }, base64);
  const image = page.locator("#preview .mcp-icon img");
  const pixels = await image.evaluate(async (image) => {
    await (image as HTMLImageElement).decode();
    const canvas = image.ownerDocument.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image as HTMLImageElement, 0, 0);
    return {
      center: [...ctx.getImageData(32, 32, 1, 1).data],
      alpha: ctx.getImageData(0, 0, 1, 1).data[3],
    };
  });
  expect(pixels).toEqual({ center: [255, 0, 0, 128], alpha: 0 });
  expect(await page.evaluate(() => window.doc.icon!.pngBase64)).toBe(base64);
  await expect(page.locator("#editor .mce-diagnostics")).toContainText(
    "static default image",
  );
});

test("inherited icons and notices follow the same native projection", async ({
  page,
}) => {
  const { png } = makeApng();
  await page.evaluate((base64) => {
    const context = {
      ...window.context,
      base: {
        ...window.context.base,
        favicon: "data:image/png;base64," + base64,
      },
    };
    window.setEditorOptions({ context, labels: window.api.germanLabels });
    window.preview.update({ document: window.doc, context });
  }, png.toString("base64"));
  const src = await page.locator("#preview .mcp-icon img").getAttribute("src");
  const image = PNG.sync.read(Buffer.from(src!.split(",")[1]!, "base64"));
  expect([...image.data.subarray(4, 8)]).toEqual([255, 0, 0, 128]);
  await expect(page.locator("#editor .mce-diagnostics")).toContainText(
    "statische Standardbild",
  );
});

for (const mimeType of ["image/png", "image/apng"])
  test(`upload and crop use native default pixels for ${mimeType}`, async ({
    page,
  }) => {
    const { png } = makeApng();
    await page
      .locator('#editor input[type="file"]')
      .setInputFiles({ name: "animated.png", mimeType, buffer: png });
    const dialog = page.getByRole("dialog", {
      name: "Server icon editor",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("status")).toContainText(
      "static default image",
    );
    expect(
      await dialog.locator(".mce-crop-canvas").evaluate((canvas) => {
        const c = canvas as HTMLCanvasElement;
        return [
          ...c.getContext("2d")!.getImageData(c.width / 2, c.height / 2, 1, 1)
            .data,
        ];
      }),
    ).toEqual([255, 0, 0, 128]);
    await dialog.getByRole("button", { name: "Apply", exact: true }).click();
    const saved = await page.evaluate(() => window.doc.icon!.pngBase64);
    expect([
      ...PNG.sync.read(Buffer.from(saved, "base64")).data.subarray(4, 8),
    ]).toEqual([255, 0, 0, 128]);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(await page.evaluate(() => window.doc.icon)).toBeNull();
  });

test("normalization keeps existing arbitrary-size PNG cropping while choosing static pixels", async ({
  page,
}) => {
  const { png } = makeApng(true, 80);
  const result = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return window.dom.normalizeIcon(new Blob([bytes], { type: "image/png" }), {
      crop: { x: 8, y: 8, width: 64, height: 64 },
    });
  }, png.toString("base64"));
  const image = PNG.sync.read(Buffer.from(result.value!.pngBase64, "base64"));
  expect([image.width, image.height]).toEqual([64, 64]);
  expect([...image.data.subarray(4, 8)]).toEqual([255, 0, 0, 128]);
  expect(
    result.diagnostics.some((d) => d.code === "animated-icon-static"),
  ).toBe(true);
});

test("editing an existing APNG source previews static pixels without rewriting source", async ({
  page,
}) => {
  const base64 = makeApng().png.toString("base64");
  await page.evaluate((pngBase64) => {
    const next = structuredClone(window.doc);
    next.icon = { pngBase64 };
    window.editor.execute({ type: "replace-document", document: next });
  }, base64);
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await page
    .getByRole("button", { name: "Edit server icon", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Server icon editor",
    exact: true,
  });
  const pixels = await dialog
    .locator(".mce-icon-preview")
    .evaluate(async (image) => {
      await (image as HTMLImageElement).decode();
      const canvas = image.ownerDocument.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image as HTMLImageElement, 0, 0);
      return [...ctx.getImageData(32, 32, 1, 1).data];
    });
  expect(pixels).toEqual([255, 0, 0, 128]);
  await expect(dialog.getByRole("status")).toContainText(
    "static default image",
  );
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  await page
    .getByRole("button", { name: "Edit server icon", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Reset icon", exact: true }).click();
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  expect(await page.evaluate(() => window.doc.icon)).toBeNull();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
});
