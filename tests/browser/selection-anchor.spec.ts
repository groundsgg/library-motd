import { expect, test, type Frame, type Page } from "@playwright/test";
for (const iframe of [false, true])
  test(`selection tool follows its text anchor through scroll${iframe ? " inside an iframe" : ""}`, async ({
    page,
    baseURL,
  }) => {
    let owner: Page | Frame = page;
    if (iframe) {
      await page.setContent(
        `<iframe src="${new URL("/tests/browser/host.html", baseURL!).href}" style="width:1000px;height:800px"></iframe>`,
      );
      owner = (await (await page
        .locator("iframe")
        .elementHandle())!.contentFrame())!;
    } else await page.goto("/tests/browser/host.html");
    await owner.waitForFunction(() => !!window.editor);
    await owner.evaluate((scaled) => {
      document.querySelector("#preview").remove();
      document.querySelector("#second").remove();
      const scroll = document.createElement("div");
      scroll.id = "anchor-scroll";
      Object.assign(scroll.style, {
        position: "absolute",
        left: "180px",
        top: "100px",
        width: "620px",
        height: "550px",
        overflow: "auto",
      });
      const before = document.createElement("div"),
        after = document.createElement("div");
      before.style.height = "220px";
      after.style.height = "600px";
      scroll.append(before, document.querySelector("#editor"), after);
      document.body.append(scroll);
      window.setEditorOptions({
        toolbar: "selection",
        context: {
          ...window.context,
          presentation: "row",
          guiScale: scaled ? 1.5 : 1,
        },
      });
      window.editor.execute({ type: "replace-source", source: "Anchor text" });
    }, iframe);
    const input = owner.getByRole("textbox", {
      name: "MOTD inline editor",
      exact: true,
    });
    await input.focus();
    await input.press("Control+Home");
    await input.press("Shift+ArrowRight");
    await input.press("Alt+F10");
    await owner
      .getByRole("toolbar", { name: "Text formatting", exact: true })
      .waitFor();
    const anchor = await input.evaluate((node) => {
      const rect = node.querySelector("p").getBoundingClientRect();
      return { left: rect.left, bottom: rect.bottom };
    });
    await owner
      .getByRole("button", { name: "Text color", exact: true })
      .click();
    const dialog = owner.getByRole("dialog", {
      name: "Text color",
      exact: true,
    });
    await dialog.getByLabel("Hex color").focus();
    await owner.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const at = await dialog.evaluate((node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y };
    });
    expect(Math.abs(at.x - anchor.left)).toBeLessThan(20);
    expect(Math.abs(at.y - anchor.bottom - 8)).toBeLessThan(20);
    await owner
      .locator("#anchor-scroll")
      .evaluate((node) => (node.scrollTop = 80));
    await expect
      .poll(async () =>
        dialog.evaluate((node) => node.getBoundingClientRect().top),
      )
      .toBeCloseTo(at.y - 80, 0);
    const after = await dialog.evaluate(
      (node) => node.getBoundingClientRect().left,
    );
    expect(Math.abs(after - at.x)).toBeLessThan(2);
    await owner.evaluate(() =>
      window.setEditorOptions({
        context: { ...window.editorOptions.context, guiScale: 2 },
      }),
    );
    const changed = await input.evaluate((node) => {
      const r = node.querySelector("p").getBoundingClientRect();
      return { x: r.left, y: r.bottom };
    });
    await expect
      .poll(() => dialog.evaluate((node) => node.getBoundingClientRect().left))
      .toBeCloseTo(changed.x, 0);
    await expect
      .poll(() => dialog.evaluate((node) => node.getBoundingClientRect().top))
      .toBeCloseTo(changed.y + 8, 0);
  });
