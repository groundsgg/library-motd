import { type Page } from "@playwright/test";
import { expect, test } from "./graphics-diagnostics.js";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { calibrationFaces } from "../../tools/reference/panorama-calibration.mjs";

const faces = calibrationFaces().map(
  (bytes: Buffer) => "data:image/png;base64," + bytes.toString("base64"),
);
async function mount(
  page: Page,
  source = faces,
  settings: {
    blur?: number;
    dimming?: number;
    motion?: { paused?: boolean; speed?: number };
  } = {},
) {
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(
    () => typeof window.api?.panoramaPose === "function",
  );
  await page.addStyleTag({
    content:
      "#preview .mcp-scene > :not(.mcp-background){visibility:hidden!important}",
  });
  await page.evaluate(
    ({ faces, settings }) => {
      window.context = {
        ...window.context,
        profile: window.api.java263Profile,
        viewportWidth: 854,
        viewportHeight: 480,
        presentation: "server-list",
        background: {
          panorama: {
            faces: faces as [string, string, string, string, string, string],
          },
          motion: { paused: true },
          blur: 0,
          dimming: 0,
          ...settings,
        },
      };
      window.preview.update({ document: window.doc, context: window.context });
    },
    { faces: source, settings },
  );
}

test("native panorama uses six loaded faces and the independent 26.3 camera", async ({
  page,
}) => {
  await mount(page);
  const background = page.locator("#preview .mcp-background");
  await expect(background).toHaveAttribute("data-panorama-state", "ready");
  await expect(background.locator(".mcp-panorama-canvas")).toHaveCount(1);
  const screenshot = await background.screenshot();
  const image = PNG.sync.read(screenshot);
  expect([image.width, image.height]).toEqual([854, 480]);
  for (const [file, y, height] of [
    ["zero-row-band.png", 96, 42],
    ["zero-bottom-band.png", 470, 10],
  ] as const) {
    const reference = PNG.sync.read(
      readFileSync(
        new URL(
          `../fixtures/client/native-panorama/26.3/${file}`,
          import.meta.url,
        ),
      ),
    );
    let sampled = 0,
      total = 0;
    for (let row = 2; row < height - 2; row += 4)
      for (let x = 4; x < 850; x += 4) {
        total++;
        const boundary = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ].some(([dx, dy]) =>
          [0, 1, 2].some(
            (channel) =>
              Math.abs(
                reference.data[
                  ((row + dy!) * reference.width + x + dx!) * 4 + channel
                ]! - reference.data[(row * reference.width + x) * 4 + channel]!,
              ) > 1,
          ),
        );
        if (boundary) continue;
        sampled++;
        const nativeOffset = (row * reference.width + x) * 4,
          browserOffset = ((y + row) * image.width + x) * 4;
        for (let channel = 0; channel < 3; channel++)
          expect(
            Math.abs(
              image.data[browserOffset + channel]! -
                reference.data[nativeOffset + channel]!,
            ),
            `${file} at ${x},${row},channel${channel}`,
          ).toBeLessThanOrEqual(2);
      }
    expect(sampled / total).toBeGreaterThan(0.98);
  }
});

test("an unavailable face retains the static fallback instead of a partial cube", async ({
  page,
  baseURL,
}) => {
  await page.route("**/missing-panorama.png", (route) => route.abort());
  await mount(page, [
    new URL("/missing-panorama.png", baseURL).href,
    ...faces.slice(1),
  ]);
  const background = page.locator("#preview .mcp-background");
  await expect(background).toHaveAttribute("data-panorama-state", "failed");
  await expect(background.locator(".mcp-panorama-viewport")).toHaveCount(0);
  const fallback = await background.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  );
  expect(fallback).not.toBe("none");
  await page.evaluate(() => {
    window.context.background = "panorama";
    window.preview.update({ document: window.doc, context: window.context });
  });
  expect(
    await background.evaluate(
      (element) => getComputedStyle(element).backgroundImage,
    ),
  ).toBe(fallback);
});

test("non-square panorama faces keep the complete static fallback", async ({
  page,
}) => {
  const malformed = [...faces];
  malformed[2] =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2"/>',
    );
  await mount(page, malformed);
  const background = page.locator("#preview .mcp-background");
  await expect(background).toHaveAttribute("data-panorama-state", "failed");
  await expect(background.locator(".mcp-panorama-viewport")).toHaveCount(0);
});

