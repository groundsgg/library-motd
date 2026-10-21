import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function assertRelease(tag, version) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag) || tag !== `v${version}`) {
    throw new Error(
      `Release tag ${tag} does not match package version ${version}`,
    );
  }
}

export function matchesIntegrity(bytes, integrity) {
  return (
    typeof integrity === "string" &&
    integrity.split(/\s+/).some((entry) => {
      const [algorithm, expected] = entry.split("-");
      return (
        algorithm === "sha512" &&
        createHash(algorithm).update(bytes).digest("base64") === expected
      );
    })
  );
}

export function isMissingPackage(error) {
  try {
    return JSON.parse(String(error.stdout)).error.code === "E404";
  } catch {
    return false;
  }
}

export function publishArchive({ archive, tag, registry }) {
  if (
    !["https://registry.npmjs.org", "https://npm.pkg.github.com"].includes(
      registry,
    )
  ) {
    throw new Error("Unexpected publishing registry");
  }
  const tarball = resolve(archive);
  const manifest = JSON.parse(
    execFileSync("tar", ["-xOf", tarball, "package/package.json"], {
      encoding: "utf8",
    }),
  );
  if (manifest.name !== "@groundsgg/motd")
    throw new Error("Unexpected package name");
  assertRelease(tag, manifest.version);
  const directory = mkdtempSync(join(tmpdir(), "motd-publish-"));
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const run = (args, options = {}) =>
    execFileSync(npm, args, { cwd: directory, encoding: "utf8", ...options });
  // The project scope overrides the developer's registry preference; credentials stay in npm's user config.
  writeFileSync(
    join(directory, ".npmrc"),
    `registry=${registry}\n@groundsgg:registry=${registry}\n`,
  );
  try {
    let integrity;
    try {
      integrity = JSON.parse(
        run(
          [
            "view",
            `${manifest.name}@${manifest.version}`,
            "dist.integrity",
            "--registry",
            registry,
            "--json",
          ],
          { stdio: ["ignore", "pipe", "pipe"] },
        ),
      );
    } catch (error) {
      if (!isMissingPackage(error)) throw error;
    }
    if (integrity !== undefined) {
      if (!matchesIntegrity(readFileSync(tarball), integrity))
        throw new Error(
          "This version already exists with different package contents",
        );
      console.log(
        `${manifest.name}@${manifest.version} already published with matching integrity at ${registry}`,
      );
      return;
    }
    run(
      [
        "publish",
        tarball,
        "--registry",
        registry,
        "--access",
        "public",
        "--ignore-scripts",
      ],
      { stdio: "inherit" },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  publishArchive({
    archive: process.argv[2],
    tag: process.env.RELEASE_TAG,
    registry: process.env.PUBLISH_REGISTRY,
  });
}
