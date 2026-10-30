import {
  vanillaSpriteCatalog,
  type ClientProfile,
  type SpriteAsset,
  type SpriteProvider,
} from "../../src/index.js";

export type VanillaSpriteState =
  "loading" | "ready" | "missing" | "unsupported";
export const vanillaSpriteStatusKey = {
  loading: "vanillaSpritesLoading",
  ready: "vanillaSpritesReady",
  missing: "vanillaSpritesMissing",
  unsupported: "vanillaSpritesUnsupported",
} as const;

/** Same-origin private development resources, never an asset mirror or a pack download. */
export async function loadVanillaSpriteProvider(
  profile: ClientProfile,
  signal: AbortSignal,
): Promise<SpriteProvider | undefined> {
  const catalog = vanillaSpriteCatalog(profile);
  if (!catalog.length) return undefined;
  const version = profile.clientVersion;
  const prefix = `/_motd/vanilla-sprites/${version}/`;
  try {
    const response = await fetch(prefix + "manifest.json", {
      signal,
      redirect: "error",
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json")
    )
      return undefined;
    const text = await response.text();
    if (text.length > 65536) return undefined;
    const data = JSON.parse(text);
    if (
      data?.schemaVersion !== 1 ||
      data.clientVersion !== version ||
      !data.sprites ||
      typeof data.sprites !== "object"
    )
      return undefined;
    const assets = new Map<string, SpriteAsset>();
    for (const entry of catalog) {
      const source = data.sprites[entry.sprite];
      if (
        !Array.isArray(source?.frames) ||
        !source.frames.length ||
        source.frames.length > 64
      )
        continue;
      const stem = entry.sprite.slice("minecraft:".length);
      if (
        source.frames.some(
          (frame: { url?: unknown; ticks?: unknown } | null, i: number) =>
            !frame ||
            frame.url !== `${prefix}${stem}-${i}.png` ||
            !Number.isInteger(frame.ticks) ||
            (frame.ticks as number) < 1 ||
            (frame.ticks as number) > 12000,
        )
      )
        continue;
      assets.set(entry.sprite, {
        frames: source.frames.map((frame: { url: string; ticks: number }) => ({
          url: frame.url,
          ticks: frame.ticks,
        })),
      });
    }
    if (!assets.size || signal.aborted) return undefined;
    return ({ atlas, sprite }, selected) =>
      selected.atlasSprites &&
      selected.clientVersion === version &&
      atlas === "minecraft:gui"
        ? assets.get(sprite)
        : undefined;
  } catch {
    return undefined;
  }
}
