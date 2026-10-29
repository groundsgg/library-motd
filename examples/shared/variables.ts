import type { VariableCatalogEntry } from "../../src/index.js";

/** Host metadata only. Preview values are supplied independently in context.values. */
export const demoVariableCatalog: readonly VariableCatalogEntry[] = [
  {
    name: "players",
    label: "Players",
    description: "The displayed example player count.",
  },
  {
    name: "max",
    label: "Maximum players",
    description: "The displayed example capacity.",
  },
  {
    name: "region",
    label: "Region",
    description: "Region supplied by the host application.",
    exampleValue: "EU",
  },
  { name: "continent", label: "Continent", exampleValue: "Europe" },
  {
    name: "server.name",
    label: "Server name",
    description: "A custom variable with a literal dotted name.",
    fields: ["motd", "hover"],
    exampleValue: "Your network",
  },
];
