import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import * as api from "../../src/index.js";

const options = { profile: api.java1211Profile, width: 10000, maxLines: 2 };
const parse = (value: api.JsonValue) =>
  api.parseText(JSON.stringify(value), "json").value!;
const paint = (text: api.TextDocument) =>
  api
    .layoutText(text, options)
    .glyphs.map(({ text, color, style, advance, x, line }) => ({
      text,
      color,
      style,
      advance,
      x,
      line,
    }));
const action = { action: "run_command", value: "/never-execute" };

it("renders deeply nested protected arrays within a hard process deadline", () => {
  const script = `
    import {createServer} from 'vite';
    const server=await createServer({configFile:false,envFile:false,server:{middlewareMode:true,hmr:false,watch:null},logLevel:'silent'});
    try {
      const api=await server.ssrLoadModule('/src/index.ts');
      const results=[];
      for(const leaf of ['A',[]]) {
        let nested=leaf;
        for(let index=0;index<96;index++) nested=[nested];
        const source=JSON.stringify({text:'Z',color:'red',clickEvent:{action:'run_command',value:'/never-execute'},extra:[nested]});
        const parsed=api.parseText(source,'json').value;
        const glyphs=api.layoutText(parsed,{profile:api.java1211Profile,width:271}).glyphs;
        results.push({text:glyphs.map(g=>g.text).join(''),colors:glyphs.map(g=>g.color),sourceUnchanged:api.serializeText(parsed,{format:'json'}).value===source});
      }
      console.log(JSON.stringify(results));
    } finally {await server.close();}
  `;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 4000,
      killSignal: "SIGKILL",
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual([
    { text: "ZA", colors: ["#ff5555", "#ff5555"], sourceUnchanged: true },
    { text: "Z", colors: ["#ff5555"], sourceUnchanged: true },
  ]);
});

it("displays literal colors and decorations inside a protected action without changing canonical text or exports", () => {
  const literal = {
    text: "Bold",
    color: "red",
    bold: true,
    extra: [
      {
        text: " plain",
        color: "gold",
        bold: false,
        italic: true,
        underlined: true,
      },
      { text: " strike", strikethrough: true, italic: false },
    ],
  };
  const raw = {
    ...literal,
    clickEvent: action,
    hoverEvent: {
      action: "show_text",
      contents: { text: "not visible", color: "green" },
    },
  };
  const source = JSON.stringify(raw, null, 2);
  const text = api.parseText(source, "json").value!;
  const snapshot = JSON.stringify(text);
  const reduced = api.serializeText(
    text,
    { format: "legacy-section", rgb: true },
    { lossy: "reduce" },
  );
  expect(paint(text)).toEqual(paint(parse(literal)));
  expect(
    api
      .flattenText(text)
      .every(
        (char) =>
          char.color === "#aaaaaa" && Object.keys(char.style).length === 0,
      ),
  ).toBe(true);
  expect(JSON.stringify(text)).toBe(snapshot);
  expect(api.serializeText(text, { format: "json" }).value).toBe(source);
  expect(
    api.serializeText(
      text,
      { format: "legacy-section", rgb: true },
      { lossy: "reduce" },
    ),
  ).toEqual(reduced);
  const glyphs = api.layoutText(text, options).glyphs;
  expect(
    glyphs.map((glyph) => [glyph.nodeId, glyph.offset, glyph.position]),
  ).toEqual(
    api
      .flattenText(text)
      .map((char) => [char.nodeId, char.offset, char.position]),
  );
});

it("inherits outer styles and component-array styles while honoring explicit false", () => {
  const literal = {
    text: "A",
    extra: [
      [{ text: "B", color: "gold", bold: false }, "C"],
      { text: "D", italic: false },
    ],
  };
  const protectedTree = {
    text: "",
    color: "green",
    bold: true,
    italic: true,
    extra: [{ ...literal, clickEvent: action }],
  };
  const reference = { ...protectedTree, extra: [literal] };
  expect(paint(parse(protectedTree))).toEqual(paint(parse(reference)));
});

it("uses corrected bold widths for explicit layout export without breaking a protected atom", () => {
  const raw = { text: "M".repeat(42), bold: true, clickEvent: action };
  const text = parse(raw);
  const materialized = api.serializeText(
    text,
    { format: "legacy-section" },
    {
      lossy: "reduce",
      layout: { ...options, width: 271 },
    },
  );
  expect(materialized.value).toBeNull();
  expect(
    materialized.diagnostics.some((d) => d.code === "protected-layout"),
  ).toBe(true);
  expect(api.serializeText(text, { format: "json" }).value).toBe(
    JSON.stringify(raw),
  );
});

