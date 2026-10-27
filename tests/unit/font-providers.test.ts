import { expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { resolveFontProviders } from "../../src/fonts/index.js";

const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));
const pack = (definitions: Record<string, unknown>) => {
  const reads: string[] = [];
  return {
    reads,
    read(path: string) {
      reads.push(path);
      return Object.hasOwn(definitions, path)
        ? bytes(definitions[path])
        : undefined;
    },
  };
};

it("expands local references in declaration order without dropping repeated providers", async () => {
  const source = pack({
    "assets/demo/font/menu.json": {
      providers: [
        { type: "space", advances: { " ": 4, "↤": -2.5 } },
        { type: "reference", id: "demo:shared" },
        { type: "reference", id: "demo:shared" },
        { type: "reference", id: "fallback" },
      ],
    },
    "assets/demo/font/shared.json": {
      providers: [
        {
          type: "bitmap",
          file: "demo:font/menu.png",
          ascent: 7,
          chars: ["A😀", "\u0000B"],
        },
      ],
    },
    "assets/minecraft/font/fallback.json": {
      providers: [
        {
          type: "unihex",
          hex_file: "minecraft:font/unicode.zip",
          size_overrides: [{ from: "A", to: "Z", left: 0, right: 7 }],
        },
      ],
    },
  });
  const result = await resolveFontProviders("demo:menu", source.read);
  expect(result.diagnostics).toEqual([]);
  expect(result.value).toMatchObject({
    schemaVersion: 1,
    fontId: "demo:menu",
    flags: { uniform: false, jp: false },
    providers: [
      {
        type: "space",
        fontId: "demo:menu",
        providerIndex: 0,
        advances: { " ": 4, "↤": -2.5 },
      },
      {
        type: "bitmap",
        fontId: "demo:shared",
        providerIndex: 0,
        file: "demo:font/menu.png",
        resourcePath: "assets/demo/textures/font/menu.png",
        height: 8,
        ascent: 7,
        chars: ["A😀", "\u0000B"],
      },
      { type: "bitmap", fontId: "demo:shared", providerIndex: 0 },
      {
        type: "unihex",
        fontId: "minecraft:fallback",
        resourcePath: "assets/minecraft/font/unicode.zip",
        sizeOverrides: [{ from: 65, to: 90, left: 0, right: 7 }],
      },
    ],
    resources: [
      "assets/demo/textures/font/menu.png",
      "assets/minecraft/font/unicode.zip",
    ],
    fontFiles: [
      "assets/demo/font/menu.json",
      "assets/demo/font/shared.json",
      "assets/minecraft/font/fallback.json",
    ],
  });
  expect(source.reads).toEqual([
    "assets/demo/font/menu.json",
    "assets/demo/font/shared.json",
    "assets/minecraft/font/fallback.json",
  ]);
});

it("only reads active reference branches with explicit option flags", async () => {
  const source = pack({
    "assets/demo/font/menu.json": {
      providers: [
        { type: "reference", id: "demo:absent", filter: { uniform: false } },
        { type: "ttf", file: "demo:unused.ttf", filter: { jp: true } },
        {
          type: "space",
          advances: { " ": 3 },
          filter: { uniform: true, jp: false },
        },
      ],
    },
  });
  const result = await resolveFontProviders("demo:menu", source.read, {
    flags: { uniform: true },
  });
  expect(result.diagnostics).toEqual([]);
  expect(result.value?.providers).toHaveLength(1);
  expect(source.reads).toEqual(["assets/demo/font/menu.json"]);
});

for (const id of [
  "../bad",
  "demo:../bad",
  "demo:a/../../b",
  "https://x/font",
  "demo:/absolute",
  "demo:a//b",
  "demo:a\\b",
  "demo:a%2fb",
  "DEMO:a",
  "demo:a.",
  "demo:.",
])
  it(`rejects unsafe resource id ${JSON.stringify(id)} before reading`, async () => {
    const source = pack({});
    const result = await resolveFontProviders(id, source.read);
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("font-resource-id");
    expect(source.reads).toEqual([]);
  });

