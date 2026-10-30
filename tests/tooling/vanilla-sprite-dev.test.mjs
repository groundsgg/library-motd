import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  vanillaSpriteMiddleware,
  vanillaSpriteDevPlugin,
} from "../../tools/vanilla-sprite-dev.mjs";

test("private Vanilla asset endpoint is explicit, bounded and does not expose neighboring files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "motd-native-assets-"));
  await mkdir(join(directory, "26.3", "icon"), { recursive: true });
  await writeFile(
    join(directory, "26.3", "manifest.json"),
    '{"clientVersion":"26.3"}',
  );
  await writeFile(
    join(directory, "26.3", "icon", "trial_available-0.png"),
    "own-test-image",
  );
  const secret = join(directory, "private.txt");
  await writeFile(secret, "not-public");
  await symlink(secret, join(directory, "26.3", "icon", "escape-0.png"));
  let active;
  const server = createServer((req, res) =>
    active(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/_motd/vanilla-sprites/`;
  try {
    active = vanillaSpriteMiddleware();
    assert.equal((await fetch(base + "26.3/manifest.json")).status, 404);
    active = vanillaSpriteMiddleware(directory);
    const manifest = await fetch(base + "26.3/manifest.json");
    assert.equal(manifest.status, 200);
    assert.equal(manifest.headers.get("cache-control"), "no-store");
    assert.deepEqual(await manifest.json(), { clientVersion: "26.3" });
    assert.equal(
      await (await fetch(base + "26.3/icon/trial_available-0.png")).text(),
      "own-test-image",
    );
    for (const path of [
      "26.3/private.txt",
      "26.3/icon/escape-0.png",
      "26.3/%2e%2e/private.txt",
      "99.9/manifest.json",
    ])
      assert.equal((await fetch(base + path)).status, 404);
    assert.equal(
      (await fetch(base + "26.3/manifest.json", { method: "POST" })).status,
      405,
    );
    await writeFile(
      join(directory, "26.3", "manifest.json"),
      "x".repeat(65537),
    );
    assert.equal((await fetch(base + "26.3/manifest.json")).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("private resources cannot be enabled on a publicly bound dev server", () => {
  const old = process.env.MOTD_VANILLA_SPRITE_DIR;
  process.env.MOTD_VANILLA_SPRITE_DIR = "/explicit/private/resources";
  try {
    assert.throws(
      () =>
        vanillaSpriteDevPlugin().configureServer({
          config: { server: { host: "0.0.0.0" } },
        }),
      /loopback/,
    );
  } finally {
    if (old === undefined) delete process.env.MOTD_VANILLA_SPRITE_DIR;
    else process.env.MOTD_VANILLA_SPRITE_DIR = old;
  }
});
