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
test("matches independently captured Java 1.21.1 text pixels and positions", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.evaluate(() => document.fonts.ready);
  const browser = PNG.sync.read(
    await page.locator("#preview .mcp-row").screenshot(),
  );
  const client = PNG.sync.read(
    readFileSync("tests/fixtures/client/java-1.21.1/server-list.png"),
  );
  for (const color of [
    [255, 255, 255],
    [255, 170, 0],
    [85, 255, 85],
  ])
    expect(mask(browser, color, [68, 0, 350, 62])).toEqual(
      mask(client, color, [194, 72, 350, 62]),
    );
  await page.locator("#preview .mcp-players").hover();
  await expect(page.locator("#preview [role=tooltip]:visible")).toContainText(
    "… and 41 more …",
  );
});