test("blur and dimming are independently configurable", async ({ page }) => {
  await mount(page, faces, { blur: 8, dimming: 0.65 });
  const background = page.locator("#preview .mcp-background");
  await expect(background).toHaveAttribute("data-panorama-state", "ready");
  await expect(background.locator(".mcp-panorama-render")).toHaveCSS(
    "filter",
    "blur(4px)",
  );
  await expect(background.locator(".mcp-panorama-dimmer")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0.65)",
  );
});

test("many independent rows share one GPU context and release it on destroy", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let count = 0;
    Object.defineProperty(window, "panoramaContextCount", { get: () => count });
    HTMLCanvasElement.prototype.getContext = new Proxy(
      HTMLCanvasElement.prototype.getContext,
      {
        apply(target, canvas, args) {
          if (args[0] === "webgl") count++;
          return Reflect.apply(target, canvas, args);
        },
      },
    );
  });
  await mount(page);
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "many-panoramas";
    const previews = Array.from({ length: 20 }, () => {
      const root = document.createElement("div");
      host.append(root);
      return window.dom.createPreview(root, {
        document: window.doc,
        context: { ...window.context, presentation: "row", animations: false },
      });
    });
    Object.assign(host, {
      destroy: () => previews.forEach((preview) => preview.destroy()),
    });
    document.body.append(host);
  });
  await expect(
    page.locator('#many-panoramas [data-panorama-state="ready"]'),
  ).toHaveCount(20);
  expect(
    await page.evaluate(() => Reflect.get(window, "panoramaContextCount")),
  ).toBe(1);
  await page.evaluate(() =>
    Reflect.get(document.querySelector("#many-panoramas")!, "destroy")(),
  );
  await expect(
    page.locator("#many-panoramas .mcp-panorama-canvas"),
  ).toHaveCount(0);
  await expect(
    page.locator('#preview [data-panorama-state="ready"]'),
  ).toHaveCount(1);
});

test("unavailable WebGL retains the static fallback", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = new Proxy(
      HTMLCanvasElement.prototype.getContext,
      {
        apply(target, canvas, args) {
          return args[0] === "webgl"
            ? null
            : Reflect.apply(target, canvas, args);
        },
      },
    );
  });
  await mount(page);
  await expect(page.locator("#preview .mcp-background")).toHaveAttribute(
    "data-panorama-state",
    "failed",
  );
  await expect(page.locator("#preview .mcp-panorama-viewport")).toHaveCount(0);
});

test("cross-origin faces require CORS and keep the fallback when blocked", async ({
  page,
}) => {
  await page.route("https://panorama.invalid/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      headers: { "access-control-allow-origin": "https://different.invalid" },
      body: calibrationFaces()[0],
    }),
  );
  await mount(page, ["https://panorama.invalid/front.png", ...faces.slice(1)]);
  await expect(page.locator("#preview .mcp-background")).toHaveAttribute(
    "data-panorama-state",
    "failed",
  );
});

test("CORS-authorized remote faces render normally", async ({ page }) => {
  await page.route("https://panorama.invalid/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
      body: calibrationFaces()[0],
    }),
  );
  await mount(page, ["https://panorama.invalid/front.png", ...faces.slice(1)]);
  await expect(page.locator("#preview .mcp-background")).toHaveAttribute(
    "data-panorama-state",
    "ready",
  );
});

test("losing the shared GPU context restores every affected fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = new Proxy(
      HTMLCanvasElement.prototype.getContext,
      {
        apply(target, canvas, args) {
          if (args[0] === "webgl")
            Reflect.set(window, "panoramaGLCanvas", canvas);
          return Reflect.apply(target, canvas, args);
        },
      },
    );
  });
  await mount(page);
  await page.evaluate(() =>
    window.second.update({ document: window.doc, context: window.context }),
  );
  await expect(page.locator('[data-panorama-state="ready"]')).toHaveCount(2);
  await page.evaluate(() => {
    const canvas = Reflect.get(window, "panoramaGLCanvas") as HTMLCanvasElement;
    canvas
      .getContext("webgl")!
      .getExtension("WEBGL_lose_context")!
      .loseContext();
  });
  await expect(page.locator('[data-panorama-state="failed"]')).toHaveCount(2);
  await expect(page.locator(".mcp-panorama-viewport")).toHaveCount(0);
});

