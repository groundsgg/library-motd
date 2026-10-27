import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveFontProviders } from "../../dist/fonts/index.js";

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
