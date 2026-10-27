import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import {
  resolveFontProviders,
  decodeBitmapGlyphs,
  decodeUnihexGlyphs,
} from "../../dist/fonts/index.js";

test("resolves a local font resource graph without browser globals or React", async () => {
  const files = new Map([
    [
      "assets/demo/font/menu.json",
      {
        providers: [
          { type: "reference", id: "demo:spacing" },
          { type: "bitmap", file: "demo:menu.png", ascent: 7, chars: ["AB"] },
        ],
      },
    ],
    [
      "assets/demo/font/spacing.json",
      { providers: [{ type: "space", advances: { " ": 4 } }] },
    ],
  ]);
  const result = await resolveFontProviders(
    "demo:menu",
    (path, { maxBytes }) => {
      const definition = files.get(path);
      if (!definition) return undefined;
      const bytes = new TextEncoder().encode(JSON.stringify(definition));
      assert.ok(bytes.length <= maxBytes);
      return bytes;
    },
  );
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.value.providers.map((p) => p.type),
    ["space", "bitmap"],
  );
  assert.deepEqual(result.value.resources, ["assets/demo/textures/menu.png"]);
  assert.equal(typeof globalThis.document, "undefined");
  assert.equal(typeof globalThis.window, "undefined");
});

test("pairs local RGBA glyph metrics and pixels without a browser image decoder", () => {
  const pixels = new Uint8ClampedArray([10, 20, 30, 128, 255, 255, 255, 0]);
  const result = decodeBitmapGlyphs(
    { height: 1, ascent: 1, chars: ["A"] },
    { width: 2, height: 1, pixels },
  );
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.value.glyphs[0].advance, 2);
  pixels.fill(0);
  assert.deepEqual(
    [...result.value.pixelsFor(65)],
    [10, 20, 30, 128, 255, 255, 255, 0],
  );
});

test("rejects an oversized grid row within a small process memory budget", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=48",
      "--input-type=module",
      "-e",
      `
    import {decodeBitmapGlyphs} from ${JSON.stringify(import.meta.resolve("../../dist/fonts/index.js"))};
    const result = decodeBitmapGlyphs(
      {height:1, ascent:1, chars:['A'.repeat(16000000)]},
      {width:1, height:1, pixels:new Uint8Array(4)},
      {maxGlyphs:1},
    );
    if(result.value !== null || result.diagnostics[0]?.code !== 'font-bitmap-limit') process.exit(1);
  `,
    ],
    { encoding: "utf8", timeout: 5000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test("pairs host-extracted Unihex glyphs with native half-pixel offsets", () => {
  const data = new TextEncoder().encode("0041:" + "38".repeat(16) + "\n");
  const result = decodeUnihexGlyphs({}, [data]);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.value.glyphs[0].advance, 2);
  assert.equal(result.value.glyphs[0].boldOffset, 0.5);
  assert.equal(result.value.glyphs[0].shadowOffset, 0.5);
  data.fill(0);
  assert.deepEqual(
    [...result.value.pixelsFor(65).subarray(0, 4)],
    [255, 255, 255, 255],
  );
});

test("bounds broad Unihex override processing in an isolated process", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import {decodeUnihexGlyphs} from ${JSON.stringify(import.meta.resolve("../../dist/fonts/index.js"))};
    const data=new TextEncoder().encode('0041:'+'38'.repeat(16)+'\\n01F600:'+'38'.repeat(16)+'\\n');
    const ranges=Array.from({length:4096},()=>({from:0,to:1114111,left:0,right:31}));
    const result=decodeUnihexGlyphs({sizeOverrides:ranges},[data]);
    if(result.diagnostics.length || result.value?.glyphs.length!==2 || result.value.glyphs.some(g=>g.advance!==17))process.exit(1);
  `,
    ],
    { encoding: "utf8", timeout: 5000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
