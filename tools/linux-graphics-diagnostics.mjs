import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);
const queryOptions = { timeout: 2000, maxBuffer: 16 * 1024 };
const number = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) >= 0
    ? Number(value)
    : null;

export function parseMemoryInfo(source) {
  return Object.fromEntries(
    Object.entries({
      availableBytes: "MemAvailable",
      committedBytes: "Committed_AS",
      commitLimitBytes: "CommitLimit",
      sharedBytes: "Shmem",
    }).map(([key, name]) => {
      const match = source.match(new RegExp(`^${name}:\\s*(\\d+) kB$`, "m"));
      return [key, match ? number(Number(match[1]) * 1024) : null];
    }),
  );
}

export function parseResourceLimits(source) {
  return Object.fromEntries(
    Object.entries({
      openFiles: "Max open files",
      processes: "Max processes",
    }).map(([key, name]) => {
      const match = source.match(
        new RegExp(`^${name}\\s+(\\d+|unlimited)\\s+(\\d+|unlimited)\\s`, "m"),
      );
      const limit = (value) =>
        value === "unlimited"
          ? value
          : value === undefined
            ? null
            : number(value);
      return [key, { soft: limit(match?.[1]), hard: limit(match?.[2]) }];
    }),
  );
}

export function parseGlxInfo(source) {
  const flag = (name) => {
    const match = source.match(
      new RegExp(`^\\s*${name}:\\s*(yes|no)\\s*$`, "im"),
    );
    return match ? match[1].toLowerCase() === "yes" : null;
  };
  const renderer = source.match(/^OpenGL renderer string:\s*(.*)$/m)?.[1] ?? "";
  return {
    directRendering: flag("direct rendering"),
    accelerated: flag("Accelerated"),
    renderer: /llvmpipe/i.test(renderer)
      ? "llvmpipe"
      : /softpipe/i.test(renderer)
        ? "softpipe"
        : renderer
          ? "other"
          : "unknown",
    version:
      source.match(
        /^OpenGL version string:\s*(\d{1,3}\.\d{1,3}(?:\.\d{1,3})?)/m,
      )?.[1] ?? null,
  };
}

export async function collectGraphicsSnapshot({ probeGlx = false } = {}) {
  if (process.platform !== "linux" || process.env.GITHUB_ACTIONS !== "true")
    return { status: "not-collected" };
  const errors = [];
  const read = async (file, label) => {
    try {
      return await readFile(file, "utf8");
    } catch {
      errors.push(label);
      return "";
    }
  };
  const [memory, limits] = await Promise.all([
    read("/proc/meminfo", "memory-query"),
    read("/proc/self/limits", "limits-query"),
  ]);
  const memoryValues = parseMemoryInfo(memory),
    limitValues = parseResourceLimits(limits);
  if (
    Object.values(memoryValues).some((value) => value === null) &&
    !errors.includes("memory-query")
  )
    errors.push("memory-query");
  if (
    Object.values(limitValues).some(
      (value) => value.soft === null || value.hard === null,
    ) &&
    !errors.includes("limits-query")
  )
    errors.push("limits-query");
  let openFileDescriptors = null;
  try {
    openFileDescriptors = (await readdir("/proc/self/fd")).length;
  } catch {
    errors.push("file-descriptors-query");
  }
  const names = ["libegl-mesa0", "libglx-mesa0", "libgl1-mesa-dri", "xvfb"];
  const packages = Object.fromEntries(names.map((name) => [name, null]));
  try {
    const { stdout } = await execute(
      "dpkg-query",
      ["-W", "-f=${Package}\t${Version}\n", ...names],
      queryOptions,
    );
    for (const line of stdout.split("\n")) {
      const [name, version] = line.split("\t");
      if (
        names.includes(name) &&
        /^[0-9][A-Za-z0-9.+:~_-]{0,63}$/.test(version ?? "")
      )
        packages[name] = version;
    }
    if (Object.values(packages).some((version) => version === null))
      errors.push("packages-query");
  } catch {
    errors.push("packages-query");
  }
  let glx = null;
  if (probeGlx) {
    try {
      const { stdout } = await execute("glxinfo", ["-B"], queryOptions);
      const parsed = parseGlxInfo(stdout);
      const available =
        parsed.directRendering !== null && parsed.version !== null;
      glx = { status: available ? "available" : "unparsed", ...parsed };
      if (!available) errors.push("glx-query");
    } catch {
      glx = { status: "unavailable" };
      errors.push("glx-query");
    }
  }
  return {
    status: "collected",
    at: new Date().toISOString(),
    displayPresent: Boolean(process.env.DISPLAY),
    softwareRenderingRequested: process.env.LIBGL_ALWAYS_SOFTWARE === "1",
    memory: memoryValues,
    limits: limitValues,
    openFileDescriptors,
    packages,
    glx,
    errors,
  };
}

export function encodeGraphicsDiagnostics(value) {
  try {
    const encoded = JSON.stringify(value);
    if (Buffer.byteLength(encoded) <= 16 * 1024) return encoded;
  } catch {
    /* Malformed diagnostic data never replaces a test failure. */
  }
  return JSON.stringify({ unavailable: "diagnostics-encoding" });
}
