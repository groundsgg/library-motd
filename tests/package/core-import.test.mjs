import { test } from "node:test";
import assert from "node:assert/strict";
test("core imports without DOM or network", async () => {
  globalThis.fetch = () => {
    throw new Error("Unexpected network");
  };
  const {
    createDocument,
    writeDocument,
    readDocument,
    listVariables,
    vanillaSpriteCatalog,
    java263Profile,
  } = await import("../../dist/index.js");
  assert.deepEqual(
    readDocument(writeDocument(createDocument())).value,
    createDocument(),
  );
  assert.deepEqual(
    listVariables(
      { region: "EU" },
      { catalog: [{ name: "custom", fields: ["motd"] }], field: "motd" },
    ),
    [{ name: "custom", fields: ["motd"] }],
  );
  assert.equal("window" in globalThis, false);
  assert.equal(vanillaSpriteCatalog(java263Profile).length, 20);
  assert.equal(
    vanillaSpriteCatalog(java263Profile)[0].sprite,
    "minecraft:icon/trial_available",
  );
});
