import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve("assets/ui/panorama-demo");

test("profile demo panoramas are original, checksummed six-face assets", async () => {
  const manifest = JSON.parse(
    await readFile(resolve(directory, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.license, "CC0-1.0");
  assert.match(manifest.source, /no game files or textures/);
  assert.deepEqual(Object.keys(manifest.profiles).sort(), [
    "java-1.21.1",
    "java-26.3",
  ]);
  for (const profile of Object.values(manifest.profiles)) {
    assert.equal(profile.faces.length, 6);
    for (const face of profile.faces) {
      const bytes = await readFile(resolve(directory, face.file));
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        face.sha256,
      );
      assert.match(bytes.toString("utf8"), /<svg .*width="256" height="256"/);
    }
  }
});