test("an unpaused panorama advances at native rotation speed", async ({
  page,
}) => {
  await page.clock.install();
  await mount(page);
  await page.evaluate(() => {
    window.context.background = {
      ...window.context.background,
      motion: { paused: false },
    };
    window.context.animations = true;
    window.preview.update({ document: window.doc, context: window.context });
  });
  await page.clock.runFor(1000);
  await expect(page.locator(".mcp-panorama-canvas")).toHaveAttribute(
    "data-panorama-yaw",
    /^-2(?:\.\d+)?$/,
  );
});

test("disabled context animations pause the panorama clock", async ({
  page,
}) => {
  await page.clock.install();
  await mount(page);
  await page.evaluate(() => {
    window.context.background = {
      ...window.context.background,
      motion: { paused: false },
    };
    window.context.animations = false;
    window.preview.update({ document: window.doc, context: window.context });
  });
  await page.clock.runFor(1000);
  await expect(page.locator(".mcp-panorama-canvas")).toHaveAttribute(
    "data-panorama-yaw",
    "0",
  );
});

test("pause and speed changes preserve accumulated panorama phase", async ({
  page,
}) => {
  await page.clock.install();
  await mount(page);
  const cube = page.locator(".mcp-panorama-canvas");
  await expect(cube).toBeAttached();
  const update = (paused: boolean, speed: number) =>
    page.evaluate(
      ({ paused, speed }) => {
        window.context.background = {
          ...window.context.background,
          motion: { paused, speed },
        };
        window.context.animations = true;
        window.preview.update({
          document: window.doc,
          context: window.context,
        });
      },
      { paused, speed },
    );
  const yaw = async () => {
    return -Number(await cube.getAttribute("data-panorama-yaw"));
  };

  await update(false, 1);
  await page.clock.runFor(500);
  const beforePause = await yaw();
  expect(beforePause).toBeGreaterThan(0.5);
  expect(beforePause).toBeLessThan(1.5);

  await update(true, 1);
  const atPause = await yaw();
  await page.clock.runFor(500);
  expect(await yaw()).toBe(atPause);

  await update(false, 2);
  await page.clock.runFor(500);
  const afterResume = await yaw();
  expect(afterResume - beforePause).toBeGreaterThan(1.5);
  expect(afterResume - beforePause).toBeLessThan(2.5);
});

test("row panoramas rotate and still respect live reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(page);
  await page.evaluate(() => {
    window.context.background = {
      ...window.context.background,
      motion: { paused: false },
    };
    window.context.animations = true;
    window.preview.update({ document: window.doc, context: window.context });
  });
  const cube = page.locator(".mcp-panorama-canvas");
  await expect(cube).toHaveAttribute("data-panorama-yaw", "0");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(
    () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  await page.evaluate(() => {
    window.context.presentation = "row";
    window.preview.update({ document: window.doc, context: window.context });
  });
  await expect(cube).not.toHaveAttribute("data-panorama-yaw", "0");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  const paused = await cube.getAttribute("data-panorama-yaw");
  // A real interval verifies the absence of frames after a real media event.
  await page.waitForTimeout(100);
  expect(await cube.getAttribute("data-panorama-yaw")).toBe(paused);
});

test("document visibility pauses and resumes the panorama clock", async ({
  page,
}) => {
  await page.clock.install();
  await mount(page);
  const cube = page.locator(".mcp-panorama-canvas");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.context.background = {
      ...window.context.background,
      motion: { paused: false },
    };
    window.context.animations = true;
    window.preview.update({ document: window.doc, context: window.context });
  });
  await page.clock.runFor(500);
  expect(await cube.getAttribute("data-panorama-yaw")).toBe("0");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(500);
  const style = await cube.getAttribute("data-panorama-yaw");
  expect(-Number(style)).toBeGreaterThan(0.5);
  expect(-Number(style)).toBeLessThan(1.5);
});

test("equivalent source arrays do not reload panorama faces", async ({
  page,
  baseURL,
}) => {
  let requests = 0;
  const bytes = calibrationFaces();
  await page.route("**/face-*.png", async (route) => {
    const face = Number(
      new URL(route.request().url()).pathname.match(/face-(\d+)/)?.[1],
    );
    requests++;
    await route.fulfill({ body: bytes[face], contentType: "image/png" });
  });
  const urls = bytes.map(
    (_, index) => new URL(`/face-${index}.png`, baseURL).href,
  );
  await mount(page, urls);
  const background = page.locator("#preview .mcp-background");
  await expect(background).toHaveAttribute("data-panorama-state", "ready");
  expect(requests).toBe(6);
  await page.evaluate((faces) => {
    window.context.background = {
      ...window.context.background,
      panorama: { faces: [...faces] },
    };
    window.preview.update({ document: window.doc, context: window.context });
  }, urls);
  await expect(background).toHaveAttribute("data-panorama-state", "ready");
  expect(requests).toBe(6);
});

