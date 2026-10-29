import { demoSpriteProvider } from "./sprites.js";
import {
  createDocument,
  java263Profile,
  parseText,
  type ClientProfile,
  type PanoramaBackground,
  type PreviewContext,
} from "../../src/index.js";
export const initialDocument = createDocument(
  parseText(
    "<gradient:#e8c17c:#6ba18e><bold>GROUNDS NETWORK</bold></gradient><newline><gray>A place to build. <gold>{{players}}</gold> players online.",
    "minimessage",
  ).value!,
);
const demoFaces = (theme: "evergreen" | "dusk") =>
  Array.from(
    { length: 6 },
    (_, face) =>
      new URL(
        `../../assets/ui/panorama-demo/${theme}-${face}.svg`,
        import.meta.url,
      ).href,
  ) as unknown as PanoramaBackground["panorama"]["faces"];
const panoramaByProfile: Record<string, PanoramaBackground> = {
  "java-26.3": {
    panorama: { faces: demoFaces("evergreen") },
    motion: { speed: 1, paused: false },
    blur: 5,
    dimming: 0.34,
  },
  "java-1.21.1": {
    panorama: { faces: demoFaces("dusk") },
    motion: { speed: 1, paused: false },
    blur: 5,
    dimming: 0.34,
  },
};
export const demoPanoramaMotion = { paused: false, speed: 1 };
export const demoPanoramaAssets = (profile: ClientProfile) => {
  const background = panoramaByProfile[profile.id];
  return background
    ? {
        background: {
          ...background,
          motion: { ...demoPanoramaMotion },
        },
      }
    : undefined;
};
export const context: PreviewContext = {
  spriteProvider: demoSpriteProvider,
  base: {
    version: { protocol: 777, name: "26.3" },
    players: {
      online: 128,
      max: 500,
      sample: [
        {
          name: "§6Welcome to Grounds",
          id: "00000000-0000-0000-0000-000000000000",
        },
        {
          name: "§7Survival · Creative · Community",
          id: "00000000-0000-0000-0000-000000000001",
        },
      ],
    },
    description: "",
  },
  clientProtocol: 777,
  compatible: true,
  values: { region: "EU", continent: "Europe" },
  profile: java263Profile,
  presentation: "row",
  viewportWidth: 680,
  guiScale: 2,
  serverName: "Grounds Network",
  pingMs: 35,
  animations: true,
  assetProvider: demoPanoramaAssets,
};
