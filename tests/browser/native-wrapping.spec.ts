import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";

const versions = [
  "1.20.4",
  "1.21.1",
  "1.21.11",
  "26.1",
  "26.1.1",
  "26.1.2",
  "26.2",
  "26.3",
];
const foreground = (im: PNG) =>
  Array.from({ length: im.width * im.height }, (_, i) => {
    const [r, g, b] = im.data.subarray(i * 4, i * 4 + 3);
    return process.platform === "win32"
      ? Number(r! > 200 && g! > 130 && b! < 40)
      : Number(r === 255 && g === 170 && b === 0);
  });
test.use({ screenshot: "only-on-failure" });

for (const version of versions) {
  const path = `tests/fixtures/client/native-wrapping/${version}`;
  const manifest = JSON.parse(
    readFileSync(`${path}/manifest.json`, "utf8"),
  ) as {
    cases: { id: string; description: unknown }[];
  };
  for (const c of manifest.cases.filter((c) => c.id !== "unicode-boundaries"))
    test(`native ${version} ${c.id} wraps identically in viewer and editor`, async ({
      page,
    }) => {
      await page.goto("/tests/browser/host.html");
      await page.waitForFunction(() => !!window.editor);
      await page.evaluate(
        ({ version, description }) => {
          window.doc = window.api.createDocument(
            window.api.parseText(JSON.stringify(description), "json").value!,
          );
          window.context = {
            ...window.context,
            profile: window.api.clientProfiles.find(
              (p) => p.clientVersion === version,
            )!,
            viewportWidth: 854,
            viewportHeight: 480,
            animations: false,
          };
          window.preview.update({
            document: window.doc,
            context: window.context,
          });
          window.setEditorOptions({ context: window.context });
        },
        { version, description: c.description },
      );
      await page.evaluate(() => document.fonts.ready);
      const native = PNG.sync.read(readFileSync(`${path}/${c.id}.png`));
      for (const host of ["preview", "editor"]) {
        const row = PNG.sync.read(
          await page.locator(`#${host} .mcp-row`).screenshot(),
        );
        const crop = new PNG({ width: native.width, height: 42 });
        PNG.bitblt(row, crop, 68, 22, native.width, 42, 0, 0);
        const reference = foreground(native);
        expect
          .soft(
            foreground(crop).filter((v, i) => v !== reference[i]).length,
            host,
          )
          .toBe(0);
      }
    });
}

test("word breaks preserve editable spaces, selection, formatting and undo", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() => {
    window.editor.execute({
      type: "replace-source",
      source: `<gold>${"M".repeat(38)} Hello world Z`,
    });
  });
  const input = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await input.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("!");
  expect(await input.textContent()).toContain(" Hello world Z!");
  await page.keyboard.press("Control+z");
  expect(await input.textContent()).toContain(" Hello world Z");
  expect(await input.textContent()).not.toContain("!");
  const source = await page.evaluate(
    () =>
      window.api.serializeText(window.doc.motd.text, { format: "minimessage" })
        .value,
  );
  expect(source).toContain(" Hello world Z");
  expect(source).not.toContain("<newline>");
  await input.focus();
  await input.press("Control+A");
  // Browser Selection.toString includes display-only BRs. Clipboard export must
  // use the semantic PM selection and retain the consumed source delimiter.
  const copied = await page.evaluate(() => {
    const data = new DataTransfer();
    const event = new ClipboardEvent("copy", {
      bubbles: true,
      cancelable: true,
      clipboardData: data,
    });
    document
      .querySelector("#editor [data-editor-field=motd] .ProseMirror")!
      .dispatchEvent(event);
    return event.clipboardData?.getData("text/plain");
  });
  expect(copied).toBe("M".repeat(38) + " Hello world Z");
  const bold = page.getByRole("button", { name: "Bold", exact: true });
  await bold.click();
  expect(
    await page.evaluate(() =>
      window.api.flattenText(window.doc.motd.text).every((g) => g.style.bold),
    ),
  ).toBe(true);
  await bold.click();
  expect(
    await page.evaluate(() =>
      window.api.flattenText(window.doc.motd.text).some((g) => g.style.bold),
    ),
  ).toBe(false);
});