for (const provider of [
  { type: "bitmap", file: "demo:../image.png", ascent: 7, chars: ["A"] },
  { type: "bitmap", file: "demo:f.png", ascent: 9, height: 8, chars: ["A"] },
  { type: "bitmap", file: "demo:f.png", ascent: 0, height: 0.5, chars: ["A"] },
  { type: "bitmap", file: "demo:f.png", ascent: 7, height: null, chars: ["A"] },
  { type: "unihex", hex_file: "demo:f.zip", size_overrides: null },
  { type: "bitmap", file: "demo:f.png", ascent: 7, chars: ["AB", "C"] },
  { type: "bitmap", file: "demo:f.png", ascent: 7, chars: ["\ud800"] },
  { type: "space", advances: { AB: 2 } },
  { type: "space", advances: { A: null } },
  { type: "space", advances: { A: 1e100 } },
  { type: "space", advances: { A: 2 }, filter: { uniform: 1 } },
  { type: "space", advances: {}, filter: { future: false } },
  {
    type: "unihex",
    hex_file: "demo:f.zip",
    size_overrides: [{ from: "Z", to: "A", left: 0, right: 7 }],
  },
  {
    type: "unihex",
    hex_file: "demo:f.zip",
    size_overrides: [{ from: "A", to: "A", left: 0, right: 7 }],
  },
  {
    type: "unihex",
    hex_file: "demo:f.zip",
    size_overrides: [{ from: "A", to: "Z", left: 0.5, right: 7 }],
  },
])
  it(`rejects malformed active metadata ${JSON.stringify(provider)}`, async () => {
    const source = pack({
      "assets/demo/font/menu.json": { providers: [provider] },
    });
    const result = await resolveFontProviders("demo:menu", source.read);
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]?.severity).toBe("error");
  });

it("fails atomically on an unsupported active provider", async () => {
  const source = pack({
    "assets/demo/font/menu.json": {
      providers: [
        { type: "space", advances: { A: 4 } },
        { type: "ttf", file: "demo:f.ttf" },
      ],
    },
  });
  const result = await resolveFontProviders("demo:menu", source.read);
  expect(result.value).toBeNull();
  expect(result.diagnostics[0]?.code).toBe("font-provider-unsupported");
  expect(result.diagnostics[0]?.path).toContain("providers[1]");
});

it("reports cycles with no repeated I/O", async () => {
  const source = pack({
    "assets/demo/font/a.json": {
      providers: [{ type: "reference", id: "demo:b" }],
    },
    "assets/demo/font/b.json": {
      providers: [{ type: "reference", id: "demo:a" }],
    },
  });
  const result = await resolveFontProviders("demo:a", source.read);
  expect(result.diagnostics[0]?.code).toBe("font-reference-cycle");
  expect(result.value).toBeNull();
  expect(source.reads).toHaveLength(2);
});

for (const limits of [
  { maxFontFiles: 1 },
  { maxDepth: 1 },
  { maxProviders: 1 },
  { maxProviderVisits: 2 },
  { maxGlyphs: 1 },
  { maxDefinitionBytes: 10 },
  { maxTotalBytes: 10 },
])
  it(`enforces the configured budget ${JSON.stringify(limits)}`, async () => {
    const source = pack({
      "assets/demo/font/a.json": {
        providers: [
          { type: "reference", id: "demo:b" },
          { type: "reference", id: "demo:b" },
        ],
      },
      "assets/demo/font/b.json": {
        providers: [{ type: "reference", id: "demo:c" }],
      },
      "assets/demo/font/c.json": {
        providers: [{ type: "space", advances: { A: 1, B: 2 } }],
      },
    });
    const result = await resolveFontProviders("demo:a", source.read, {
      limits,
    });
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("font-limit");
  });

it("bounds repeated references even when the graph only contains empty providers", async () => {
  const definitions: Record<string, unknown> = {};
  for (let i = 0; i < 12; i++)
    definitions[`assets/demo/font/n${i}.json`] = {
      providers:
        i === 11
          ? []
          : Array.from({ length: 2 }, () => ({
              type: "reference",
              id: `demo:n${i + 1}`,
            })),
    };
  const source = pack(definitions);
  const result = await resolveFontProviders("demo:n0", source.read, {
    limits: { maxProviderVisits: 30 },
  });
  expect(result.value).toBeNull();
  expect(result.diagnostics[0]?.code).toBe("font-limit");
  expect(source.reads.length).toBeLessThanOrEqual(12);
});

it("counts inactive declarations towards the traversal budget", async () => {
  const source = pack({
    "assets/demo/font/a.json": {
      providers: Array.from({ length: 5 }, () => ({
        type: "reference",
        id: "demo:absent",
        filter: { uniform: true },
      })),
    },
  });
  const result = await resolveFontProviders("demo:a", source.read, {
    limits: { maxProviderVisits: 4 },
  });
  expect(result.diagnostics[0]?.code).toBe("font-limit");
  expect(source.reads).toHaveLength(1);
});

it("passes the remaining byte budget to the reader and enforces actual bytes", async () => {
  const first = bytes({ providers: [{ type: "reference", id: "demo:b" }] });
  const budgets: number[] = [];
  const result = await resolveFontProviders(
    "demo:a",
    (path, request) => {
      budgets.push(request.maxBytes);
      return path.endsWith("a.json") ? first : bytes({ providers: [] });
    },
    { limits: { maxDefinitionBytes: 300, maxTotalBytes: first.length + 4 } },
  );
  expect(budgets).toEqual([first.length + 4, 4]);
  expect(result.diagnostics[0]?.code).toBe("font-limit");
});

