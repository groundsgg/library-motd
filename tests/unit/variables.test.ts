import { expect, it } from "vitest";
import * as api from "../../src/index.js";
const list = (...args: any[]) => (api as any).listVariables(...args);
it("infers only own valid preview variable names", () => {
  const values = Object.assign(Object.create({ inherited: "hidden" }), {
    region: "EU",
    "server.name": "Grounds",
    "bad name": "no",
  });
  expect(list(values)).toEqual([{ name: "region" }, { name: "server.name" }]);
});
it("treats an explicit host catalog as authoritative, including an empty one", () => {
  expect(list({ private: "hidden" }, { catalog: [] })).toEqual([]);
  expect(
    list(
      { private: "hidden" },
      { catalog: [{ name: "registered", description: "Host provided" }] },
    ),
  ).toEqual([{ name: "registered", description: "Host provided" }]);
});
it("filters fields before deduplication so field-specific metadata remains usable", () => {
  const catalog = [
    { name: "region", label: "Message region", fields: ["motd"] },
    { name: "region", label: "Hover region", fields: ["hover"] },
    { name: "shared" },
  ];
  expect(list({}, { catalog, field: "hover" })).toEqual([
    { name: "region", label: "Hover region", fields: ["hover"] },
    { name: "shared" },
  ]);
  expect(list({}, { catalog, field: "version" })).toEqual([{ name: "shared" }]);
});
it("ignores malformed entries and invalid names without inventing values", () => {
  const catalog = [
    null,
    { name: "" },
    { name: "bad name" },
    { name: "<tag>" },
    { name: "x".repeat(129) },
    { name: "wrong", fields: ["other"] },
    { name: "none", fields: [] },
    { name: "custom.value-1", exampleValue: "Demo" },
  ];
  const values = Object.freeze({});
  expect(list(values, { catalog, field: "motd" })).toEqual([
    { name: "custom.value-1", exampleValue: "Demo" },
  ]);
  expect(values).toEqual({});
});
it("returns independent metadata snapshots without changing host-owned data", () => {
  const fields = Object.freeze(["motd"]);
  const catalog = Object.freeze([
    Object.freeze({
      name: "region",
      fields,
      label: "Region",
      description: "Which region",
      exampleValue: "EU",
    }),
  ]);
  const result = list({}, { catalog, field: "motd" });
  result[0].fields.push("hover");
  expect(fields).toEqual(["motd"]);
  expect(list({}, { catalog, field: "hover" })).toEqual([]);
});
it("bounds catalog work and preserves deterministic first-name ordering", () => {
  const catalog = Array.from({ length: 4097 }, (_, i) => ({
    name: `value${i}`,
  }));
  expect(list({}, { catalog })).toHaveLength(4096);
  expect(list({}, { catalog })).not.toContainEqual({ name: "value4096" });
  expect(
    list(
      {},
      {
        catalog: [
          { name: "first" },
          { name: "first", label: "duplicate" },
          { name: "second" },
        ],
      },
    ),
  ).toEqual([{ name: "first" }, { name: "second" }]);
});
