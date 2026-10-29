import type { SpriteCatalogEntry, SpriteProvider } from "../../src/index.js";
const a = new URL("../../assets/ui/sprite-demo/pulse-a.svg", import.meta.url)
  .href;
const b = new URL("../../assets/ui/sprite-demo/pulse-b.svg", import.meta.url)
  .href;
export const demoSpriteCatalog: readonly SpriteCatalogEntry[] = [
  {
    atlas: "minecraft:gui",
    sprite: "grounds:demo_pulse",
    label: "Demo pulse",
    animated: true,
    requiresResourcePack: true,
  },
  {
    atlas: "minecraft:gui",
    sprite: "grounds:demo_gem",
    label: "Demo gem",
    requiresResourcePack: true,
  },
];
/** Original artwork; these custom IDs require a matching client pack in-game. */
export const demoSpriteProvider: SpriteProvider = ({ atlas, sprite }) =>
  atlas !== "minecraft:gui"
    ? undefined
    : sprite === "grounds:demo_pulse"
      ? {
          frames: [
            { url: a, ticks: 10 },
            { url: b, ticks: 10 },
          ],
        }
      : sprite === "grounds:demo_gem"
        ? { frames: [{ url: b }] }
        : undefined;
