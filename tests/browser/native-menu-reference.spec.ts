import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";

function foreground(
  image: PNG,
  color: readonly number[],
  region: readonly number[],
) {
  const [x, y, width, height] = region as [number, number, number, number];
  const pixels: number[] = [];
  for (let row = y; row < y + height; row++)
    for (let column = x; column < x + width; column++) {
      const offset = (row * image.width + column) * 4;
      pixels.push(
        color.every((channel, index) => image.data[offset + index] === channel)
          ? 1
          : 0,
      );
    }
  return pixels;
}
const versions = [
  ["1.20.4", "java1204Profile", false],
  ["1.21.1", "java1211Profile", false],
  ["1.21.11", "java12111Profile", true],
  ["26.1", "java261Profile", true],
  ["26.1.1", "java2611Profile", true],
  ["26.1.2", "java2612Profile", true],
  ["26.2", "java262Profile", true],
  ["26.3", "java263Profile", true],
] as const;
// Coordinates measured in independent official-client sessions. GUI3 uses 1280x720.
const scales = [
  {
    scale: 1,
    viewport: [854, 480],
    left: 273,
    oldTop: 426,
    modernTop: 428,
    rowLeft: 277,
    frameLeft: 274,
  },
  {
    scale: 2,
    viewport: [854, 480],
    left: 118,
    oldTop: 372,
    modernTop: 376,
    rowLeft: 126,
    frameLeft: 122,
  },
  {
    scale: 3,
    viewport: [1280, 720],
    left: 177,
    oldTop: 558,
    modernTop: 564,
    rowLeft: 189,
    frameLeft: 183,
  },
] as const;
for (const [version, profile, modern] of versions)
  for (const measured of scales) {
    const { scale, viewport, left, rowLeft, frameLeft } = measured;
    if (scale !== 2 && version !== "1.20.4" && version !== "26.3") continue;
    const modernCenter = modern && scale === 1 ? 1 : 0,
      actualRowLeft = rowLeft,
      actualFrameLeft = frameLeft + modernCenter,
      top = modern ? measured.modernTop : measured.oldTop,
      rowTop = (modern ? 37 : 36) * scale,
      directory = `tests/fixtures/client/native-ui/${version}/scale-${scale}`;
    test(`matches native Java ${version} menu and selection geometry at GUI scale ${scale}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: Math.max(1100, viewport[0] + 20),
        height: Math.max(700, viewport[1] + 20),
      });
      await page.goto("/tests/browser/host.html");
      await page.waitForFunction(() => !!window.preview);
      await page.evaluate(
        ({ profile, viewport, scale }) => {
          window.context = {
            ...window.context,
            profile: window.api[profile],
            viewportWidth: viewport[0],
            viewportHeight: viewport[1],
            guiScale: scale,
            selected: false,
            compatible: false,
          };
          window.preview.update({
            document: window.doc,
            context: window.context,
          });
        },
        { profile, viewport, scale },
      );
      await page.evaluate(() => document.fonts.ready);
      const buttons = [
        [left, top, 100 * scale, 20 * scale],
        [left + 104 * scale, top, 100 * scale, 20 * scale],
        [left + 208 * scale, top, 100 * scale, 20 * scale],
        [left, top + 24 * scale, 74 * scale, 20 * scale],
        [left + 78 * scale, top + 24 * scale, 74 * scale, 20 * scale],
        [left + 156 * scale, top + 24 * scale, 74 * scale, 20 * scale],
        [left + 234 * scale, top + 24 * scale, 74 * scale, 20 * scale],
      ];
      const bounds = await page.locator("#preview").evaluate((host) => {
        const stage = host.querySelector(".mcp-stage")!.getBoundingClientRect();
        const rectangle = (node: Element) => {
          const r = node.getBoundingClientRect();
          return [r.x - stage.x, r.y - stage.y, r.width, r.height];
        };
        return {
          buttons: [...host.querySelectorAll(".mcp-menu-button")].map(
            rectangle,
          ),
          icon: rectangle(host.querySelector(".mcp-icon")!),
        };
      });
      expect.soft(bounds.buttons).toEqual(buttons);
      expect
        .soft(bounds.icon)
        .toEqual([actualRowLeft, rowTop, 32 * scale, 32 * scale]);
      const browser = PNG.sync.read(
          await page.locator("#preview .mcp-stage").screenshot(),
        ),
        native = PNG.sync.read(readFileSync(`${directory}/incompatible.png`));
      expect.soft([browser.width, browser.height]).toEqual(viewport);
      if (scale === 2) {
        for (const [x, y, width] of buttons)
          for (const color of [
            [255, 255, 255],
            [160, 160, 160],
          ]) {
            // Label ink excludes deliberately approximate button texture/border artwork.
            const region = [x! + 4, y! + 8, width! - 8, 24];
            expect
              .soft(foreground(browser, color, region))
              .toEqual(foreground(native, color, region));
          }
        const titleRegion = [300, modern ? 20 : 36, 260, 24];
        expect
          .soft(foreground(browser, [255, 255, 255], titleRegion))
          .toEqual(foreground(native, [255, 255, 255], titleRegion));
        const statusRegion = [600, rowTop, 135, 20];
        expect
          .soft(foreground(browser, [255, 85, 85], statusRegion))
          .toEqual(foreground(native, [255, 85, 85], statusRegion));
      }
      const pingRegion = [
        actualRowLeft + (modern ? 286 : 290) * scale,
        rowTop,
        10 * scale,
        8 * scale,
      ];
      for (const color of [
        [255, 0, 0],
        [130, 0, 0],
        [91, 91, 91],
        [56, 56, 56],
        [22, 22, 22],
        [27, 27, 27],
        [45, 45, 45],
      ])
        expect
          .soft(foreground(browser, color, pingRegion))
          .toEqual(foreground(native, color, pingRegion));
      await page.evaluate(() => {
        window.context.selected = true;
        window.preview.update({
          document: window.doc,
          context: window.context,
        });
      });
      const frame = await page
        .locator("#preview .mcp-selection")
        .evaluate((node) => {
          const stage = node.closest(".mcp-stage")!.getBoundingClientRect(),
            r = node.getBoundingClientRect();
          return [r.x - stage.x, r.y - stage.y, r.width, r.height];
        });
      expect
        .soft(frame)
        .toEqual([
          actualFrameLeft,
          rowTop - 2 * scale,
          305 * scale,
          36 * scale,
        ]);
      const selected = PNG.sync.read(
          await page.locator("#preview .mcp-stage").screenshot(),
        ),
        reference = PNG.sync.read(readFileSync(`${directory}/selected.png`));
      if (scale === 2)
        for (const [x, y, width] of buttons) {
          const region = [x! + 4, y! + 8, width! - 8, 24];
          expect
            .soft(foreground(selected, [255, 255, 255], region))
            .toEqual(foreground(reference, [255, 255, 255], region));
        }
      // Includes the legacy dirt menu's fade over the top of the selected outline.
      for (const [x, y] of [
        [actualFrameLeft + 10 * scale, rowTop - 2 * scale],
        [actualFrameLeft, rowTop + 10 * scale],
      ]) {
        const at = (y! * selected.width + x!) * 4;
        const nativeAt = (y! * reference.width + x!) * 4;
        // OpenGL and browser gradient interpolation can round one channel differently.
        for (let channel = 0; channel < 3; channel++)
          expect
            .soft(
              Math.abs(
                selected.data[at + channel]! -
                  reference.data[nativeAt + channel]!,
              ),
            )
            .toBeLessThanOrEqual(version === "1.20.4" ? 1 : 0);
      }
      await page.evaluate(() => {
        window.context.selected = false;
        window.context.compatible = true;
        window.preview.update({
          document: window.doc,
          context: window.context,
        });
      });
      if (scale === 2) {
        const compatible = PNG.sync.read(
            await page.locator("#preview .mcp-stage").screenshot(),
          ),
          reference = PNG.sync.read(
            readFileSync(`${directory}/compatible.png`),
          ),
          region = [
            actualRowLeft + 210 * scale,
            rowTop,
            90 * scale,
            10 * scale,
          ];
        expect
          .soft(foreground(compatible, [170, 170, 170], region))
          .toEqual(foreground(reference, [170, 170, 170], region));
        for (const color of [
          [0, 255, 33],
          [0, 135, 15],
        ])
          expect
            .soft(foreground(compatible, color, pingRegion))
            .toEqual(foreground(reference, color, pingRegion));
      }
      // The same native status regions expose player names and connection information.
      const sceneBounds = await page
        .locator("#preview .mcp-stage")
        .boundingBox();
      // These are the cursor coordinates used for the independent native hover captures.
      await page.mouse.move(
        sceneBounds!.x + actualRowLeft + 270 * scale,
        sceneBounds!.y + rowTop + 4 * scale,
      );
      await expect(
        page.locator("#preview [role=tooltip]:visible"),
      ).toContainText("Ada");
      await expect(
        page.locator("#preview [role=tooltip]:visible"),
      ).toContainText("… and 41 more …");
      await page.mouse.move(
        sceneBounds!.x + actualRowLeft + 291 * scale,
        sceneBounds!.y + rowTop + 4 * scale,
      );
      await expect(page.locator("#preview [role=tooltip]:visible")).toHaveText(
        "35 ms",
      );
    });
  }

for (const fromAssets of [false, true])
  test(`a transparent legacy menu omits its edge fade (${fromAssets ? "asset provider" : "direct override"})`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/host.html");
    await page.waitForFunction(() => !!window.preview);
    await page.evaluate((fromAssets) => {
      window.context.profile = window.api.java1204Profile;
      if (fromAssets) {
        window.context.background = "auto";
        window.context.assetProvider = () => ({ background: "none" });
      } else window.context.background = "none";
      window.preview.update({ document: window.doc, context: window.context });
    }, fromAssets);
    await expect(page.locator("#preview .mcp-stage")).toHaveAttribute(
      "data-background",
      "none",
    );
    await expect(page.locator("#preview .mcp-list-fade")).toBeHidden();
  });
