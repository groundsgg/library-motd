import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("uses host assets per profile, honors overrides and keeps them outside saved documents", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.preview);
  const url =
    "data:image/png;base64," +
    readFileSync("tests/fixtures/client/reference-icon.png").toString("base64");
  const before = await page.evaluate(() => JSON.stringify(window.doc));
  await page.evaluate((url) => {
    window.context.assetProvider = (profile) =>
      profile.id === "java-1.21.1"
        ? {
            background: { imageUrl: url },
            defaultServerIcon: url,
            buttons: { normal: url, border: 2 },
          }
        : undefined;
    window.preview.update({ document: window.doc, context: window.context });
  }, url);
  await expect(page.locator("#preview .mcp-stage")).toHaveAttribute(
    "data-background",
    "custom",
  );
  await expect(page.locator("#preview .mcp-icon img")).toHaveAttribute(
    "src",
    url,
  );
  await expect(page.locator("#preview .mcp-menu-button").first()).toHaveCSS(
    "border-image-source",
    `url("${url}")`,
  );
  await page.evaluate(() => {
    window.context.background = "none";
    window.preview.update({ document: window.doc, context: window.context });
  });
  await expect(page.locator("#preview .mcp-stage")).toHaveAttribute(
    "data-background",
    "none",
  );
  await page.evaluate(() => {
    window.context.background = "auto";
    window.context.profile = window.api.java263Profile;
    window.preview.update({ document: window.doc, context: window.context });
  });
  await expect(page.locator("#preview .mcp-stage")).toHaveAttribute(
    "data-background",
    "panorama",
  );
  await expect(page.locator("#preview .mcp-icon img")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
});
