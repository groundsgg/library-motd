import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

const nativePrefix = "/_motd/vanilla-sprites/";
async function supplyVanillaAssets(page: import("@playwright/test").Page) {
  const png = new PNG({ width: 1, height: 1 });
  png.data.set([255, 255, 255, 255]);
  const pixels = PNG.sync.write(png);
  await page.route(`**${nativePrefix}**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const version = path.slice(nativePrefix.length).split("/")[0];
    if (path.endsWith("manifest.json"))
      await route.fulfill({
        json: {
          schemaVersion: 1,
          clientVersion: version,
          sprites: {
            "minecraft:icon/trial_available": {
              frames: [
                {
                  url: `${nativePrefix}${version}/icon/trial_available-0.png`,
                  ticks: 10,
                },
                {
                  url: `${nativePrefix}${version}/icon/trial_available-1.png`,
                  ticks: 2,
                },
              ],
            },
          },
        },
      });
    else await route.fulfill({ contentType: "image/png", body: pixels });
  });
}

for (const adapter of ["dom", "react"])
  test(`${adapter} defaults to Vanilla choices and keeps native source across client changes`, async ({
    page,
  }) => {
    await supplyVanillaAssets(page);
    await page.goto(`/examples/${adapter}/`);
    await expect(
      page.getByText("Vanilla sprite resources are ready.", { exact: true }),
    ).toBeVisible();
    await page.locator(".ProseMirror").first().click();
    const insert = page.getByRole("button", {
      name: "Insert sprite",
      exact: true,
    });
    await insert.click();
    await expect(
      page.getByRole("button", { name: /Demo pulse|Demo gem/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Trial available · Animated",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Heart · Static", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Trial available · Animated", exact: true })
      .click();
    await expect(
      page.locator('.mcp-sprite[data-sprite-state="ready"]'),
    ).toHaveCount(2);
    await page.getByLabel("Client version").selectOption("java-1.21.1");
    await page.locator(".ProseMirror").first().click();
    await expect(insert).toHaveCount(0);
    await expect(
      page.locator('.mcp-sprite[data-sprite-state="ready"]'),
    ).toHaveCount(0);
    await page.getByLabel("Client version").selectOption("java-26.3");
    await expect(
      page.locator('.mcp-sprite[data-sprite-state="ready"]'),
    ).toHaveCount(2);
  });

test("unconfigured original assets stay missing instead of using invented demo artwork", async ({
  page,
}) => {
  await page.route(`**${nativePrefix}**`, (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.goto("/examples/react/");
  await expect(
    page.getByText(
      "Original Vanilla sprite resources are not configured for this preview.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.locator(".ProseMirror").first().click();
  await page
    .getByRole("button", { name: "Insert sprite", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Trial available · Animated", exact: true })
    .click();
  await expect(
    page.locator('.mcp-sprite[data-sprite-state="failed"]'),
  ).toHaveCount(2);
});
for (const adapter of ["dom", "react"])
  test(`${adapter} ignores a stale Vanilla resource load after switching clients`, async ({
    page,
  }) => {
    await supplyVanillaAssets(page);
    await page.addInitScript(() => {
      const original = window.fetch.bind(window);
      window.fetch = (input, options) => {
        if (String(input).endsWith("/26.3/manifest.json"))
          return new Promise<Response>((resolve) => {
            (window as any).releaseOldVanilla = async () => {
              resolve(await original(input, { ...options, signal: undefined }));
            };
          });
        return original(input, options);
      };
    });
    await page.goto(`/examples/${adapter}/`);
    await page.waitForFunction(
      () => typeof (window as any).releaseOldVanilla === "function",
    );
    await page.getByLabel("Client version").selectOption("java-1.21.11");
    await expect(
      page.getByText("Vanilla sprite resources are ready.", { exact: true }),
    ).toBeVisible();
    await page.evaluate(async () => {
      await (window as any).releaseOldVanilla();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    await expect(
      page.getByText("Vanilla sprite resources are ready.", { exact: true }),
    ).toBeVisible();
    await page.locator(".ProseMirror").first().click();
    await page
      .getByRole("button", { name: "Insert sprite", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Trial available · Animated", exact: true })
      .click();
    await expect(
      page.locator('.mcp-sprite[data-sprite-state="ready"]'),
    ).toHaveCount(2);
  });

async function setup(page: import("@playwright/test").Page) {
  await page.goto("/tests/browser/host.html");
  await page.evaluate(() => {
    const w = window as any,
      { api, dom } = w;
    w.editor.destroy();
    w.preview.destroy();
    const image = (color: string) => {
      const c = document.createElement("canvas");
      c.width = c.height = 8;
      const g = c.getContext("2d")!;
      g.fillStyle = color;
      g.fillRect(0, 0, 8, 8);
      return c.toDataURL();
    };
    w.spriteContext = {
      ...w.context,
      profile: api.java263Profile,
      clientProtocol: 777,
      animations: false,
      spriteProvider: () => ({
        frames: [
          { url: image("#ff0000"), ticks: 2 },
          { url: image("#0000ff"), ticks: 2 },
        ],
      }),
    };
    w.spriteDoc = api.createDocument(
      api.parseText(
        '<white>A<sprite:"minecraft:gui":"grounds:star">B</white>',
        "minimessage",
      ).value,
    );
    w.preview = dom.createPreview(document.querySelector("#preview"), {
      document: w.spriteDoc,
      context: w.spriteContext,
    });
    w.spriteOptions = {
      document: w.spriteDoc,
      context: w.spriteContext,
      spriteCatalog: [
        {
          atlas: "minecraft:gui",
          sprite: "grounds:star",
          label: "Grounds star",
          animated: true,
        },
      ],
      onChange: (d: any) => {
        w.spriteDoc = d;
      },
    };
    w.editor = dom.createEditor(
      document.querySelector("#editor"),
      w.spriteOptions,
    );
  });
}
test("host resources render as eight-pixel objects in viewer and editable atoms", async ({
  page,
}) => {
  await setup(page);
  const sprite = page.locator('#preview [data-sprite-state="ready"]');
  await expect(sprite).toHaveCount(1);
  await expect(page.locator('#editor [data-sprite-state="ready"]')).toHaveCount(
    1,
  );
  expect(
    await sprite.evaluate((e) => {
      const c = e.querySelector("canvas")!;
      return Array.from(c.getContext("2d")!.getImageData(0, 0, 1, 1).data);
    }),
  ).toEqual([255, 0, 0, 255]);
  const geometry = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#preview .mcp-motd .mcp-glyph")).map(
      (e) => parseFloat((e as HTMLElement).style.width),
    ),
  );
  expect(geometry).toEqual([6, 8, 6]);
});
test("native frame playback can pause and disabled features preserve imported sprites", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    const w = window as any;
    w.preview.update({
      document: w.spriteDoc,
      context: { ...w.spriteContext, animations: true },
    });
    w.editor.update({ ...w.spriteOptions, features: { sprites: false } });
  });
  const canvas = page.locator('#preview [data-sprite-state="ready"] canvas');
  await expect(canvas).toHaveCount(1);
  const seen = await canvas.evaluate(async (c: HTMLCanvasElement) => {
    const values = new Set<string>();
    for (let i = 0; i < 25; i++) {
      values.add(String(c.getContext("2d")!.getImageData(0, 0, 1, 1).data));
      await new Promise((r) => setTimeout(r, 20));
    }
    return [...values];
  });
  expect(seen).toContain("255,0,0,255");
  expect(seen).toContain("0,0,255,255");
  await expect(page.locator('#editor [data-sprite-state="ready"]')).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("button", { name: "Insert sprite", exact: true }),
  ).toHaveCount(0);
});
test("sprite picker inserts one undoable atomic source component", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#editor .ProseMirror").click();
  await page
    .getByRole("button", { name: "Insert sprite", exact: true })
    .click();
  await page.getByRole("searchbox", { name: "Search sprites" }).fill("star");
  await expect(
    page.getByRole("button", { name: /Grounds star/ }),
  ).toHaveAccessibleName("Grounds star · Animated");
  await page.getByRole("button", { name: /Grounds star/ }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.stringify((window as any).spriteDoc).match(/"type":"sprite"/g)
          ?.length,
    ),
  ).toBe(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.stringify((window as any).spriteDoc).match(/"type":"sprite"/g)
          ?.length,
    ),
  ).toBe(1);
  const output = await page.evaluate(() => {
    const w = window as any;
    return w.api.serializeText(w.spriteDoc.motd.text, { format: "minimessage" })
      .value;
  });
  expect(output).toContain('<sprite:"minecraft:gui":"grounds:star">');
});

test("explicit zero shadow survives pixel text rendering as transparent shadow ink", async ({
  page,
}) => {
  await setup(page);
  const pixels = await page.evaluate(async () => {
    const w = window as any;
    const d = w.api.createDocument(
      w.api.parseText(
        "<shadow:#00000000><white>A</white></shadow>",
        "minimessage",
      ).value,
    );
    w.preview.update({ document: d, context: w.spriteContext });
    const glyph = document.querySelector<HTMLElement>(
      "#preview .mcp-motd .mcp-pixel-glyph",
    )!;
    const source = glyph.style
      .getPropertyValue("--mcp-ink-shadow")
      .slice(5, -2);
    const image = new Image();
    image.src = source;
    await image.decode();
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    const g = c.getContext("2d")!;
    g.drawImage(image, 0, 0);
    return Array.from(g.getImageData(0, 0, c.width, c.height).data)
      .filter((_, i) => i % 4 === 3)
      .reduce((a, b) => a + b, 0);
  });
  expect(pixels).toBe(0);
});

test("missing resources are diagnosed while native source is retained", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    const w = window as any;
    w.preview.update({
      document: w.spriteDoc,
      context: { ...w.spriteContext, spriteProvider: undefined },
    });
  });
  await expect(
    page.locator('#preview [data-sprite-state="failed"]'),
  ).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      (window as any).preview.getDiagnostics().map((d: any) => d.code),
    ),
  ).toContain("sprite-resource-missing");
  expect(
    await page.evaluate(() => JSON.stringify((window as any).spriteDoc)),
  ).toContain("grounds:star");
});

test("permissions and profile changes close stale sprite pickers without modifying content", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#editor .ProseMirror").click();
  await page
    .getByRole("button", { name: "Insert sprite", exact: true })
    .click();
  await expect(
    page.getByRole("searchbox", { name: "Search sprites" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const w = window as any;
    w.editor.update({ ...w.spriteOptions, readOnly: true });
  });
  await expect(
    page.getByRole("searchbox", { name: "Search sprites" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.stringify((window as any).spriteDoc).match(/"type":"sprite"/g)
          ?.length,
    ),
  ).toBe(1);
  await page.evaluate(() => {
    const w = window as any;
    w.editor.update({
      ...w.spriteOptions,
      context: { ...w.spriteContext, profile: w.api.java1211Profile },
    });
  });
  await page.locator("#editor .ProseMirror").click();
  await page
    .getByRole("button", { name: "Insert sprite", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Grounds star/ }),
  ).toBeDisabled();
});

test("asset loads do not restart during ordinary preview updates", async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.locator('#preview [data-sprite-state="ready"]'),
  ).toHaveCount(1);
  const result = await page.evaluate(async () => {
    const w = window as any,
      base = w.spriteContext.spriteProvider(),
      NativeImage = document.createElement.bind(document);
    let imageLoads = 0;
    const create = document.createElement.bind(document);
    document.createElement = ((name: string, ...args: any[]) => {
      const e = (create as any)(name, ...args);
      if (name === "img") {
        e.addEventListener("load", () => imageLoads++);
      }
      return e;
    }) as any;
    try {
      const context = { ...w.spriteContext, spriteProvider: () => base };
      w.preview.update({ document: w.spriteDoc, context });
      await new Promise((r) => setTimeout(r, 50));
      const first = imageLoads;
      for (let i = 0; i < 4; i++)
        w.preview.update({ document: w.spriteDoc, context });
      await new Promise((r) => setTimeout(r, 50));
      return { first, total: imageLoads };
    } finally {
      document.createElement = NativeImage;
    }
  });
  expect(result.first).toBe(0);
  expect(result.total).toBe(0);
});

test("sprite shader multiplies shadow texture colors and discards low alpha", async ({
  page,
}) => {
  await setup(page);
  for (const [alpha, shadowColor, wantFore, wantShadow] of [
    [255, undefined, [255, 0, 0, 255], [63, 0, 0, 255]],
    [25, 0, [0, 0, 0, 0], [0, 0, 0, 0]],
    [255, 0x80112233, [255, 0, 0, 255], [17, 0, 0, 128]],
  ] as const) {
    await page.evaluate(
      ({ alpha, shadowColor }) => {
        const w = window as any,
          c = document.createElement("canvas");
        c.width = c.height = 8;
        const g = c.getContext("2d")!;
        g.fillStyle = `rgba(255,0,0,${alpha / 255})`;
        g.fillRect(0, 0, 8, 8);
        const url = c.toDataURL();
        const doc = w.api.createDocument({
          revision: 0,
          nodes: [
            {
              id: "g",
              type: "group",
              style: {
                color: "#ffffff",
                ...(shadowColor === undefined ? {} : { shadowColor }),
              },
              children: [
                {
                  id: "s",
                  type: "sprite",
                  atlas: "minecraft:gui",
                  sprite: "grounds:star",
                },
              ],
            },
          ],
        });
        w.preview.update({
          document: doc,
          context: {
            ...w.spriteContext,
            spriteProvider: () => ({ frames: [{ url }] }),
          },
        });
      },
      { alpha, shadowColor },
    );
    const sprite = page.locator('#preview [data-sprite-state="ready"] canvas');
    await expect(sprite).toHaveCount(1);
    expect(
      await sprite.evaluate((c: HTMLCanvasElement) =>
        Array.from(c.getContext("2d")!.getImageData(0, 0, 1, 1).data),
      ),
    ).toEqual(wantFore);
    if (wantShadow[3] === 128) {
      // Canvas readback can quantize unpremultiplied RGB by one byte. Assert the
      // visible composition over black and the original alpha independently.
      expect(
        await sprite.evaluate(
          (c: HTMLCanvasElement) =>
            c.getContext("2d")!.getImageData(8, 8, 1, 1).data[3],
        ),
      ).toBe(128);
      expect(
        await sprite.evaluate((c: HTMLCanvasElement) => {
          const out = document.createElement("canvas");
          out.width = out.height = 9;
          const g = out.getContext("2d")!;
          g.fillStyle = "#000";
          g.fillRect(0, 0, 9, 9);
          g.drawImage(c, 0, 0);
          return Array.from(g.getImageData(8, 8, 1, 1).data);
        }),
      ).toEqual([9, 0, 0, 255]);
    } else
      expect(
        await sprite.evaluate((c: HTMLCanvasElement) =>
          Array.from(c.getContext("2d")!.getImageData(8, 8, 1, 1).data),
        ),
      ).toEqual(wantShadow);
  }
});

test("failed frames release rejected image data and cancel unused pending loads", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/sprite-never-finishes.png", () => {});
  await page.evaluate(() => {
    const w = window as any,
      c = document.createElement("canvas");
    c.width = 8;
    c.height = 9;
    const url = c.toDataURL();
    const create = document.createElement.bind(document);
    w.frameImages = [];
    document.createElement = ((name: string, ...args: any[]) => {
      const e = (create as any)(name, ...args);
      if (name === "img") w.frameImages.push(e);
      return e;
    }) as any;
    try {
      w.preview.update({
        document: w.spriteDoc,
        context: {
          ...w.spriteContext,
          spriteProvider: () => ({
            frames: [{ url }, { url: "/sprite-never-finishes.png" }],
          }),
        },
      });
    } finally {
      document.createElement = create;
    }
  });
  await expect(
    page.locator('#preview [data-sprite-state="failed"]'),
  ).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).frameImages.every(
          (i: HTMLImageElement) => !i.getAttribute("src"),
        ),
      ),
    )
    .toBe(true);
});

test("sprite ink aligns with the measured native two-line server-list positions", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    const w = window as any;
    w.spriteContext = {
      ...w.spriteContext,
      presentation: "server-list",
      viewportWidth: 854,
      viewportHeight: 480,
      guiScale: 2,
      background: "none",
    };
    w.spriteDoc = w.api.createDocument(
      w.api.parseText(
        '<shadow:#00000000><white>A<sprite:gui:"grounds:star">B<newline>A<b><i><sprite:gui:"grounds:star"></i></b>B</white></shadow>',
        "minimessage",
      ).value,
    );
    w.preview.update({ document: w.spriteDoc, context: w.spriteContext });
    w.editor.update({
      ...w.spriteOptions,
      document: w.spriteDoc,
      context: w.spriteContext,
    });
  });
  for (const host of ["preview", "editor"]) {
    const canvases = page.locator(
      `#${host} [data-sprite-state="ready"] canvas`,
    );
    await expect(canvases).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await canvases.nth(i).scrollIntoViewIfNeeded();
      const [box, scene] = await Promise.all([
        canvases.nth(i).boundingBox(),
        page.locator(`#${host} .mcp-scene`).boundingBox(),
      ]);
      expect(box!.x - scene!.x).toBe(208);
      expect(box!.y - scene!.y).toBe(i ? 114 : 96);
    }
  }
});

