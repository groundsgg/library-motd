import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

function foregroundRuns(image: PNG, enabled?: boolean) {
  const runs: number[] = [];
  let run = 0;
  for (let x = 0; x < image.width; x++) {
    let foreground = false;
    for (let y = 0; y < image.height; y++) {
      const i = (y * image.width + x) * 4;
      const [r, g, b] = image.data.subarray(i, i + 3);
      if (
        (enabled !== false && r === 0 && g === 255 && b === 33) ||
        (enabled !== true && r === 91 && g === 91 && b === 91)
      )
        foreground = true;
    }
    if (foreground) run++;
    else if (run) {
      runs.push(run);
      run = 0;
    }
  }
  if (run) runs.push(run);
  return runs;
}

for (const zoom of [0.8, 0.9, 1, 1.1, 1.25])
  test(`ping bars remain five separate columns at layout zoom ${zoom}`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/host.html");
    await page.waitForFunction(() => !!window.editor);
    await page.evaluate((zoom) => {
      document.body.style.zoom = String(zoom);
      window.context = {
        ...window.context,
        guiScale: 2,
        viewportWidth: 618,
        presentation: "row",
        background: "none",
        animations: false,
        compatible: true,
      };
    }, zoom);
    for (const [pingMs, active] of [
      [35, 5],
      [175, 4],
      [350, 3],
      [650, 2],
      [1200, 1],
    ]) {
      await page.evaluate((pingMs) => {
        window.context = { ...window.context, pingMs };
        window.preview.update({
          document: window.doc,
          context: window.context,
        });
        window.setEditorOptions({ context: window.context });
      }, pingMs);
      for (const host of ["#preview", "#editor"]) {
        const image = PNG.sync.read(
          await page
            .locator(`${host} .mcp-ping`)
            .screenshot({ scale: "device" }),
        );
        expect(foregroundRuns(image)).toHaveLength(5);
        expect(foregroundRuns(image, true)).toHaveLength(active!);
        expect(foregroundRuns(image, false)).toHaveLength(5 - active!);
      }
    }
    await page.evaluate(() => {
      window.context = { ...window.context, compatible: false };
      window.preview.update({ document: window.doc, context: window.context });
      window.setEditorOptions({ context: window.context });
    });
    const ping = page.locator("#editor .mcp-ping");
    await expect(ping).toHaveAccessibleName("Connection status");
    await ping.click();
    await expect(
      page.getByRole("dialog", { name: "Version settings", exact: true }),
    ).toBeVisible();
  });
