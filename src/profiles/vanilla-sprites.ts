import type { ClientProfile, SpriteCatalogEntry } from "../core/model.js";

const auditedVersions = new Set([
  "1.21.11",
  "26.1",
  "26.1.1",
  "26.1.2",
  "26.2",
  "26.3",
]);
const entries: readonly (readonly [string, string, boolean?])[] = [
  ["icon/trial_available", "Trial available", true],
  ["icon/music_notes", "Music notes", true],
  ["icon/info", "Information"],
  ["icon/link", "Link"],
  ["icon/search", "Search"],
  ["icon/invite", "Invitation"],
  ["icon/news", "News"],
  ["icon/unseen_notification", "Notification"],
  ["hud/heart/full", "Heart"],
  ["hud/heart/hardcore_full", "Hardcore heart"],
  ["hud/armor_full", "Armor"],
  ["hud/food_full", "Food"],
  ["mob_effect/speed", "Speed"],
  ["mob_effect/strength", "Strength"],
  ["mob_effect/regeneration", "Regeneration"],
  ["mob_effect/luck", "Luck"],
  ["mob_effect/fire_resistance", "Fire resistance"],
  ["mob_effect/night_vision", "Night vision"],
  ["mob_effect/invisibility", "Invisibility"],
  ["mob_effect/haste", "Haste"],
];
const catalog: readonly SpriteCatalogEntry[] = Object.freeze(
  entries.map(([sprite, label, animated]) =>
    Object.freeze({
      atlas: "minecraft:gui",
      sprite: `minecraft:${sprite}`,
      label,
      ...(animated ? { animated: true } : {}),
    }),
  ),
);
const empty: readonly SpriteCatalogEntry[] = Object.freeze([]);

/** Curated IDs audited in the named Vanilla clients, not textures or a complete atlas. */
export function vanillaSpriteCatalog(
  profile: ClientProfile,
): readonly SpriteCatalogEntry[] {
  return profile.atlasSprites && auditedVersions.has(profile.clientVersion)
    ? catalog
    : empty;
}
