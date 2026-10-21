import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertRelease,
  matchesIntegrity,
  isMissingPackage,
  publishArchive,
} from "../../tools/publish-package.mjs";

test("publishing requires a stable tag matching the packed version", () => {
  assert.doesNotThrow(() => assertRelease("v0.1.0", "0.1.0"));
  for (const tag of ["main", "v0.2.0", "0.1.0", "v0.1.0-beta.1"]) {
    assert.throws(() => assertRelease(tag, "0.1.0"));
  }
});
test("retry skips only byte-identical SHA512 artifacts", () => {
  const bytes = Buffer.from("packed release");
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  assert.equal(matchesIntegrity(bytes, integrity), true);
  assert.equal(
    matchesIntegrity(Buffer.from("other release"), integrity),
    false,
  );
  for (const invalid of [undefined, "", "sha1-weak", "sha512-invalid"]) {
    assert.equal(matchesIntegrity(bytes, invalid), false);
  }
});
test("authentication and transport failures never count as unpublished", () => {
  assert.equal(isMissingPackage({ stdout: '{"error":{"code":"E404"}}' }), true);
  for (const code of ["E401", "E403", "E500", "ETIMEDOUT"]) {
    assert.equal(
      isMissingPackage({ stdout: JSON.stringify({ error: { code } }) }),
      false,
    );
  }
  assert.equal(isMissingPackage({ stdout: "invalid JSON" }), false);
});
test("publication rejects unexpected registries before reading an artifact", () => {
  assert.throws(
    () => publishArchive({ registry: "https://example.com" }),
    /Unexpected publishing registry/,
  );
});