for (const data of [
  new Uint8Array([0xff]),
  new TextEncoder().encode("{broken"),
  bytes([]),
  bytes({ providers: {} }),
])
  it("reports malformed UTF-8 or JSON definitions without throwing", async () => {
    const result = await resolveFontProviders("demo:a", () => data);
    expect(result.value).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("font-definition");
  });

it("accepts byte views from a different realm", async () => {
  const data = runInNewContext(
    `new Uint8Array(${JSON.stringify([...bytes({ providers: [] })])})`,
  ) as Uint8Array;
  expect(
    (await resolveFontProviders("demo:a", () => data)).value?.providers,
  ).toEqual([]);
});

it("reports missing resources and hides host exception contents", async () => {
  expect(
    (await resolveFontProviders("demo:a", () => undefined)).diagnostics[0]
      ?.code,
  ).toBe("font-resource-missing");
  const result = await resolveFontProviders("demo:a", () => {
    throw new Error("private/path/token");
  });
  expect(result.diagnostics[0]?.code).toBe("font-read");
  expect(JSON.stringify(result)).not.toContain("private/path/token");
});

it("returns a deeply immutable graph", async () => {
  const source = pack({
    "assets/demo/font/a.json": {
      providers: [{ type: "space", advances: { A: 4 } }],
    },
  });
  const graph = (await resolveFontProviders("demo:a", source.read)).value!;
  expect(Object.isFrozen(graph)).toBe(true);
  expect(Object.isFrozen(graph.providers)).toBe(true);
  const provider = graph.providers[0]!;
  expect(Object.isFrozen(provider)).toBe(true);
  if (provider.type === "space")
    expect(Object.isFrozen(provider.advances)).toBe(true);
});

it("cancels before reading and while an uncooperative reader is pending", async () => {
  const controller = new AbortController();
  const source = pack({});
  controller.abort();
  expect(
    (
      await resolveFontProviders("demo:a", source.read, {
        signal: controller.signal,
      })
    ).diagnostics[0]?.code,
  ).toBe("font-cancelled");
  expect(source.reads).toEqual([]);
  const pending = new AbortController();
  let started!: () => void;
  const reading = new Promise<void>((resolve) => {
    started = resolve;
  });
  const resolution = resolveFontProviders(
    "demo:a",
    async (_path, request) => {
      expect(request.signal).toBe(pending.signal);
      started();
      return new Promise<Uint8Array>(() => {});
    },
    { signal: pending.signal },
  );
  await reading;
  pending.abort();
  expect((await resolution).diagnostics[0]?.code).toBe("font-cancelled");
});

for (const options of [
  { limits: { maxDepth: -1 } },
  { limits: { maxFontFiles: Infinity } },
  { limits: { unknown: 1 } },
  { flags: { uniform: "true" } },
  { flags: { future: true } },
])
  it("rejects invalid options before I/O", async () => {
    const source = pack({});
    const result = await resolveFontProviders(
      "demo:a",
      source.read,
      options as any,
    );
    expect(result.diagnostics[0]?.code).toBe("font-options");
    expect(source.reads).toEqual([]);
  });

it("bounds Unihex override metadata across repeated references", async () => {
  const source = pack({
    "assets/demo/font/a.json": {
      providers: [
        { type: "reference", id: "demo:b" },
        { type: "reference", id: "demo:b" },
      ],
    },
    "assets/demo/font/b.json": {
      providers: [
        {
          type: "unihex",
          hex_file: "demo:f.zip",
          size_overrides: [{ from: "A", to: "Z", left: 0, right: 7 }],
        },
      ],
    },
  });
  const result = await resolveFontProviders("demo:a", source.read, {
    limits: { maxOverrides: 1 },
  });
  expect(result.value).toBeNull();
  expect(result.diagnostics[0]?.code).toBe("font-limit");
  expect(result.diagnostics[0]?.parameters).toEqual({ limit: "maxOverrides" });
});

it("preserves native integer metadata and float32 space advances without decoding glyphs", async () => {
  const source = pack({
    "assets/demo/font/a.json": {
      providers: [
        {
          type: "bitmap",
          file: "font/menu.png",
          height: 0,
          ascent: -1,
          chars: ["A"],
        },
        { type: "space", advances: { A: 0.1 } },
      ],
    },
  });
  const result = await resolveFontProviders("demo:a", source.read);
  expect(result.diagnostics).toEqual([]);
  expect(result.value?.providers).toMatchObject([
    {
      type: "bitmap",
      height: 0,
      ascent: -1,
      file: "minecraft:font/menu.png",
      resourcePath: "assets/minecraft/textures/font/menu.png",
    },
    { type: "space", advances: { A: 0.10000000149011612 } },
  ]);
});
