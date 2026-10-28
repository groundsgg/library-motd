import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";

const nativeAnchor = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/client/native-runtime-geometry/1.21.1/frame-anchors.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

async function mount(
  page: Page,
  source = "<white>A<b>B</b> A",
  mode = "mixed",
  scale = 2,
) {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor);
  return page.evaluate(
    async ({ source, mode, scale }) => {
      const fonts = await import("/src/fonts/index.ts");
      const pixels = new Uint8Array(64);
      pixels.set([255, 255, 255, 1], 0);
      pixels.set([190, 80, 60, 128], 20);
      pixels.set([91, 160, 200, 255], 56);
      const bitmap = fonts.decodeBitmapGlyphs(
        { height: 8, ascent: 7, chars: ["A"] },
        { width: 4, height: 4, pixels },
      ).value;
      window.fontReads = 0;
      const read = bitmap.pixelsFor;
      const set = {
        ...bitmap,
        pixelsFor(cp) {
          window.fontReads++;
          if (mode === "bad") throw Error("private failure");
          return read(cp);
        },
      };
      const unihex = fonts.decodeUnihexGlyphs({}, [
        new TextEncoder().encode("0042:" + "38".repeat(16)),
      ]).value;
      window.runtimeSource = fonts.createFontGlyphSource([
        { type: "bitmap", glyphs: set },
        { type: "unihex", glyphs: unihex },
        { type: "space", advances: { " ": 1.5, e: 1, "\u0301": 0, "😀": 3 } },
      ]).value;
      window.doc = window.api.createDocument(
        window.api.parseText(source, "minimessage").value,
      );
      window.context = {
        ...window.context,
        profile: window.api.java263Profile,
        guiScale: scale,
        animations: false,
      };
      window.preview.update({
        document: window.doc,
        context: window.context,
        motdFontSource: window.runtimeSource,
      });
      return JSON.stringify(window.doc);
    },
    { source, mode, scale },
  );
}

