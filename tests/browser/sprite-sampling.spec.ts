import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

for (const [scale, dpr, red] of [
  [1, 1, [0, 30, 60, 90, 150, 180, 210, 240]],
  [
    2,
    1,
    [0, 0, 30, 30, 60, 90, 90, 120, 120, 150, 150, 180, 210, 210, 240, 240],
  ],
  [
    3,
    1,
    [
      0, 0, 0, 30, 30, 60, 60, 60, 90, 90, 90, 120, 120, 150, 150, 150, 180,
      180, 180, 210, 210, 240, 240, 240,
    ],
  ],
  [
    2,
    2,
    [
      0, 0, 0, 0, 30, 30, 30, 60, 60, 60, 60, 90, 90, 90, 120, 120, 120, 120,
      150, 150, 150, 180, 180, 180, 180, 210, 210, 210, 240, 240, 240, 240,
    ],
  ],
] as const) {
  test(`larger native sprites sample at the final GUI${scale} DPR${dpr} resolution`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: dpr,
    });
    try {
      const page = await context.newPage();
      await page.goto("/tests/browser/host.html");
      await page.evaluate((scale) => {
        const w = window as any;
        const image = document.createElement("canvas");
        image.width = image.height = 9;
        const g = image.getContext("2d")!;
        for (let x = 0; x < 9; x++) {
          g.fillStyle = `rgb(${30 * x},0,0)`;
          g.fillRect(x, 0, 1, 9);
        }
        w.preview.update({
          document: w.api.createDocument(
            w.api.parseText(
              '<white><shadow:#00000000><sprite:gui:"test:stripe"></shadow></white>',
              "minimessage",
            ).value,
          ),
          context: {
            ...w.context,
            profile: w.api.java263Profile,
            guiScale: scale,
            animations: false,
            spriteProvider: () => ({ frames: [{ url: image.toDataURL() }] }),
          },
        });
      }, scale);
      const canvas = page.locator(
        '#preview [data-sprite-state="ready"] canvas',
      );
      await expect(canvas).toHaveCount(1);
      const image = PNG.sync.read(await canvas.screenshot());
      expect(
        Array.from({ length: red.length }, (_, x) => image.data[x * 4]),
      ).toEqual(red);
    } finally {
      await context.close();
    }
  });
}
