import { expect, test } from "@playwright/test";

test("compares one document with independent contexts, differences and diagnostics", async ({
  page,
}) => {
  await page.goto("/tests/browser/comparison.html");
  const panels = page.locator(".mcp-comparison-panel");
  await expect(panels).toHaveCount(2);
  await expect(panels.nth(0).getByRole("heading")).toHaveText("Classic");
  await expect(panels.nth(0).locator(".mcp-motd")).toContainText("Europe");
  await expect(panels.nth(1).locator(".mcp-motd")).toContainText("America");
  await expect(
    panels.nth(0).locator(".mcp-comparison-diagnostics"),
  ).not.toContainText("incompatible status");
  await expect(
    panels.nth(1).locator(".mcp-comparison-diagnostics"),
  ).toContainText("incompatible status");
  await expect(panels.nth(1)).toHaveAttribute("data-differences", /version/);
  expect(
    await page.evaluate(
      () =>
        JSON.stringify(window.comparisonOptions.document) ===
        window.comparisonDocument,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    window.comparisonOptions.clients[1].context.viewportWidth = 140;
    window.comparisonOptions.clients[1].context.values.region =
      "America ".repeat(30);
    window.comparison.update(window.comparisonOptions);
  });
  await expect(
    panels.nth(1).locator(".mcp-comparison-diagnostics"),
  ).toContainText("wraps");
});

test("updates, removes and destroys client previews by stable id", async ({
  page,
}) => {
  await page.goto("/tests/browser/comparison.html");
  await expect(page.locator(".mcp-comparison-panel")).toHaveCount(2);
  await page.evaluate(() => {
    window.comparisonOptions.clients.reverse();
    window.comparison.update(window.comparisonOptions);
  });
  await expect(
    page.locator(".mcp-comparison-panel").first().getByRole("heading"),
  ).toHaveText("Modern");
  await page.evaluate(() => {
    window.comparisonOptions.clients.pop();
    window.comparison.update(window.comparisonOptions);
  });
  await expect(page.locator(".mcp-comparison-panel")).toHaveCount(1);
  await page.evaluate(() => {
    window.comparison.destroy();
    window.comparison.destroy();
    window.comparison.update(window.comparisonOptions);
  });
  await expect(page.locator(".mcp-comparison")).toHaveCount(0);
});

test("React comparison updates all clients and cleans up on unmount", async ({
  page,
}) => {
  await page.goto("/tests/browser/comparison.html?react");
  await expect(page.locator(".mcp-comparison-panel")).toHaveCount(2);
  await page.getByRole("button", { name: "Update document" }).click();
  await expect(page.locator(".mcp-motd").nth(0)).toContainText("Updated");
  await expect(page.locator(".mcp-motd").nth(1)).toContainText("Updated");
  await page.getByRole("button", { name: "Toggle comparison" }).click();
  await expect(page.locator(".mcp-comparison")).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle comparison" }).click();
  await expect(page.locator(".mcp-comparison-panel")).toHaveCount(2);
});

test("rejects ambiguous IDs without changing the comparison and handles an empty list", async ({
  page,
}) => {
  await page.goto("/tests/browser/comparison.html");
  await expect(page.locator(".mcp-comparison-panel")).toHaveCount(2);
  const errors = await page.evaluate(() => {
    const client = window.comparisonOptions.clients[0];
    return [[client, client], [{ ...client, id: " " }]].map((clients) => {
      try {
        window.comparison.update({ ...window.comparisonOptions, clients });
        return false;
      } catch {
        return true;
      }
    });
  });
  expect(errors).toEqual([true, true]);
  await expect(page.locator(".mcp-comparison-panel")).toHaveCount(2);
  await page.evaluate(() =>
    window.comparison.update({ ...window.comparisonOptions, clients: [] }),
  );
  await expect(page.getByRole("status")).toHaveText("No clients selected");
  expect(
    await page.evaluate(() => window.comparison.getDiagnostics().size),
  ).toBe(0);
});

test("keeps wide client canvases inside their own viewport on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/tests/browser/comparison.html");
  await expect(page.locator(".mcp-comparison-panel")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("compares aligned runtime output at each client's actual MOTD width", async ({
  page,
}) => {
  await page.goto("/tests/browser/comparison.html");
  await page.evaluate(() => {
    const options = window.comparisonOptions;
    options.document.motd.text = {
      revision: 0,
      nodes: [{ id: "width-test", type: "text", value: "MM MM" }],
    };
    options.document.motd.alignments = ["right"];
    options.document.version = { mode: "automatic" };
    for (const client of options.clients) {
      client.context.compatible = true;
      client.context.values = {};
      client.context.viewportWidth = 854;
      client.context.guiScale = 2;
    }
    window.comparison.update(options);
  });
  expect(
    await page.evaluate(() => window.comparison.getDifferences().get("new")),
  ).toContain("description");
});
