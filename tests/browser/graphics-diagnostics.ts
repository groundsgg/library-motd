import { test as base } from "@playwright/test";
import {
  installGraphicsObserver,
  readGraphicsObserver,
} from "../../tools/graphics-observer.mjs";
import {
  collectGraphicsSnapshot,
  encodeGraphicsDiagnostics,
} from "../../tools/linux-graphics-diagnostics.mjs";

export const test = base.extend<{ graphicsDiagnostics: void }>({
  graphicsDiagnostics: [
    async ({ page }, use, testInfo) => {
      await page.addInitScript(installGraphicsObserver);
      await use();
      if (testInfo.status !== testInfo.expectedStatus) {
        try {
          // Bound the page read as well: a crashed renderer must not stall teardown.
          let timer: ReturnType<typeof setTimeout> | undefined;
          let graphics;
          try {
            graphics = await Promise.race([
              page.evaluate(readGraphicsObserver).catch(() => null),
              new Promise((resolve) => {
                timer = setTimeout(() => resolve(null), 1000);
              }),
            ]);
          } finally {
            clearTimeout(timer);
          }
          const host = await collectGraphicsSnapshot({ probeGlx: true });
          await testInfo.attach("graphics-diagnostics.json", {
            body: encodeGraphicsDiagnostics({ graphics, host }),
            contentType: "application/json",
          });
        } catch {
          /* Preserve the original assertion/result when diagnostics fail. */
        }
      }
    },
    { auto: true },
  ],
});
export { expect } from "@playwright/test";
