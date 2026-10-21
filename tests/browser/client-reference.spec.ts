import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
function mask(p: PNG, color: number[], region: number[]) {
  const [x, y, w, h] = region;
  const bits: number[] = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const at = ((j + y) * p.width + i + x) * 4;
      bits.push(color.every((c, k) => p.data[at + k] === c) ? 1 : 0);
    }
  return bits;
}
for (const [version, profileName, rowY] of [
  ["1.20.4", "java1204Profile", 72],
  ["1.21.1", "java1211Profile", 72],
  ["1.21.11", "java12111Profile", 74],
  ["26.1", "java261Profile", 74],
  ["26.2", "java262Profile", 74],
  ["26.3", "java263Profile", 74],
] as const)
  test(`matches independently captured Java ${version} text pixels and positions`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/host.html");
    await page.waitForFunction(() => !!window.preview);
    await page.evaluate((profileName) => {
      window.context.profile = window.api[profileName];
      window.context.compatible = true;
      window.preview.update({ document: window.doc, context: window.context });
    }, profileName);
    await page.evaluate(() => document.fonts.ready);
    const browser = PNG.sync.read(
      await page.locator("#preview .mcp-row").screenshot(),
    );
    const client = PNG.sync.read(
      readFileSync(`tests/fixtures/client/java-${version}/server-list.png`),
    );
    for (const color of [
      [255, 255, 255],
      [255, 170, 0],
      [85, 255, 85],
    ])
      expect(mask(browser, color, [68, 0, 350, 62])).toEqual(
        mask(client, color, [194, rowY, 350, 62]),
      );
    if (version !== "1.21.1" && version !== "1.20.4") {
      await page.evaluate(() => {
        window.context.compatible = false;
        window.preview.update({
          document: window.doc,
          context: window.context,
        });
      });
      const incompatible = PNG.sync.read(
        await page.locator("#preview .mcp-row").screenshot(),
      );
      expect(mask(incompatible, [255, 85, 85], [470, 0, 100, 18])).toEqual(
        mask(client, [255, 85, 85], [596, rowY, 100, 18]),
      );
      await page.evaluate(() => {
        window.context.compatible = true;
        window.preview.update({
          document: window.doc,
          context: window.context,
        });
      });
    }
    await page.locator("#preview .mcp-players").hover();
    await expect(page.locator("#preview [role=tooltip]:visible")).toContainText(
      "… and 41 more …",
    );
  });