test("protected JSON fallbacks wrap visually without replacing the source component", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() => {
    window.context = {
      ...window.context,
      profile: window.api.java263Profile,
      viewportWidth: 854,
    };
    window.doc = window.api.createDocument(
      window.api.parseText(
        JSON.stringify({
          text: "",
          color: "gold",
          extra: [
            {
              text: "M".repeat(38) + " Hello world Z",
              clickEvent: { action: "run_command", value: "/demo" },
            },
          ],
        }),
        "json",
      ).value!,
    );
    window.setEditorOptions({ context: window.context });
    window.preview.update({ document: window.doc, context: window.context });
  });
  await page.evaluate(() => document.fonts.ready);
  const a = foreground(
    PNG.sync.read(await page.locator("#preview .mcp-row").screenshot()),
  );
  const b = foreground(
    PNG.sync.read(await page.locator("#editor .mcp-row").screenshot()),
  );
  expect(b.filter((v, i) => v !== a[i]).length).toBe(0);
  await expect(page.locator("#editor .mce-token")).toHaveCount(1);
  expect(
    await page.evaluate(
      () =>
        window.api.serializeText(window.doc.motd.text, { format: "json" })
          .value,
    ),
  ).toContain("clickEvent");
});

test("resolved atomic values use native visual breaks and retain one source token", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  await page.evaluate(() => {
    window.context = {
      ...window.context,
      profile: window.api.java263Profile,
      values: { long: "M".repeat(38) + " Hello world Z" },
    };
    window.setEditorOptions({ context: window.context });
    window.editor.execute({ type: "replace-source", source: "<gold>{{long}}" });
    window.preview.update({ document: window.doc, context: window.context });
  });
  await page.evaluate(() => document.fonts.ready);
  const a = foreground(
    PNG.sync.read(await page.locator("#preview .mcp-row").screenshot()),
  );
  const b = foreground(
    PNG.sync.read(await page.locator("#editor .mcp-row").screenshot()),
  );
  expect(b).toEqual(a);
  await expect(page.locator("#editor .mce-token")).toHaveCount(1);
  expect(
    await page.evaluate(
      () =>
        window.api.serializeText(window.doc.motd.text, {
          format: "minimessage",
        }).value,
    ),
  ).toContain("{{long}}");
});

for (const variant of [
  "single-leading-space",
  "center-right",
  "token-newlines",
  "resize",
])
  test(`shared visual lines handle ${variant} without source changes`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/host.html");
    await page.waitForFunction(() => !!window.editor);
    await page.evaluate((variant) => {
      window.context = {
        ...window.context,
        profile: window.api.java263Profile,
        values: { long: "M".repeat(38) + " Hello\nM" },
      };
      window.doc = window.api.createDocument(
        window.api.parseText(
          variant === "single-leading-space"
            ? "<gold> " + "M".repeat(45)
            : variant === "token-newlines"
              ? "<gold>{{long}}"
              : "<gold>" + "M".repeat(38) + " Hello world Z",
          "minimessage",
        ).value!,
      );
      if (variant === "center-right")
        window.doc.motd.alignments = ["center", "right"];
      window.setEditorOptions({ context: window.context });
      window.preview.update({ document: window.doc, context: window.context });
    }, variant);
    const before = await page.evaluate(() => JSON.stringify(window.doc));
    for (const width of variant === "resize" ? [500, 854] : [854]) {
      await page.evaluate((width) => {
        window.context = { ...window.context, viewportWidth: width };
        window.setEditorOptions({ context: window.context });
        window.preview.update({
          document: window.doc,
          context: window.context,
        });
      }, width);
      await page.evaluate(() => document.fonts.ready);
      const a = foreground(
        PNG.sync.read(await page.locator("#preview .mcp-row").screenshot()),
      );
      const b = foreground(
        PNG.sync.read(await page.locator("#editor .mcp-row").screenshot()),
      );
      expect(b.filter((v, i) => v !== a[i]).length).toBe(0);
    }
    expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(before);
  });
