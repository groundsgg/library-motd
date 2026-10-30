import { afterEach, expect, it, vi } from "vitest";
import { java263Profile, java1211Profile } from "../../src/index.js";
import { loadVanillaSpriteProvider } from "../../examples/shared/sprites.js";

afterEach(() => vi.unstubAllGlobals());
const signal = () => new AbortController().signal;
const fixture = () => ({
  schemaVersion: 1,
  clientVersion: "26.3",
  sprites: {
    "minecraft:icon/trial_available": {
      frames: [
        {
          url: "/_motd/vanilla-sprites/26.3/icon/trial_available-0.png",
          ticks: 10,
        },
        {
          url: "/_motd/vanilla-sprites/26.3/icon/trial_available-1.png",
          ticks: 2,
        },
      ],
    },
  },
});
const resource = {
  atlas: "minecraft:gui",
  sprite: "minecraft:icon/trial_available",
};

it("keeps native frame timing and scopes resources to the loaded client version", async () => {
  vi.stubGlobal("fetch", async (url: string) => {
    expect(url).toBe("/_motd/vanilla-sprites/26.3/manifest.json");
    return Response.json(fixture());
  });
  const provider = await loadVanillaSpriteProvider(java263Profile, signal());
  expect(
    provider?.(resource, java263Profile)?.frames.map((f) => f.ticks),
  ).toEqual([10, 2]);
  expect(
    provider?.(resource, { ...java263Profile, clientVersion: "26.2" }),
  ).toBeUndefined();
  expect(
    provider?.({ ...resource, sprite: "custom:fake" }, java263Profile),
  ).toBeUndefined();
  expect(
    provider?.({ ...resource, atlas: "custom:gui" }, java263Profile),
  ).toBeUndefined();
});
it("does not load resources for unsupported clients", async () => {
  const fetch = vi.fn(() => {
    throw new Error("No request allowed");
  });
  vi.stubGlobal("fetch", fetch);
  expect(
    await loadVanillaSpriteProvider(java1211Profile, signal()),
  ).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects unknown versions, external URLs and invalid native frame durations", async () => {
  for (const change of [
    (data: ReturnType<typeof fixture>) => {
      data.clientVersion = "26.2";
    },
    (data: ReturnType<typeof fixture>) => {
      data.sprites[
        resource.sprite as keyof typeof data.sprites
      ].frames[0]!.url = "https://example.invalid/original.png";
    },
    (data: ReturnType<typeof fixture>) => {
      data.sprites[
        resource.sprite as keyof typeof data.sprites
      ].frames[0]!.ticks = 0;
    },
  ]) {
    const data = fixture();
    change(data);
    vi.stubGlobal("fetch", async () => Response.json(data));
    expect(
      await loadVanillaSpriteProvider(java263Profile, signal()),
    ).toBeUndefined();
  }
});
it("ignores an aborted load and unavailable or oversized manifests", async () => {
  vi.stubGlobal("fetch", async () => Response.json(fixture()));
  const abort = new AbortController();
  abort.abort();
  expect(
    await loadVanillaSpriteProvider(java263Profile, abort.signal),
  ).toBeUndefined();
  for (const response of [
    new Response("", { status: 404 }),
    new Response("<html>fallback</html>"),
    Response.json({ padding: "x".repeat(65537) }),
  ]) {
    vi.stubGlobal("fetch", async () => response);
    expect(
      await loadVanillaSpriteProvider(java263Profile, signal()),
    ).toBeUndefined();
  }
});
