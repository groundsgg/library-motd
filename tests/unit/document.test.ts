import { describe, expect, it } from "vitest";
import * as core from "../../src/index.js";

describe("document lifecycle", () => {
  it("preserves live values by default and round trips a document", () => {
    const document = core.createDocument();
    expect(document.version).toEqual({ mode: "automatic" });
    expect(document.players).toEqual({
      hidden: false,
      online: { mode: "inherit" },
      maximum: { mode: "inherit" },
    });
    expect(core.readDocument(core.writeDocument(document)).value).toEqual(
      document,
    );
  });
  it("rejects unknown schemas and invalid count rules with a field path", () => {
    expect(core.validateDocument({ schemaVersion: 99 }).value).toBeNull();
    const document = core.createDocument();
    document.players.online = { mode: "headroom", value: 10 };
    const result = core.validateDocument(document);
    expect(result.value).toBeNull();
    expect(result.diagnostics.some((d) => d.path === "players.online")).toBe(
      true,
    );
  });
  it("excludes runtime history and preview state from persisted documents", () => {
    const json = core.writeDocument({
      ...core.createDocument(),
      history: ["secret"],
      context: { players: 12 },
    } as never);
    expect(JSON.parse(json)).not.toHaveProperty("history");
    expect(JSON.parse(json)).not.toHaveProperty("context");
  });
  it("rejects malformed JSON and cyclic extension values without throwing", () => {
    expect(core.readDocument("{").value).toBeNull();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(
      core.validateDocument({ ...core.createDocument(), extensions: cyclic })
        .value,
    ).toBeNull();
  });
});