test("late failures from a replaced source cannot replace the new panorama", async ({
  page,
  baseURL,
}) => {
  let releaseSlow!: () => void;
  const slow = new Promise<void>((resolve) => (releaseSlow = resolve)),
    slowUrl = new URL("/slow-face.png", baseURL).href;
  await page.route(slowUrl, async (route) => {
    await slow;
    await route.abort();
  });
  const requested = page.waitForRequest(slowUrl);
  await mount(page, [slowUrl, ...faces.slice(1)]);
  await requested;
  await page.evaluate((newFaces) => {
    window.context.background = {
      ...window.context.background,
      panorama: { faces: newFaces },
    };
    window.preview.update({ document: window.doc, context: window.context });
  }, faces);
  const background = page.locator("#preview .mcp-background");
  await expect(background).toHaveAttribute("data-panorama-state", "ready");
  releaseSlow();
  await page.waitForTimeout(30);
  await expect(background).toHaveAttribute("data-panorama-state", "ready");
});

test("independent entries keep separate animation and destroy lifecycles", async ({
  page,
}) => {
  await page.clock.install();
  await mount(page);
  await page.evaluate(() => {
    window.context.background = {
      ...window.context.background,
      motion: { paused: false },
    };
    window.context.animations = true;
    window.preview.update({ document: window.doc, context: window.context });
    window.second.update({ document: window.doc, context: window.context });
  });
  const first = page.locator("#preview .mcp-panorama-canvas"),
    second = page.locator("#second .mcp-panorama-canvas");
  await expect(first).toBeAttached();
  await expect(second).toBeAttached();
  await page.clock.runFor(500);
  await page.evaluate(() => {
    window.preview.update({
      document: window.doc,
      context: { ...window.context, animations: false },
    });
  });
  const firstAtPause = await first.getAttribute("data-panorama-yaw"),
    secondAtPause = await second.getAttribute("data-panorama-yaw");
  await page.clock.runFor(500);
  expect(await first.getAttribute("data-panorama-yaw")).toBe(firstAtPause);
  expect(await second.getAttribute("data-panorama-yaw")).not.toBe(
    secondAtPause,
  );
  await page.evaluate(() => window.preview.destroy());
  await expect(first).toHaveCount(0);
  await expect(second).toBeAttached();
});

test("panorama nodes and callbacks belong to the embedding iframe", async ({
  page,
  baseURL,
}) => {
  await page.goto("/tests/browser/host.html");
  const iframeUrl = new URL("/tests/browser/host.html", baseURL!).href;
  await page.evaluate((url) => {
    const iframe = document.createElement("iframe");
    iframe.src = url;
    document.body.append(iframe);
  }, iframeUrl);
  await page.frameLocator("iframe").locator("body").waitFor();
  const frame = page
    .frames()
    .find(
      (candidate) =>
        candidate !== page.mainFrame() && candidate.url() === iframeUrl,
    );
  expect(frame).toBeDefined();
  await frame!.waitForFunction(() => !!window.preview && !!window.api);
  await frame!.evaluate((faces) => {
    window.context.profile = window.api.java263Profile;
    window.context.clientProtocol = 777;
    window.context.viewportWidth = 854;
    window.context.viewportHeight = 480;
    window.context.presentation = "server-list";
    window.context.background = {
      panorama: {
        faces: faces as [string, string, string, string, string, string],
      },
      motion: { paused: true },
      blur: 0,
      dimming: 0,
    };
    window.preview.update({ document: window.doc, context: window.context });
  }, faces);
  const iframePreview = page.frameLocator("iframe");
  await expect(
    iframePreview.locator("#preview .mcp-background"),
  ).toHaveAttribute("data-panorama-state", "ready");
  expect(
    await frame!.evaluate(
      () =>
        document.querySelector("#preview .mcp-panorama-canvas")
          ?.ownerDocument === document,
    ),
  ).toBe(true);
});