it("keeps dynamic components unresolved and metadata/HTML inert beside styled literals", () => {
  const text = parse({
    text: "A",
    color: "red",
    clickEvent: action,
    extra: [
      {
        translate: "custom.key",
        fallback: "not resolved",
        with: [{ text: "not an argument preview" }],
      },
      { selector: "@a" },
      { text: "<img src=x>", color: "gold" },
    ],
  });
  const glyphs = api.layoutText(text, options).glyphs;
  expect(glyphs.map((glyph) => glyph.text).join("")).toBe(
    "A[unsupported component][unsupported component]<img src=x>",
  );
  expect(glyphs[0]?.color).toBe("#ff5555");
  expect(glyphs.at(-1)?.color).toBe("#ffaa00");
  expect(
    api
      .layoutText(text, options)
      .diagnostics.some((d) => d.code === "protected-preview"),
  ).toBe(true);
});

it("refreshes identity-cached styles after raw/fallback changes and rejects mismatches", () => {
  const text = parse({ text: "A", color: "red", clickEvent: action });
  const node = text.nodes[0]!;
  if (node.type !== "opaque") throw new Error("expected protected atom");
  expect(paint(text)[0]?.color).toBe("#ff5555");
  node.raw = JSON.stringify({ text: "A", color: "gold", clickEvent: action });
  expect(paint(text)[0]?.color).toBe("#ffaa00");
  node.fallback = "B";
  expect(paint(text)[0]).toMatchObject({ text: "B", color: "#aaaaaa" });
  node.raw = JSON.stringify({ text: "B", color: "green", clickEvent: action });
  expect(paint(text)[0]?.color).toBe("#55ff55");
});

it("retains plain fallback for malformed, oversized and deeply nested raw values", () => {
  let deep: api.JsonValue = { text: "A", color: "red" };
  for (let index = 0; index < 130; index++) deep = { text: "", extra: [deep] };
  for (const raw of [
    "{invalid",
    JSON.stringify({ text: "A", color: "red", data: "x".repeat(65536) }),
    JSON.stringify(deep),
  ]) {
    const text: api.TextDocument = {
      revision: 0,
      nodes: [
        { id: "protected", type: "opaque", format: "json", raw, fallback: "A" },
      ],
    };
    expect(paint(text)[0]).toMatchObject({ text: "A", color: "#aaaaaa" });
    expect(text.nodes[0]).toMatchObject({ raw, fallback: "A" });
  }
});

it("accepts literal styles at the depth boundary and leaves other protected formats inert", () => {
  let value: api.JsonValue = { text: "A", color: "#12abEF", obfuscated: true };
  for (let index = 0; index < 128; index++)
    value = { text: "", extra: [value] };
  const raw = JSON.stringify(value);
  const text: api.TextDocument = {
    revision: 0,
    nodes: [
      { id: "protected", type: "opaque", format: "json", raw, fallback: "A" },
    ],
  };
  expect(paint(text)[0]).toMatchObject({
    color: "#12abEF",
    style: { obfuscated: true },
  });
  const node = text.nodes[0]!;
  if (node.type === "opaque") node.format = "minimessage";
  expect(paint(text)[0]).toMatchObject({ color: "#aaaaaa", style: {} });
});

it.each([
  ["A", "\u0301"],
  ["\ud83d", "\ude00"],
])(
  "keeps whole original graphemes when literal style boundaries split %j + %j",
  (first, second) => {
    const text = parse({
      text: first,
      color: "red",
      clickEvent: action,
      extra: [{ text: second, color: "gold" }],
    });
    const glyphs = api.layoutText(text, options).glyphs;
    expect(glyphs).toHaveLength(1);
    expect(glyphs[0]).toMatchObject({
      text: first + second,
      offset: 0,
      position: 0,
      color: "#aaaaaa",
    });
  },
);

it("ignores invalid style values and preserves source after persistence and neighboring edits", () => {
  const raw = {
    text: "A",
    color: "red",
    bold: "true",
    italic: 1,
    underlined: false,
    clickEvent: action,
  };
  const saved = api.readDocument(
    api.writeDocument(api.createDocument(parse(raw))),
  ).value!;
  expect(paint(saved.motd.text)[0]).toMatchObject({
    color: "#ff5555",
    style: { color: "#ff5555", underlined: false },
  });
  expect(paint(saved.motd.text)[0]?.style.bold).toBeUndefined();
  saved.motd.text.nodes.push({ id: "tail", type: "text", value: " next" });
  saved.motd.text.revision++;
  expect(
    api.serializeText(saved.motd.text, { format: "json" }).value,
  ).toContain(JSON.stringify(raw));
  const invalidColor = parse({
    text: "A",
    color: "url(private)",
    clickEvent: action,
  });
  expect(paint(invalidColor)[0]?.color).toBe("#aaaaaa");
});
