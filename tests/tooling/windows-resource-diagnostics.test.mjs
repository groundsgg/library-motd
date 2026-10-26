import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  collectSnapshot,
  DiagnosticLog,
  sanitizeSnapshot,
} from "../../tools/windows-resource-diagnostics.mjs";
import WindowsResourceReporter from "../../tools/windows-resource-reporter.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

function temporaryDirectory(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "motd-resource-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function readEntries(directory) {
  return readFileSync(path.join(directory, "resources.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

test("snapshot allowlist retains numeric counters and discards unrelated strings", () => {
  const result = sanitizeSnapshot({
    tcp: {
      states: { TimeWait: 42, Established: -1, Unknown: 7 },
      fixture: { Established: 2, Listen: "secret-address" },
      connections: [{ remoteAddress: "secret-address" }],
    },
    memory: { availableBytes: 1024, committedBytes: "1024" },
    processes: { count: 2, handles: Number.NaN, arguments: "secret-token" },
    dynamicPorts: {
      ipv4: { start: 49152, count: 16384 },
      ipv6: { start: 0, count: 3 },
    },
    errors: ["memory-query", "secret-token", "memory-query"],
  });
  assert.equal(result.tcp.states.TimeWait, 42);
  assert.equal(result.tcp.states.Established, null);
  assert.equal(result.tcp.fixture.Established, 2);
  assert.equal(result.tcp.fixture.Listen, null);
  assert.equal(result.memory.availableBytes, 1024);
  assert.equal(result.memory.committedBytes, null);
  assert.equal(result.processes.handles, null);
  assert.deepEqual(result.dynamicPorts.ipv4, { start: 49152, count: 16384 });
  assert.equal(result.dynamicPorts.ipv6, null);
  assert.deepEqual(result.errors, ["memory-query"]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /secret|remoteAddress|arguments|Unknown/,
  );
  assert.equal(sanitizeSnapshot(null).memory.availableBytes, null);
});

test("JSONL log bounds samples, reserves its summary and replaces an earlier run", (t) => {
  const directory = temporaryDirectory(t);
  const log = new DiagnosticLog(directory, { maxSamples: 2, maxBytes: 4096 });
  for (let index = 0; index < 20; index++)
    log.sample("interval", { secret: "discard-me" });
  log.finish("failed", 1);
  const entries = readEntries(directory);
  assert.equal(entries.filter((entry) => entry.kind === "sample").length, 2);
  assert.deepEqual(entries.at(-1), {
    kind: "summary",
    status: "failed",
    unexpectedFailures: 1,
    samples: 2,
    dropped: 18,
  });
  const smaller = new DiagnosticLog(directory, {
    maxSamples: 120,
    maxBytes: 2048,
  });
  for (let index = 0; index < 120; index++) smaller.sample("interval", {});
  smaller.finish("passed", 0);
  const contents = readFileSync(
    path.join(directory, "resources.jsonl"),
    "utf8",
  );
  assert.ok(Buffer.byteLength(contents) <= 2048);
  const resetEntries = readEntries(directory);
  assert.equal(resetEntries.at(-1).status, "passed");
  assert.ok(resetEntries.at(-1).dropped > 0);
  assert.equal(
    resetEntries.filter((entry) => entry.kind === "summary").length,
    1,
  );
  assert.doesNotMatch(contents, /discard-me/);
});

test("ordinary developer runs do not collect host resources", async () => {
  const saved = process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_ACTIONS;
  try {
    const snapshot = await collectSnapshot(true);
    assert.deepEqual(snapshot.errors, ["unsupported-platform"]);
    assert.equal(snapshot.tcp.states.TimeWait, null);
  } finally {
    if (saved === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = saved;
  }
});

test("failure-hook bursts coalesce pending observations and preserve the failure count", async (t) => {
  const directory = temporaryDirectory(t);
  const saved = process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_ACTIONS;
  try {
    const reporter = new WindowsResourceReporter({ directory, enabled: true });
    reporter.onBegin();
    for (let index = 0; index < 200; index++) {
      reporter.onTestBegin();
      reporter.onTestEnd({ expectedStatus: "passed" }, { status: "failed" });
    }
    assert.equal(await reporter.onEnd({ status: "failed" }), undefined);
    const entries = readEntries(directory);
    assert.deepEqual(
      entries
        .filter((entry) => entry.kind === "sample")
        .map((entry) => entry.reason),
      ["begin", "unexpected-failure", "end"],
    );
    assert.equal(entries.at(-1).unexpectedFailures, 200);
    assert.equal(entries.at(-1).status, "failed");
  } finally {
    if (saved === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = saved;
  }
});

test(
  "Windows CI collector returns actual TCP, memory and port-range observations",
  {
    skip: process.platform !== "win32" || process.env.GITHUB_ACTIONS !== "true",
  },
  async () => {
    const snapshot = await collectSnapshot(true);
    assert.deepEqual(snapshot.errors, [], JSON.stringify(snapshot));
    assert.ok(snapshot.tcp.states.Listen > 0);
    assert.ok(snapshot.memory.availableBytes > 0);
    assert.ok(snapshot.memory.commitLimitBytes > 0);
    assert.ok(snapshot.processes.count > 0);
    assert.ok(snapshot.dynamicPorts.ipv4.start > 0);
    assert.ok(snapshot.dynamicPorts.ipv6.start > 0);
  },
);

for (const output of ["normal", "unwritable"]) {
  test(`real Playwright failure remains failed with ${output} diagnostic output`, (t) => {
    const directory = temporaryDirectory(t);
    const outputDirectory = path.join(directory, "diagnostics");
    if (output === "unwritable")
      writeFileSync(outputDirectory, "a file, not a directory");
    const testImport = pathToFileURL(
      path.join(root, "node_modules/@playwright/test/index.mjs"),
    ).href;
    writeFileSync(
      path.join(directory, "failure.spec.mjs"),
      `import { test, expect } from ${JSON.stringify(testImport)};\n` +
        'test("intentional failure", () => expect(1).toBe(2));\n',
    );
    const config = path.join(directory, "playwright.config.mjs");
    writeFileSync(
      config,
      `export default ${JSON.stringify({
        testDir: directory,
        outputDir: path.join(directory, "results"),
        workers: 1,
        retries: 0,
        reporter: [
          [
            path.join(root, "tools/windows-resource-reporter.mjs"),
            {
              directory: outputDirectory,
              enabled: true,
            },
          ],
        ],
      })};\n`,
    );
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, "node_modules/playwright/cli.js"),
        "test",
        "--config",
        config,
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    if (output === "normal") {
      const entries = readEntries(outputDirectory);
      assert.equal(entries.at(-1).status, "failed");
      assert.equal(entries.at(-1).unexpectedFailures, 1);
      assert.ok(entries.some((entry) => entry.reason === "unexpected-failure"));
      assert.doesNotMatch(JSON.stringify(entries), /intentional failure/);
    }
  });
}
