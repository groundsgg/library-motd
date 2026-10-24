import { expect, it } from "vitest";
import * as api from "../../src/index.js";
import { makeApng, pngChunk } from "../helpers/apng.js";
import { PNG } from "pngjs";

const base = {
  version: { name: "1.21.1", protocol: 767 },
  players: { online: 1, max: 10, sample: [] },
  description: "",
};
const context = { base, clientProtocol: 767, values: {} };
const icon = (bytes: Buffer) => ({ pngBase64: bytes.toString("base64") });

for (const excluded of [false, true])
  it(`projects the PNG default image with animation default excluded=${excluded}`, () => {
    const { png, defaultPng } = makeApng(excluded),
      source = icon(png);
    const result = api.normalizeStatusIcon(source);
    expect(result.value).toEqual(icon(defaultPng));
    expect(result.diagnostics.map((d) => d.code)).toEqual([
      "animated-icon-static",
    ]);
    expect(source).toEqual(icon(png));
    const decoded = PNG.sync.read(
      Buffer.from(result.value!.pngBase64, "base64"),
    );
    expect([...decoded.data.subarray(0, 4)]).toEqual([255, 0, 0, 0]);
    expect([...decoded.data.subarray(4, 8)]).toEqual([255, 0, 0, 128]);
  });

it("keeps saved source while projecting status, imports and runtime templates", () => {
  const { png, defaultPng } = makeApng();
  const document = api.createDocument();
  document.icon = icon(png);
  const before = JSON.stringify(document);
  expect(api.validateDocument(document).value).not.toBeNull();
  const result = api.evaluateStatus(document, context);
  expect(result.value!.favicon).toBe(
    "data:image/png;base64," + defaultPng.toString("base64"),
  );
  expect(api.compileStatusTemplate(document).value!.icon).toEqual(
    icon(defaultPng),
  );
  const imported = api.importStatus({
    ...base,
    favicon: "data:image/png;base64," + png.toString("base64"),
  });
  expect(imported.value!.icon).toEqual(icon(defaultPng));
  expect(
    imported.diagnostics.some((d) => d.code === "animated-icon-static"),
  ).toBe(true);
  expect(JSON.stringify(document)).toBe(before);
  expect(api.readDocument(api.writeDocument(document)).value!.icon).toEqual(
    icon(png),
  );
});

it("projects inherited base icons without changing the base status", () => {
  const { png, defaultPng } = makeApng();
  const inherited = {
    ...base,
    favicon: "data:image/png;base64," + png.toString("base64"),
  };
  const before = JSON.stringify(inherited);
  expect(
    api.evaluateStatus(api.createDocument(), { ...context, base: inherited })
      .value!.favicon,
  ).toBe("data:image/png;base64," + defaultPng.toString("base64"));
  expect(JSON.stringify(inherited)).toBe(before);
  const invalid = api.evaluateStatus(api.createDocument(), {
    ...context,
    base: { ...base, favicon: "data:image/gif;base64,R0lGODlh" },
  });
  expect(invalid.value).not.toBeNull();
  expect(invalid.value!.favicon).toBeUndefined();
  expect(
    invalid.diagnostics.some(
      (d) => d.code === "invalid-inherited-icon" && d.severity === "warning",
    ),
  ).toBe(true);
});

it("leaves static bytes identical and rejects invalid framing and size", () => {
  const { defaultPng } = makeApng();
  expect(api.normalizeStatusIcon(icon(defaultPng))).toEqual({
    value: icon(defaultPng),
    diagnostics: [],
  });
  const corrupt = Buffer.from(defaultPng);
  corrupt.writeUInt32BE(0xffffffff, 8);
  for (const pngBase64 of [
    "GIF89a",
    defaultPng.subarray(0, -1).toString("base64"),
    corrupt.toString("base64"),
    "A".repeat(131076),
    makeApng(true, 32).defaultPng.toString("base64"),
  ]) {
    const result = api.normalizeStatusIcon({ pngBase64 });
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]!.code).toBe("invalid-icon");
  }
});

it("retains non-animation PNG metadata and color information byte-for-byte", () => {
  const { png, defaultPng } = makeApng();
  const gamma = Buffer.alloc(4);
  gamma.writeUInt32BE(45455);
  const metadata = Buffer.concat([
    pngChunk("gAMA", gamma),
    pngChunk("tEXt", Buffer.from("Title\0Original alpha")),
    pngChunk("fdAt", Buffer.from("private ancillary data")),
  ]);
  const insert = (bytes: Buffer) =>
    Buffer.concat([bytes.subarray(0, 33), metadata, bytes.subarray(33)]);
  expect(api.normalizeStatusIcon(icon(insert(png))).value).toEqual(
    icon(insert(defaultPng)),
  );
});

it("rejects array values even if they carry a PNG property", () => {
  const malformed = Object.assign([], icon(makeApng().defaultPng));
  expect(api.normalizeStatusIcon(malformed).value).toBeNull();
  expect(
    api.validateDocument({ ...api.createDocument(), icon: malformed }).value,
  ).toBeNull();
});
