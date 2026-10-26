import { expect, test } from "./graphics-diagnostics.js";

test("DOM example previews a host-provided, configurable panorama", async ({
  page,
}) => {
  await page.goto("/examples/dom/");
  await page.selectOption("#presentation", "server-list");
  await page.selectOption("#background", "auto");

  const background = page.locator("#preview .mcp-background");
  await expect(background).toHaveAttribute("data-panorama-state", "ready");
  await expect(background.locator(".mcp-panorama-canvas")).toHaveCount(1);
  await expect(page.locator("#panorama-paused")).not.toBeChecked();

  await page.locator("#panorama-paused").check();
  const pausedStyle = await background
    .locator(".mcp-panorama-canvas")
    .getAttribute("data-panorama-yaw");
  await page.locator("#panorama-speed").fill("2");
  await expect(page.locator("#panorama-speed-value")).toHaveText("2×");
  expect(
    await background
      .locator(".mcp-panorama-canvas")
      .getAttribute("data-panorama-yaw"),
  ).toBe(pausedStyle);
});

test("React example exposes the same profile-owned panorama controls", async ({
  page,
}) => {
  await page.goto("/examples/react/");
  await page.getByLabel("Presentation").selectOption("server-list");

  const background = page.locator(".preview-output .mcp-background");
  await expect(background).toHaveAttribute("data-panorama-state", "ready");
  await expect(background.locator(".mcp-panorama-canvas")).toHaveCount(1);
  await expect(page.locator("#panorama-paused")).not.toBeChecked();

  await page.locator("#panorama-paused").check();
  await page.locator("#panorama-speed").fill("2");
  await expect(page.locator("#panorama-speed-value")).toHaveText("2×");
});
