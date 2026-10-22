import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";

test("places icon inside the native selection outline and shows a complete menu", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.preview);
  await page.evaluate(() => {
    window.context.viewportWidth = 854;
    window.context.viewportHeight = 480;
    window.context.selected = true;
    window.preview.update({ document: window.doc, context: window.context });
  });
  const bounds = await page.locator("#preview").evaluate((root) => {
    const scene = root.querySelector(".mcp-stage")!.getBoundingClientRect();
    const icon = root.querySelector(".mcp-icon")!.getBoundingClientRect();
    const frame = root.querySelector(".mcp-selection")!.getBoundingClientRect();
    return {
      icon: [icon.x - scene.x, icon.y - scene.y, icon.width, icon.height],
      frame: [frame.x - scene.x, frame.y - scene.y, frame.width, frame.height],
    };
  });
  expect(bounds.icon).toEqual([126, 72, 64, 64]);
  expect(bounds.frame).toEqual([122, 68, 610, 72]);
  await expect(page.locator("#preview .mcp-menu-title")).toHaveText(
    "Play Multiplayer",
  );
  await expect(page.locator("#preview .mcp-stage")).toHaveAttribute(
    "data-background",
    "panorama",
  );
  await expect(page.locator("#preview .mcp-row")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await page.evaluate(() => {
    window.context.selected = false;
    window.context.background = "none";
    window.preview.update({ document: window.doc, context: window.context });
  });
  await expect(page.locator("#preview .mcp-selection")).toHaveCount(0);
  await expect(page.locator("#preview .mcp-stage")).toHaveAttribute(
    "data-background",
    "none",
  );
});

test("renders a supplied icon pixel for pixel at its native coordinates", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.preview);
  const png = readFileSync("tests/fixtures/client/reference-icon.png").toString(
    "base64",
  );
  await page.evaluate((png) => {
    window.doc.icon = { pngBase64: png };
    window.context.viewportWidth = 854;
    window.context.viewportHeight = 480;
    window.preview.update({ document: window.doc, context: window.context });
  }, png);
  await expect(page.locator("#preview .mcp-icon img")).toBeVisible();
  const actual = PNG.sync.read(
    await page.locator("#preview .mcp-icon").screenshot(),
  );
  const reference = PNG.sync.read(
    readFileSync("tests/fixtures/client/java-1.21.1/icon-unselected.png"),
  );
  const crop = new PNG({ width: 64, height: 64 });
  PNG.bitblt(reference, crop, 126, 72, 64, 64, 0, 0);
  expect(actual.data.equals(crop.data)).toBe(true);
});

test("selects real client versions independently from server protocol and background", async ({
  page,
}) => {
  await page.goto("/examples/dom/");
  const version = page.getByLabel("Client version", { exact: true });
  for (const [id, background] of [
    ["java-1.20.4", "dirt"],
    ["java-1.21.1", "panorama"],
    ["java-1.21.11", "panorama"],
    ["java-26.1", "panorama"],
    ["java-26.1.1", "panorama"],
    ["java-26.1.2", "panorama"],
    ["java-26.2", "panorama"],
    ["java-26.3", "panorama"],
  ]) {
    await version.selectOption(id);
    await expect(page.locator("#preview .mcp-stage")).toHaveAttribute(
      "data-client-profile",
      id,
    );
    await expect(page.locator("#preview .mcp-stage")).toHaveAttribute(
      "data-background",
      background,
    );
  }
  await page
    .getByLabel("Compatibility", { exact: true })
    .selectOption("incompatible");
  await expect(page.locator("#preview .mcp-incompatible")).toHaveCount(2);
  await page.getByLabel("Background", { exact: true }).selectOption("dirt");
  await expect(page.locator("#preview .mcp-stage")).toHaveAttribute(
    "data-background",
    "dirt",
  );
});

test("keeps icon alpha during upload and composites over the selected row", async ({
  page,
  browserName,
}) => {
  await page.goto("/tests/browser/host.html");
  const png = readFileSync("tests/fixtures/client/transparent-icon.png");
  await page.getByLabel("Server icon", { exact: true }).setInputFiles({
    name: "transparent.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page
    .getByRole("dialog", { name: "Server icon editor", exact: true })
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(page.locator("#preview .mcp-icon img")).toBeVisible();
  const normalized = PNG.sync.read(
    Buffer.from(await page.evaluate(() => window.doc.icon.pngBase64), "base64"),
  );
  for (const [x, y, a] of [
    [8, 8, 0],
    [48, 8, 64],
    [8, 48, 128],
    [48, 48, 255],
  ])
    expect(normalized.data[(y * 64 + x) * 4 + 3]).toBe(a);
  await expect(page.locator("#preview .mcp-icon")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await page.evaluate(() => {
    window.context.selected = true;
    window.context.profile = window.api.java261Profile;
    window.context.viewportWidth = 854;
    window.context.viewportHeight = 480;
    window.preview.update({ document: window.doc, context: window.context });
  });
  const actual = PNG.sync.read(
    await page.locator("#preview .mcp-icon").screenshot(),
  );
  const native = PNG.sync.read(
    readFileSync("tests/fixtures/client/java-26.1/selected.png"),
  );
  const nativeIcon = new PNG({ width: 64, height: 64 });
  PNG.bitblt(native, nativeIcon, 126, 74, 64, 64, 0, 0);
  const source = PNG.sync.read(png);
  // Canvas premultiplication/compositing rounds translucent channels differently
  // across engines. Opaque/transparent pixels and Chromium remain exact.
  let translucentDifference = 0;
  let exactDifference = 0;
  for (let i = 0; i < actual.data.length; i++) {
    const alpha = source.data[Math.floor(i / 4) * 4 + 3]!;
    const difference = Math.abs(actual.data[i]! - nativeIcon.data[i]!);
    if (alpha > 0 && alpha < 255 && i % 4 !== 3)
      translucentDifference = Math.max(translucentDifference, difference);
    else exactDifference = Math.max(exactDifference, difference);
  }
  expect(exactDifference).toBe(0);
  expect(translucentDifference).toBeLessThanOrEqual(
    browserName === "chromium" ? 0 : 2,
  );
  // In the native client the selection interior is black, including behind transparent pixels.
  for (const [x, y, r, g, b] of [
    [8, 8, 0, 0, 0],
    [48, 8, 50, 25, 13],
    [8, 48, 100, 50, 25],
    [48, 48, 200, 100, 50],
  ]) {
    const at = (y * actual.width + x) * 4;
    for (const [channel, expected] of [r, g, b].entries())
      expect(
        Math.abs(actual.data[at + channel]! - expected),
      ).toBeLessThanOrEqual(
        browserName === "chromium" ||
          (x === 8 && y === 8) ||
          (x === 48 && y === 48)
          ? 0
          : 2,
      );
  }
  await page.evaluate(() => {
    window.context.selected = false;
    window.context.background = "none";
    window.preview.update({ document: window.doc, context: window.context });
  });
  const unselected = PNG.sync.read(
    await page.locator("#preview .mcp-icon").screenshot(),
  );
  expect([
    ...unselected.data.subarray((8 * 64 + 8) * 4, (8 * 64 + 8) * 4 + 3),
  ]).toEqual([255, 255, 255]);
});

test("uses the native red default for incompatible version text", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.preview);
  await page.evaluate(() => {
    window.context.compatible = false;
    window.preview.update({ document: window.doc, context: window.context });
  });
  await expect(
    page.locator("#preview .mcp-version-text .mcp-glyph").first(),
  ).toHaveCSS("color", "rgb(255, 85, 85)");
});
