import {
  createDocument,
  java263Profile,
  parseText,
  type PreviewContext,
} from "../../src/index.js";
export const initialDocument = createDocument(
  parseText(
    "<gradient:#e8c17c:#6ba18e><bold>GROUNDS NETWORK</bold></gradient><newline><gray>A place to build. <gold>{{players}}</gold> players online.",
    "minimessage",
  ).value!,
);
export const context: PreviewContext = {
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
};
