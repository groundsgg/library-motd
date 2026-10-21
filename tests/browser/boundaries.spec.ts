import { expect, test } from "@playwright/test";
test("disabled fields resist programmatic document replacement", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  const unchanged = await page.evaluate(() => {
    window.editor.update({
      document: window.doc,
      context: window.context,
      features: { players: false, motd: false },
      onChange: (d) => {
        window.doc = d;
      },
    });
    const before = JSON.stringify(window.editor.getDocument());
    const replacement = structuredClone(window.doc);
    replacement.players.hidden = true;
    replacement.motd.alignments = ["right"];
    window.editor.execute({ type: "replace-document", document: replacement });
    return before === JSON.stringify(window.editor.getDocument());
  });
  expect(unchanged).toBe(true);
});
test("editing stays local and respects reduced motion, plain paste and two-line boundary", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const remote: string[] = [];
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).origin !== "http://127.0.0.1:4173") {
      remote.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/tests/browser/host.html");
  const input = page.locator("#editor [data-editor-field=motd] .ProseMirror");
  await input.click();
  await page.keyboard.press("Control+Home");
  await page.evaluate(() => {
    const d = new DataTransfer();
    d.setData("text/plain", "<red>literal");
    d.setData("text/html", "<img src=x onerror=alert(1)>");
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: d,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(input).toContainText("<red>literal");
  await expect(input.locator("img")).toHaveCount(0);
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  expect(await input.locator("p").count()).toBe(2);
  expect(remote).toEqual([]);
});
test("image crop uses the requested source square", async ({ page }) => {
  await page.goto("/tests/browser/host.html");
  const result = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "red";
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = "blue";
    g.fillRect(64, 0, 64, 64);
    const blob = await new Promise<Blob>((r) =>
      c.toBlob((b) => r(b!), "image/jpeg"),
    );
    const output = await window.dom.normalizeIcon(blob, {
      crop: { x: 64, y: 0, width: 64, height: 64 },
    });
    const image = new Image();
    image.src = "data:image/png;base64," + output.value.pngBase64;
    await image.decode();
    g.drawImage(image, 0, 0);
    return [...g.getImageData(32, 32, 1, 1).data];
  });
  expect(result[2]).toBeGreaterThan(240);
  expect(result[0]).toBeLessThan(15);
});
