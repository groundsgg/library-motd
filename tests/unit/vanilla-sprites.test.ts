import { describe, expect, it } from "vitest";
import * as api from "../../src/index.js";
import { readFileSync } from "node:fs";

describe("Vanilla sprite catalog", () => {
  it("offers builtin GUI sprites for each audited capable client without requiring a pack", () => {
    for (const profile of api.clientProfiles.filter((p) => p.atlasSprites)) {
      const entries = api.vanillaSpriteCatalog(profile);
      expect(entries.length).toBe(20);
      expect(
        entries.find((e) => e.sprite === "minecraft:icon/trial_available"),
      ).toMatchObject({
        atlas: "minecraft:gui",
        label: "Trial available",
        animated: true,
      });
      expect(
        entries.find((e) => e.sprite === "minecraft:icon/music_notes")
          ?.animated,
      ).toBe(true);
      expect(entries.some((e) => e.sprite === "minecraft:hud/heart/full")).toBe(
        true,
      );
      expect(
        entries.some((e) => e.sprite === "minecraft:mob_effect/speed"),
      ).toBe(true);
      expect(
        entries.every(
          (e) => e.sprite.startsWith("minecraft:") && !e.requiresResourcePack,
        ),
      ).toBe(true);
    }
  });
  it("does not invent availability for older clients, unknown versions, or absent capability", () => {
    expect(api.vanillaSpriteCatalog(api.java1211Profile)).toEqual([]);
    expect(api.vanillaSpriteCatalog(api.java1204Profile)).toEqual([]);
    expect(
      api.vanillaSpriteCatalog({
        ...api.java263Profile,
        clientVersion: "99.9",
      }),
    ).toEqual([]);
    expect(
      api.vanillaSpriteCatalog({
        ...api.java263Profile,
        atlasSprites: undefined,
      }),
    ).toEqual([]);
  });
  it("keeps shared resource metadata immutable between consumers", () => {
    const entries = api.vanillaSpriteCatalog(api.java263Profile);
    expect(() => (entries as api.SpriteCatalogEntry[]).pop()).toThrow();
    expect(() => {
      (entries[0] as api.SpriteCatalogEntry).sprite = "custom:fake";
    }).toThrow();
    expect(api.vanillaSpriteCatalog(api.java263Profile)[0]?.sprite).toBe(
      "minecraft:icon/trial_available",
    );
  });
  it("offers only resources present in the independent per-version archive audit", () => {
    const audit = JSON.parse(
      readFileSync(
        new URL(
          "../fixtures/client/vanilla-sprite-catalog.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    for (const profile of api.clientProfiles.filter((p) => p.atlasSprites))
      for (const entry of api.vanillaSpriteCatalog(profile)) {
        const resource =
          audit.clients[profile.clientVersion].sprites[entry.sprite];
        expect(resource).toBeDefined();
        expect(resource.frameSize[0]).toBe(resource.frameSize[1]);
        expect(resource.frames.length > 1).toBe(!!entry.animated);
      }
  });
});
