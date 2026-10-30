import { expect, test } from "./selection-diagnostics.js";
import { test as plain } from "@playwright/test";
import { placeCaretAtTextEnd } from "./editor-actions.js";

test("selection diagnostics correlate real native navigation with model selection without source text", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!(window as any).editor);
  await page.evaluate(() =>
    (window as any).editor.execute({
      type: "replace-source",
      source: "Alpha Beta",
    }),
  );
  const field = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await placeCaretAtTextEnd(field);
  await field.press("Shift+ArrowLeft");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).selectionEvents.some(
          (event: any) =>
            event.field === "motd" &&
            event.selectedLength === 1 &&
            event.pm?.from === 10 &&
            event.pm?.to === 11,
        ),
      ),
    )
    .toBe(true);
  const events = await page.evaluate(() => (window as any).selectionEvents);
  expect(
    events.some(
      (event: any) => event.type === "pm-update" && event.pm?.from === 10,
    ),
  ).toBe(true);
  expect(
    events.some(
      (event: any) =>
        event.type === "keydown" && event.key === "ArrowLeft" && event.trusted,
    ),
  ).toBe(true);
  expect(JSON.stringify(events)).not.toContain("Alpha");
  expect(JSON.stringify(events)).not.toContain("Beta");
});

test("selection diagnostics bound their timeline and classify key payloads without copying them", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!(window as any).editor);
  const field = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await placeCaretAtTextEnd(field);
  await page.evaluate(() => {
    for (let i = 0; i < 300; i++)
      document.dispatchEvent(
        new KeyboardEvent("keyup", { key: "PRIVATE-KEY-PAYLOAD" }),
      );
  });
  const events = await page.evaluate(() => (window as any).selectionEvents);
  expect(events.length).toBeLessThanOrEqual(256);
  expect(
    events.some(
      (event: any) => event.type === "keyup" && event.key === "other",
    ),
  ).toBe(true);
  expect(JSON.stringify(events)).not.toContain("PRIVATE-KEY-PAYLOAD");
});

plain("ordinary fixtures do not enable selection tracing", async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!(window as any).editor);
  expect(
    await page.evaluate(() => typeof (window as any).selectionEvents),
  ).toBe("undefined");
  expect(
    await page.evaluate(() => typeof (window as any).selectionModelSnapshot),
  ).toBe("undefined");
});