test("low-level text rendering exposes explicit sprite ownership and diagnoses missing owners", async ({
  page,
}) => {
  await setup(page);
  const result = await page.evaluate(() => {
    const w = window as any,
      root = document.createElement("div");
    const diagnostics = w.dom.renderText(
      root,
      w.spriteDoc.motd.text,
      w.spriteContext,
      100,
    );
    return {
      hasPainter: typeof w.dom.SpritePainter === "function",
      codes: diagnostics.map((d: any) => d.code),
    };
  });
  expect(result.hasPainter).toBe(true);
  expect(result.codes).toContain("sprite-renderer-required");
});

test("reduced motion and explicit pause freeze native resource animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.evaluate(() => {
    const w = window as any;
    w.preview.update({
      document: w.spriteDoc,
      context: { ...w.spriteContext, animations: true },
    });
  });
  const canvas = page.locator('#preview [data-sprite-state="ready"] canvas');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-sprite-frame", "0");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => canvas.getAttribute("data-sprite-frame")).toBe("1");
  await page.evaluate(() => {
    const w = window as any;
    w.preview.update({
      document: w.spriteDoc,
      context: { ...w.spriteContext, animations: false },
    });
  });
  await expect(canvas).toHaveAttribute("data-sprite-frame", "0");
  await page.waitForTimeout(250); // Observation across more than one complete200ms loop.
  await expect(canvas).toHaveAttribute("data-sprite-frame", "0");
});
