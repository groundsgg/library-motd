import { describe, expect, it } from "vitest";
import { panoramaPose } from "../../src/index.js";
import { resolvePanorama } from "../../src/core/panorama.js";

describe("native panorama pose", () => {
  it.each([
    [0, 0],
    [1_000, -2],
    [45_000, -90],
    [90_000, -180],
    [180_000, 0],
    [181_000, -2],
    [-1_000, 2],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])("uses the audited camera at elapsed %s ms", (time, yaw) => {
    expect(panoramaPose(time)).toEqual({ yaw, pitch: 10, verticalFov: 85 });
  });
  it("accepts a wrapped initial heading and extreme finite elapsed values", () => {
    expect(panoramaPose(1_000, 450).yaw).toBe(88);
    expect(panoramaPose(0, Number.NaN).yaw).toBe(0);
    const result = panoramaPose(-Number.MAX_VALUE, Number.MAX_VALUE);
    expect(Number.isFinite(result.yaw)).toBe(true);
    expect(result.yaw).toBeGreaterThanOrEqual(-180);
    expect(result.yaw).toBeLessThan(180);
  });
});

describe("host panorama sources and settings", () => {
  const faces = ["0.png", "1.png", "2.png", "3.png", "4.png", "5.png"];
  it.each([
    undefined,
    null,
    "panorama",
    { imageUrl: "flat.png" },
    { panorama: { faces: faces.slice(0, 5) } },
    { panorama: { faces: [...faces, "extra.png"] } },
    { panorama: { faces: ["", ...faces.slice(1)] } },
    { panorama: { faces: [0, ...faces.slice(1)] } },
  ])(
    "keeps malformed or other background forms on the static path: %j",
    (raw) => {
      expect(resolvePanorama(raw)).toBeNull();
    },
  );
  it("copies original host sources and applies standalone defaults", () => {
    const raw = Object.freeze({
      panorama: Object.freeze({
        faces: Object.freeze([...faces]),
        fallbackImageUrl: "fallback.png",
        overlayImageUrl: "overlay.png",
      }),
    });
    const result = resolvePanorama(raw)!;
    expect(result).toEqual({
      source: raw.panorama,
      speed: 1,
      paused: false,
      initialYaw: 0,
      blur: 5,
      dimming: 1 / 3,
    });
    expect(result.source.faces).not.toBe(raw.panorama.faces);
  });
  it("normalizes nonfinite options and bounds physical filtering/motion", () => {
    expect(
      resolvePanorama({
        panorama: { faces },
        motion: { speed: Number.NaN, initialYaw: Number.POSITIVE_INFINITY },
        blur: Number.NaN,
        dimming: Number.NaN,
      }),
    ).toMatchObject({ speed: 1, initialYaw: 0, blur: 5, dimming: 1 / 3 });
    expect(
      resolvePanorama({
        panorama: { faces },
        motion: { speed: -100, paused: true, initialYaw: 370 },
        blur: 99,
        dimming: -1,
      }),
    ).toMatchObject({
      speed: -10,
      paused: true,
      initialYaw: 10,
      blur: 32,
      dimming: 0,
    });
    expect(
      resolvePanorama({
        panorama: { faces },
        motion: { speed: 100 },
        blur: -1,
        dimming: 2,
      }),
    ).toMatchObject({ speed: 10, blur: 0, dimming: 1 });
  });
});
