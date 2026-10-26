import { expect, test } from "@playwright/test";
import {
  installGraphicsObserver,
  readGraphicsObserver,
} from "../../tools/graphics-observer.mjs";
import {
  collectGraphicsSnapshot,
  recordGlxObservation,
} from "../../tools/linux-graphics-diagnostics.mjs";

test("graphics observer preserves missing native arguments separately from undefined", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  const outcomes = () => {
    const canvas = document.createElement("canvas");
    const call = (args: unknown[]) => {
      try {
        return {
          returnedNull:
            Reflect.apply(
              HTMLCanvasElement.prototype.getContext,
              canvas,
              args,
            ) === null,
        };
      } catch (error) {
        return { error: (error as Error).name };
      }
    };
    return { missing: call([]), explicitUndefined: call([undefined]) };
  };
  const before = await page.evaluate(outcomes);
  expect(before.missing).toEqual({ error: "TypeError" });
  await page.evaluate(installGraphicsObserver);
  expect(await page.evaluate(outcomes)).toEqual(before);
});

test("graphics observer preserves native context identity, arguments and receiver errors", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.evaluate(installGraphicsObserver);
  const result = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
    });
    const same = canvas.getContext("webgl") === context;
    let errorName;
    try {
      HTMLCanvasElement.prototype.getContext.call(null, "webgl");
    } catch (error) {
      errorName = (error as Error).name;
    }
    return {
      available: Boolean(context),
      same,
      alpha: context?.getContextAttributes()?.alpha,
      errorName,
    };
  });
  expect(result).toEqual({
    available: true,
    same: true,
    alpha: false,
    errorName: "TypeError",
  });
  const observation = await page.evaluate(readGraphicsObserver);
  expect(observation.totals).toMatchObject({
    attempts: 2,
    succeeded: 2,
    declined: 0,
  });
  expect(observation.events[0].maxTextureSize).toBeGreaterThan(0);
});

test("graphics observations bound repeated error events and discard arbitrary messages", async ({
  page,
}) => {
  await page.goto("/tests/browser/host.html");
  await page.evaluate(installGraphicsObserver);
  await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.getContext("webgl");
    for (let index = 0; index < 80; index++) {
      const event = new Event("webglcontextcreationerror");
      Object.defineProperty(event, "statusMessage", {
        value:
          "private-host secret-token FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS WebglAllowWindowsNativeGl:false",
      });
      canvas.dispatchEvent(event);
    }
    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);
    if (lost.defaultPrevented)
      throw new Error("Observer must not cancel native events");
  });
  const observation = await page.evaluate(readGraphicsObserver);
  expect(observation.events).toHaveLength(32);
  expect(observation.events[0]).toMatchObject({
    type: "creation-error",
    codes: ["FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS"],
    nativeGlBlocked: true,
  });
  expect(observation.totals.lost).toBe(1);
  expect(JSON.stringify(observation)).not.toMatch(/secret-token|private-host/);
});

test.afterAll(async ({ browserName }) => {
  if (process.platform !== "linux" || process.env.GITHUB_ACTIONS !== "true")
    return;
  try {
    const snapshot = await collectGraphicsSnapshot({ probeGlx: true });
    await recordGlxObservation(browserName, snapshot.glx);
  } catch {
    /* Never turn an optional probe into a rendering assertion failure. */
  }
});
