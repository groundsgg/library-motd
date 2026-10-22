import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
async function image(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "red";
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = "blue";
    g.fillRect(64, 0, 64, 64);
    return canvas.toDataURL().split(",")[1];
  });
}
async function upload(page: Page, provided?: string) {
  const data = provided ?? (await image(page));
  await page.getByLabel("Server icon", { exact: true }).setInputFiles({
    name: "icon.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  });
}
test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
});
test("icon upload uses an explicit local draft, cancel and one undoable Apply", async ({
  page,
}) => {
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await upload(page);
  const dialog = page.getByRole("dialog", {
    name: "Server icon editor",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  await upload(page);
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  const png = PNG.sync.read(
    Buffer.from(await page.evaluate(() => window.doc.icon.pngBase64), "base64"),
  );
  expect([png.width, png.height]).toEqual([64, 64]);
  expect(await page.evaluate(() => window.changes.length)).toBe(1);
  await page
    .locator("#editor")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
});
test("crop draft previews the requested square and retains PNG alpha", async ({
  page,
}) => {
  await upload(page);
  const dialog = page.getByRole("dialog", {
    name: "Server icon editor",
    exact: true,
  });
  await dialog.getByLabel("Crop x", { exact: true }).fill("64");
  await dialog.getByLabel("Crop size", { exact: true }).fill("64");
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  const result = PNG.sync.read(
    Buffer.from(await page.evaluate(() => window.doc.icon.pngBase64), "base64"),
  );
  expect([...result.data.subarray(0, 4)]).toEqual([0, 0, 255, 255]);
  await page.getByLabel("Server icon", { exact: true }).setInputFiles({
    name: "alpha.png",
    mimeType: "image/png",
    buffer: readFileSync("tests/fixtures/client/transparent-icon.png"),
  });
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  const alpha = PNG.sync.read(
    Buffer.from(await page.evaluate(() => window.doc.icon.pngBase64), "base64"),
  );
  for (const [x, y, a] of [
    [8, 8, 0],
    [48, 8, 64],
    [8, 48, 128],
    [48, 48, 255],
  ])
    expect(alpha.data[(y * 64 + x) * 4 + 3]).toBe(a);
});
test("invalid crops and corrupt files keep the last committed icon", async ({
  page,
}) => {
  await upload(page);
  const dialog = page.getByRole("dialog", {
    name: "Server icon editor",
    exact: true,
  });
  await dialog.getByLabel("Crop x", { exact: true }).fill("999");
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByRole("status")).toContainText("square inside");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Server icon", { exact: true }).setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("broken"),
  });
  await expect(dialog.getByRole("status")).toContainText("Invalid image");
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
test("file drop opens a draft and reset is a separate undoable change", async ({
  page,
}) => {
  const data = await image(page);
  await page.locator("#editor [data-field=icon]").evaluate((node, data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
      transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "drop.png", { type: "image/png" }));
    node.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  }, data);
  const dialog = page.getByRole("dialog", {
    name: "Server icon editor",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  const previous = await page.evaluate(() => window.doc.icon.pngBase64);
  await page
    .getByRole("button", { name: "Edit server icon", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Reset icon", exact: true }).click();
  expect(await page.evaluate(() => window.doc.icon.pngBase64)).toBe(previous);
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  expect(await page.evaluate(() => window.doc.icon)).toBeNull();
  await page
    .locator("#editor")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  expect(await page.evaluate(() => window.doc.icon.pngBase64)).toBe(previous);
});
for (const action of ["replace", "readonly", "destroy"] as const)
  test(`late image decode is discarded after ${action}`, async ({ page }) => {
    await page.evaluate(() => {
      const original = window.createImageBitmap;
      window.createImageBitmap = async (...args) => {
        await new Promise((resolve) => {
          window.releaseDecode = resolve;
        });
        const image = await original(...args);
        window.decodeFinished = true;
        return image;
      };
    });
    await upload(page);
    await page.waitForFunction(() => !!window.releaseDecode);
    await page.evaluate((action) => {
      if (action === "replace")
        window.setEditorOptions({ document: window.api.createDocument() });
      else if (action === "readonly")
        window.setEditorOptions({ readOnly: true });
      else window.editor.destroy();
    }, action);
    await page.evaluate(() => window.releaseDecode());
    await page.waitForFunction(() => window.decodeFinished);
    await expect(
      page.getByRole("dialog", { name: "Server icon editor", exact: true }),
    ).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.changes.length)).toBe(0);
    expect(await page.evaluate(() => window.doc.icon)).toBeNull();
  });
for (const patch of [
  { features: { icon: false } },
  { readOnly: true },
  { disabled: true },
])
  test(`icon entry points reject file drops for ${JSON.stringify(patch)}`, async ({
    page,
  }) => {
    await page.evaluate((patch) => window.setEditorOptions(patch), patch);
    await expect(
      page.getByRole("button", { name: "Upload server icon", exact: true }),
    ).toHaveCount(0);
    const data = await image(page);
    await page.locator("#editor [data-field=icon]").evaluate((node, data) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(
          [Uint8Array.from(atob(data), (c) => c.charCodeAt(0))],
          "drop.png",
          { type: "image/png" },
        ),
      );
      node.dispatchEvent(
        new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
      );
    }, data);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => window.changes.length)).toBe(0);
  });

test("image decoding can be cancelled before a draft is ready", async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = window.createImageBitmap;
    window.createImageBitmap = async (...args) => {
      await new Promise((resolve) => {
        window.releaseDecode = resolve;
      });
      const image = await original(...args);
      window.decodeFinished = true;
      return image;
    };
  });
  await upload(page);
  await page.waitForFunction(() => !!window.releaseDecode);
  await page
    .getByRole("button", { name: "Cancel upload", exact: true })
    .click();
  await page.evaluate(() => window.releaseDecode());
  await page.waitForFunction(() => window.decodeFinished);
  await expect(
    page.getByRole("dialog", { name: "Server icon editor", exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
test("an open icon draft is invalidated by external replacement", async ({
  page,
}) => {
  await upload(page);
  const dialog = page.getByRole("dialog", {
    name: "Server icon editor",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.evaluate(() =>
    window.setEditorOptions({ document: window.api.createDocument() }),
  );
  await expect(dialog.getByRole("status")).toContainText(
    "can no longer be applied",
  );
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
test("a late older upload does not replace the newer draft", async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = window.createImageBitmap;
    let first = true;
    window.createImageBitmap = async (...args) => {
      if (first) {
        first = false;
        await new Promise((resolve) => {
          window.releaseDecode = resolve;
        });
        const image = await original(...args);
        window.decodeFinished = true;
        return image;
      }
      return original(...args);
    };
  });
  await upload(page);
  await page.waitForFunction(() => !!window.releaseDecode);
  await page.getByLabel("Server icon", { exact: true }).setInputFiles({
    name: "new.png",
    mimeType: "image/png",
    buffer: readFileSync("tests/fixtures/client/transparent-icon.png"),
  });
  const dialog = page.getByRole("dialog", {
    name: "Server icon editor",
    exact: true,
  });
  await expect(
    dialog.getByRole("button", { name: "Apply", exact: true }),
  ).toBeEnabled();
  const preview = await dialog
    .getByRole("img", { name: "Icon crop preview", exact: true })
    .getAttribute("src");
  await page.evaluate(() => window.releaseDecode());
  await page.waitForFunction(() => window.decodeFinished);
  await expect(
    dialog.getByRole("img", { name: "Icon crop preview", exact: true }),
  ).toHaveAttribute("src", preview);
  expect(await page.evaluate(() => window.changes.length)).toBe(0);
});