for (const dpr of [1, 2])
  test.describe(`runtime fonts DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    for (const scale of [1, 2, 3])
      test(`draws supplied RGBA and provider widths at GUI ${scale}`, async ({
        page,
      }) => {
        const original = await mount(
          page,
          "<white>A<b>B</b> A",
          "mixed",
          scale,
        );
        await expect(page.locator("#preview .mcp-runtime-glyph")).toHaveCount(
          4,
        );
        await expect(page.locator("#preview .mcp-runtime-ink")).toHaveCount(3);
        const observed = await page.evaluate(() => ({
          widths: [
            ...document.querySelectorAll("#preview .mcp-motd .mcp-glyph"),
          ].map((s) => parseFloat(s.style.width)),
          colors: [
            ...document.querySelectorAll("#preview .mcp-runtime-ink"),
          ].flatMap((c) => [
            ...c.getContext("2d").getImageData(0, 0, c.width, c.height).data,
          ]),
          reads: window.fontReads,
          saved: JSON.stringify(window.doc),
        }));
        expect(observed.widths).toEqual([7, 2.5, 1.5, 7]);
        expect(observed.reads).toBe(1);
        expect(observed.saved).toBe(original);
        expect(
          observed.colors.some(
            (alpha, i) => i % 4 === 3 && alpha > 0 && alpha < 255,
          ),
        ).toBe(true);
        expect(
          observed.colors.some(
            (_, i, a) =>
              i % 4 === 0 &&
              a[i] === 91 &&
              a[i + 1] === 160 &&
              a[i + 2] === 200 &&
              a[i + 3] === 255,
          ),
        ).toBe(true);
      });
  });

test("keeps missing glyphs explicit and does not replace a failed raster with browser text", async ({
  page,
}) => {
  await mount(page, "AZ", "bad");
  const diagnostics = await page.evaluate(() =>
    window.preview.getDiagnostics(),
  );
  expect(diagnostics.some((d) => d.code === "missing-glyph")).toBe(true);
  expect(diagnostics.some((d) => d.code === "font-source-raster")).toBe(true);
  expect(JSON.stringify(diagnostics)).not.toContain("private failure");
  await expect(page.locator("#preview .mcp-runtime-glyph")).toHaveCount(2);
  await expect(page.locator("#preview .mcp-runtime-ink")).toHaveCount(0);
});

test("releases source caches on replacement and keeps viewers and the editor independent", async ({
  page,
}) => {
  await mount(page, "A");
  await page.evaluate(() => {
    window.preview.update({
      document: window.doc,
      context: window.context,
      motdFontSource: window.runtimeSource,
    });
    window.second.update({
      document: window.doc,
      context: window.context,
      motdFontSource: window.runtimeSource,
    });
  });
  expect(await page.evaluate(() => window.fontReads)).toBe(2);
  await expect(page.locator("#editor .mcp-runtime-glyph")).toHaveCount(0);
  await page.evaluate(() =>
    window.preview.update({ document: window.doc, context: window.context }),
  );
  await expect(page.locator("#preview .mcp-runtime-glyph")).toHaveCount(0);
  await expect(page.locator("#second .mcp-runtime-glyph")).toHaveCount(1);
  await page.evaluate(() =>
    window.preview.update({
      document: window.doc,
      context: window.context,
      motdFontSource: window.runtimeSource,
    }),
  );
  expect(await page.evaluate(() => window.fontReads)).toBe(3);
  await page.evaluate(() => window.preview.destroy());
  await expect(page.locator("#preview .mcp-wrap")).toHaveCount(0);
});

test("renders scalar combining and supplementary glyphs with placeholders and two-line clipping", async ({
  page,
}) => {
  await mount(page, "e\u0301😀<newline>{{word}}<newline>A");
  await page.evaluate(() => {
    window.context = { ...window.context, values: { word: "AB" } };
    window.preview.update({
      document: window.doc,
      context: window.context,
      motdFontSource: window.runtimeSource,
    });
  });
  await expect(page.locator("#preview .mcp-runtime-glyph")).toHaveCount(5);
  expect(
    await page.locator("#preview .mcp-motd").getAttribute("aria-label"),
  ).toContain("é😀AB");
  expect(
    await page.evaluate(() =>
      window.preview.getDiagnostics().some((d) => d.code === "hidden-lines"),
    ),
  ).toBe(true);
});

test("bounds the total active canvas storage for repeated oversized transparent glyphs", async ({
  page,
}) => {
  await mount(page, "A");
  const observed = await page.evaluate(async () => {
    const fonts = await import("/src/fonts/index.ts");
    const set = fonts.decodeBitmapGlyphs(
      { height: 1024, ascent: 7, chars: ["A"] },
      { width: 512, height: 512, pixels: new Uint8Array(512 * 512 * 4) },
    ).value;
    const motdFontSource = fonts.createFontGlyphSource([
      { type: "bitmap", glyphs: set },
    ]).value;
    const document = window.api.createDocument(
      window.api.parseText("A".repeat(300), "minimessage").value,
    );
    window.preview.update({
      document,
      context: window.context,
      motdFontSource,
    });
    return {
      bytes: [
        ...window.document.querySelectorAll("#preview .mcp-runtime-ink"),
      ].reduce((sum, c) => sum + c.width * c.height * 4, 0),
      limited: window.preview
        .getDiagnostics()
        .some((d) => d.code === "font-runtime-limit"),
    };
  });
  expect(observed.bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
  expect(observed.limited).toBe(true);
});

for (const [profile, canvases] of [
  ["java-26.3", 8],
  ["java-1.21.1", 10],
] as const)
  test(`React viewer mounts, updates and unmounts an explicit local font source for ${profile}`, async ({
    page,
  }) => {
    await page.goto("/examples/react/");
    await page.getByLabel("Client version").selectOption(profile);
    await page.getByLabel("Show local font example").check();
    await expect(
      page.locator("#runtime-font-example .mcp-runtime-ink"),
    ).toHaveCount(canvases);
    await page
      .getByLabel("Presentation", { exact: true })
      .selectOption("server-list");
    await expect(
      page.locator("#runtime-font-example .mcp-menu-title"),
    ).toBeVisible();
    await expect(page.locator(".mce-root .mcp-runtime-glyph")).toHaveCount(0);
    await page.getByLabel("Show local font example").uncheck();
    await expect(page.locator("#runtime-font-example")).toHaveCount(0);
  });

test("runtime obfuscation redraws candidate metrics and respects reduced motion and pause", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await mount(page, "A");
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  await page.evaluate(async () => {
    const fonts = await import("/src/fonts/index.ts");
    const bitmap = fonts.decodeBitmapGlyphs(
      { height: 1, ascent: 1, chars: ["A"] },
      { width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) },
    ).value;
    const unihex = fonts.decodeUnihexGlyphs({}, [
      new TextEncoder().encode("0042:" + "38".repeat(16)),
    ]).value;
    window.runtimeSource = fonts.createFontGlyphSource([
      { type: "bitmap", glyphs: bitmap },
      { type: "unihex", glyphs: unihex },
    ]).value;
    Math.random = () => 0;
    window.doc = window.api.createDocument(
      window.api.parseText("<obf><b>AA", "minimessage").value,
    );
    window.context = { ...window.context, animations: true };
    window.preview.update({
      document: window.doc,
      context: window.context,
      motdFontSource: window.runtimeSource,
    });
  });
  expect(
    await page
      .locator("#preview .mcp-motd .mcp-glyph")
      .first()
      .evaluate((s) => s.style.width),
  ).toBe("3px");
  await page.evaluate(() => {
    window.runtimeRandomCalls = 0;
    Math.random = () => {
      window.runtimeRandomCalls++;
      return 0.99;
    };
  });
  await page.clock.runFor(20);
  expect(
    await page
      .locator("#preview .mcp-motd .mcp-glyph")
      .first()
      .evaluate((s) => s.style.width),
  ).toBe("2.5px");
  expect(
    await page
      .locator("#preview .mcp-motd .mcp-glyph")
      .last()
      .evaluate((s) => s.style.left),
  ).toBe("2.5px");
  await page.evaluate(() => {
    window.runtimeMediaChanges = 0;
    window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .addEventListener("change", () => window.runtimeMediaChanges++);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  // WebKit delivers native media changes outside the mocked animation clock.
  await expect
    .poll(() => page.evaluate(() => window.runtimeMediaChanges))
    .toBe(1);
  const calls = await page.evaluate(() => window.runtimeRandomCalls);
  await page.clock.runFor(100);
  expect(await page.evaluate(() => window.runtimeRandomCalls)).toBe(calls);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect
    .poll(() => page.evaluate(() => window.runtimeMediaChanges))
    .toBe(2);
  await page.clock.runFor(20);
  expect(await page.evaluate(() => window.runtimeRandomCalls)).toBeGreaterThan(
    calls,
  );
  await page.evaluate(() => {
    window.context = { ...window.context, animations: false };
    window.preview.update({
      document: window.doc,
      context: window.context,
      motdFontSource: window.runtimeSource,
    });
  });
  const paused = await page.evaluate(() => window.runtimeRandomCalls);
  await page.clock.runFor(100);
  expect(await page.evaluate(() => window.runtimeRandomCalls)).toBe(paused);
});

test("uncalibrated profile geometry does not guess imported rendering or read its pixels", async ({
  page,
}) => {
  await mount(page, "A");
  await page.evaluate(() => {
    window.context = { ...window.context, profile: window.api.java1204Profile };
    window.preview.update({
      document: window.doc,
      context: window.context,
      motdFontSource: window.runtimeSource,
    });
  });
  await expect(page.locator("#preview .mcp-runtime-glyph")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.preview
        .getDiagnostics()
        .some((d) => d.code === "font-runtime-profile"),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => window.fontReads)).toBe(1);
  await expect(page.locator("#preview .mcp-wrap")).toHaveAttribute(
    "data-profile-verified",
    "false",
  );
});

test("legacy text passes keep earlier foreground over later shadows and redraw the same source for26.3", async ({
  page,
}) => {
  await mount(page, "A");
  const saved = await page.evaluate(async () => {
    const fonts = await import("/src/fonts/index.ts");
    const solid = fonts.decodeBitmapGlyphs(
      { height: 4, ascent: 4, chars: ["A"] },
      { width: 4, height: 4, pixels: new Uint8Array(64).fill(255) },
    ).value;
    const top = new Uint8Array(16);
    top.fill(255, 0, 4);
    const strip = fonts.decodeBitmapGlyphs(
      { height: 4, ascent: 4, chars: ["B"] },
      { width: 1, height: 4, pixels: top },
    ).value;
    window.legacyReads = 0;
    const counted = (glyphs) => ({
      ...glyphs,
      pixelsFor(cp) {
        window.legacyReads++;
        return glyphs.pixelsFor(cp);
      },
    });
    window.legacySource = fonts.createFontGlyphSource([
      { type: "bitmap", glyphs: counted(solid) },
      { type: "bitmap", glyphs: counted(strip) },
      { type: "space", advances: { " ": -3 } },
    ]).value;
    window.doc = window.api.createDocument(
      window.api.parseText("<white>A B", "minimessage").value,
    );
    window.context = {
      ...window.context,
      background: "none",
      profile: {
        ...window.api.java1211Profile,
        geometry: { ...window.api.java1211Profile.geometry, motdShadow: true },
      },
    };
    window.preview.update({
      document: window.doc,
      context: window.context,
      motdFontSource: window.legacySource,
    });
    return JSON.stringify(window.doc);
  });
  await expect(page.locator("#preview .mcp-runtime-ink")).toHaveCount(4);
  const pixel = async (y = 9) => {
    const image = PNG.sync.read(
      await page.locator("#preview .mcp-motd").screenshot(),
    );
    return [
      ...image.data.subarray(
        (y * image.width + 9) * 4,
        (y * image.width + 9) * 4 + 4,
      ),
    ];
  };
  expect(await pixel(11)).toEqual([255, 255, 255, 255]);
  await page.evaluate(() => {
    window.context = { ...window.context, profile: window.api.java263Profile };
    window.preview.update({
      document: window.doc,
      context: window.context,
      motdFontSource: window.legacySource,
    });
  });
  await expect(page.locator("#preview .mcp-runtime-ink")).toHaveCount(2);
  expect(await pixel()).toEqual([63, 63, 63, 255]);
  expect(await page.evaluate(() => window.legacyReads)).toBe(2);
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(saved);
});

test("legacy supplied glyphs use the native MOTD origin and preserve the sampled two-line underline depth", async ({
  page,
}) => {
  await mount(page, "A");
  await page.evaluate(async () => {
    const fonts = await import("/src/fonts/index.ts");
    const bitmap = fonts.decodeBitmapGlyphs(
      { height: 14, ascent: 14, chars: ["A"] },
      { width: 1, height: 14, pixels: new Uint8Array(56).fill(255) },
    ).value;
    const motdFontSource = fonts.createFontGlyphSource([
      { type: "bitmap", glyphs: bitmap },
    ]).value;
    window.doc = window.api.createDocument(
      window.api.parseText("<red><u>A</u></red>\n<green>A", "minimessage")
        .value,
    );
    window.context = {
      ...window.context,
      profile: window.api.java1211Profile,
      guiScale: 2,
      background: "none",
    };
    window.preview.update({
      document: window.doc,
      context: window.context,
      motdFontSource,
    });
  });
  const image = PNG.sync.read(
    await page.locator("#preview .mcp-row").screenshot(),
  );
  const points = [];
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if (
        image.data[i] === 85 &&
        image.data[i + 1] === 255 &&
        image.data[i + 2] === 85
      )
        points.push([x, y]);
    }
  const bounds = [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
  expect(bounds).toEqual(
    nativeAnchor.samples.secondLineGreen.boundsRelativeToIcon,
  );
  expect(points).toHaveLength(nativeAnchor.samples.secondLineGreen.pixelCount);
  for (const y of [40, 41])
    for (let x = 68; x <= 73; x++) {
      const i = (y * image.width + x) * 4;
      expect([...image.data.subarray(i, i + 4)]).toEqual(
        nativeAnchor.samples.firstLineUnderline.rgba,
      );
    }
});

for (const failure of [2, 4])
  test(`legacy glyph discards staged layers if canvas context ${failure} fails`, async ({
    page,
  }) => {
    await mount(page, "A");
    const result = await page.evaluate(async (failure) => {
      const { RuntimeFontPainter } = await import("/src/dom/font/runtime.ts");
      const span = document.createElement("span"),
        painter = new RuntimeFontPainter(window.runtimeSource);
      const original = HTMLCanvasElement.prototype.getContext;
      const canvases: HTMLCanvasElement[] = [];
      HTMLCanvasElement.prototype.getContext = function (...args) {
        canvases.push(this);
        return canvases.length === failure
          ? null
          : Reflect.apply(original, this, args);
      };
      try {
        const diagnostics = painter.paint(
          span,
          window.runtimeSource.glyphFor(65),
          { underlined: true },
          0,
          0,
          7,
          "#ffffff",
          true,
          2,
          { left: -1, top: 0, right: 100, bottom: 40 },
          "java-1.21.1",
        );
        return {
          diagnostics,
          visible: span.childElementCount,
          storage: canvases.map((c) => c.width * c.height),
          contexts: canvases.length,
        };
      } finally {
        HTMLCanvasElement.prototype.getContext = original;
        painter.destroy();
      }
    }, failure);
    expect(result.contexts).toBe(failure);
    expect(result.diagnostics.map((d) => d.code)).toEqual([
      "font-runtime-unavailable",
    ]);
    expect(result.visible).toBe(0);
    expect(result.storage.every((size) => size === 0)).toBe(true);
  });

test("comparisons expose and display raster failures from a later obfuscation frame", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await mount(page, "A");
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  await page.evaluate(async () => {
    const fonts = await import("/src/fonts/index.ts");
    const glyphs = fonts.decodeBitmapGlyphs(
      { height: 1, ascent: 1, chars: ["AB"] },
      {
        width: 2,
        height: 1,
        pixels: new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]),
      },
    ).value;
    const motdFontSource = fonts.createFontGlyphSource([
      {
        type: "bitmap",
        glyphs: {
          ...glyphs,
          pixelsFor(cp) {
            return cp === 66 ? undefined : glyphs.pixelsFor(cp);
          },
        },
      },
    ]).value;
    Math.random = () => 0;
    window.preview.destroy();
    window.comparison = window.dom.createComparison(
      document.querySelector("#preview"),
      {
        document: window.api.createDocument(
          window.api.parseText("<obf>A", "minimessage").value,
        ),
        clients: [
          {
            id: "one",
            context: { ...window.context, animations: true },
            motdFontSource,
          },
        ],
      },
    );
  });
  await expect(page.locator("#preview .mcp-runtime-ink")).toHaveCount(1);
  await page.evaluate(() => {
    Math.random = () => 0.99;
  });
  await page.clock.runFor(40);
  await expect(page.locator("#preview .mcp-runtime-ink")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.comparison
        .getDiagnostics()
        .get("one")
        .some((d) => d.code === "font-source-raster"),
    ),
  ).toBe(true);
  await expect(
    page.locator(
      "#preview .mcp-comparison-diagnostics [data-code=font-source-raster]",
    ),
  ).toHaveCount(1);
});
