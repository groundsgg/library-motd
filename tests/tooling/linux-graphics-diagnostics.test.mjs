import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  collectGraphicsSnapshot,
  encodeGraphicsDiagnostics,
  parseMemoryInfo,
  parseResourceLimits,
  parseGlxInfo,
} from "../../tools/linux-graphics-diagnostics.mjs";

test("memory and limits retain numeric observations without unrelated text", () => {
  const memory = parseMemoryInfo(
    "MemAvailable: 123 kB\nCommitted_AS: 456 kB\nCommitLimit: 789 kB\nShmem: 4 kB\nSecret: private-value",
  );
  assert.deepEqual(memory, {
    availableBytes: 125952,
    committedBytes: 466944,
    commitLimitBytes: 807936,
    sharedBytes: 4096,
  });
  assert.equal(parseMemoryInfo("MemAvailable: nope kB").availableBytes, null);
  const limits = parseResourceLimits(
    "Max open files            1024                 4096                 files\nMax processes             unlimited            unlimited            processes\nOther data private-value",
  );
  assert.deepEqual(limits, {
    openFiles: { soft: 1024, hard: 4096 },
    processes: { soft: "unlimited", hard: "unlimited" },
  });
  assert.equal(parseResourceLimits("").openFiles.soft, null);
  assert.doesNotMatch(JSON.stringify({ memory, limits }), /private-value/);
});

test("GLX output yields bounded capabilities instead of raw driver or display strings", () => {
  const result = parseGlxInfo(
    "name of display: secret-host:99\ndirect rendering: Yes\n    Accelerated: no\nOpenGL renderer string: llvmpipe (private-machine, 256 bits)\nOpenGL version string: 4.5 (Compatibility Profile) Mesa private-build\n",
  );
  assert.deepEqual(result, {
    directRendering: true,
    accelerated: false,
    renderer: "llvmpipe",
    version: "4.5",
  });
  assert.doesNotMatch(JSON.stringify(result), /secret|private|display/);
  assert.deepEqual(parseGlxInfo("unknown output"), {
    directRendering: null,
    accelerated: null,
    renderer: "unknown",
    version: null,
  });
});

test("oversized or cyclic observations produce a fixed small marker", () => {
  assert.deepEqual(JSON.parse(encodeGraphicsDiagnostics({ memory: 123 })), {
    memory: 123,
  });
  const oversized = encodeGraphicsDiagnostics({
    message: "do-not-retain".repeat(2000),
  });
  assert.ok(Buffer.byteLength(oversized) < 16384);
  assert.doesNotMatch(oversized, /do-not-retain/);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.deepEqual(JSON.parse(encodeGraphicsDiagnostics(cyclic)), {
    unavailable: "diagnostics-encoding",
  });
});

test("host collection is disabled outside Linux GitHub Actions", async () => {
  const saved = process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_ACTIONS;
  try {
    assert.deepEqual(await collectGraphicsSnapshot({ probeGlx: true }), {
      status: "not-collected",
    });
  } finally {
    if (saved === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = saved;
  }
});

test(
  "Linux CI supplies actual memory, file limits and Mesa/Xvfb package versions",
  {
    skip:
      process.platform !== "linux" ||
      process.env.GITHUB_ACTIONS !== "true" ||
      !process.env.DISPLAY,
  },
  async () => {
    const snapshot = await collectGraphicsSnapshot();
    assert.deepEqual(snapshot.errors, [], JSON.stringify(snapshot));
    assert.ok(snapshot.memory.availableBytes > 0);
    assert.ok(snapshot.openFileDescriptors > 0);
    assert.ok(snapshot.limits.openFiles.soft > 0);
    assert.match(snapshot.packages["libglx-mesa0"], /^\d/);
    assert.equal(
      snapshot.glx,
      null,
      "startup observations must not initialize GL",
    );
  },
);

test(
  "native query output, parsing and timeout failures stay bounded and omit raw messages",
  {
    skip: process.platform !== "linux" || process.env.GITHUB_ACTIONS !== "true",
  },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "motd-glx-failure-"));
    const savedPath = process.env.PATH;
    process.env.PATH = directory + path.delimiter + savedPath;
    try {
      for (const source of [
        'console.log("private-driver-data".repeat(2000))',
        'console.log("private-driver-data")',
        'setTimeout(()=>console.log("private-driver-data"),10000)',
      ]) {
        await writeFile(
          path.join(directory, "glxinfo"),
          `#!${process.execPath}\n${source}\n`,
          { mode: 0o700 },
        );
        const started = Date.now();
        const snapshot = await collectGraphicsSnapshot({ probeGlx: true });
        assert.ok(Date.now() - started < 6000);
        assert.ok(snapshot.errors.includes("glx-query"));
        assert.notEqual(snapshot.glx.status, "available");
        assert.doesNotMatch(
          encodeGraphicsDiagnostics(snapshot),
          /private-driver-data/,
        );
      }
    } finally {
      process.env.PATH = savedPath;
      await rm(directory, { recursive: true, force: true });
    }
  },
);
