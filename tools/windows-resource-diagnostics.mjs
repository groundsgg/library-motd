import { execFile } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const states = [
  "Bound",
  "Closed",
  "CloseWait",
  "Closing",
  "DeleteTCB",
  "Established",
  "FinWait1",
  "FinWait2",
  "LastAck",
  "Listen",
  "SynReceived",
  "SynSent",
  "TimeWait",
];
const errorCategories = [
  "unsupported-platform",
  "snapshot-query",
  "tcp-query",
  "memory-query",
  "process-query",
  "ipv4-range",
  "ipv6-range",
];
const numeric = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? value : null;
const counters = (value, keys) =>
  Object.fromEntries(keys.map((key) => [key, numeric(value?.[key])]));

function portRange(value) {
  const start = numeric(value?.start);
  const count = numeric(value?.count);
  return start > 0 && count > 0 && start + count <= 65536
    ? { start, count }
    : null;
}

export function sanitizeSnapshot(value) {
  return {
    tcp: {
      states: counters(value?.tcp?.states, states),
      fixture: counters(value?.tcp?.fixture, states),
    },
    memory: counters(value?.memory, [
      "availableBytes",
      "committedBytes",
      "commitLimitBytes",
      "nonpagedPoolBytes",
      "pagedPoolBytes",
    ]),
    processes: counters(value?.processes, [
      "count",
      "workingSetBytes",
      "privateBytes",
      "handles",
      "maxHandles",
    ]),
    dynamicPorts: {
      ipv4: portRange(value?.dynamicPorts?.ipv4),
      ipv6: portRange(value?.dynamicPorts?.ipv6),
    },
    errors: errorCategories.filter(
      (category) =>
        Array.isArray(value?.errors) && value.errors.includes(category),
    ),
  };
}

export async function collectSnapshot(includeRanges = false) {
  if (process.platform !== "win32" || process.env.GITHUB_ACTIONS !== "true") {
    return sanitizeSnapshot({ errors: ["unsupported-platform"] });
  }
  try {
    const script = fileURLToPath(
      new URL("./windows-resource-snapshot.ps1", import.meta.url),
    );
    const { stdout } = await execute(
      "pwsh",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-File",
        script,
        "-TestRunnerPid",
        String(process.pid),
        ...(includeRanges ? ["-IncludeRanges"] : []),
      ],
      {
        timeout: 8000,
        maxBuffer: 16 * 1024,
        windowsHide: true,
      },
    );
    return sanitizeSnapshot(JSON.parse(stdout));
  } catch {
    return sanitizeSnapshot({ errors: ["snapshot-query"] });
  }
}

export class DiagnosticLog {
  constructor(directory, { maxSamples = 120, maxBytes = 128 * 1024 } = {}) {
    this.file = path.join(directory, "resources.jsonl");
    this.maxSamples = maxSamples;
    this.maxBytes = maxBytes;
    this.samples = 0;
    this.bytes = 0;
    this.dropped = 0;
    this.full = false;
    mkdirSync(directory, { recursive: true });
    writeFileSync(this.file, "");
  }

  get canSample() {
    return !this.full && this.samples < this.maxSamples;
  }

  sample(reason, value) {
    const allowedReason = [
      "begin",
      "interval",
      "unexpected-failure",
      "end",
    ].includes(reason)
      ? reason
      : "interval";
    const line =
      JSON.stringify({
        kind: "sample",
        at: new Date().toISOString(),
        reason: allowedReason,
        observation: sanitizeSnapshot(value),
      }) + "\n";
    const size = Buffer.byteLength(line);
    if (!this.canSample || this.bytes + size > this.maxBytes - 512) {
      this.dropped++;
      this.full = true;
      return;
    }
    appendFileSync(this.file, line);
    this.bytes += size;
    this.samples++;
  }

  finish(status, failures) {
    const line =
      JSON.stringify({
        kind: "summary",
        status: ["passed", "failed", "timedout", "interrupted"].includes(status)
          ? status
          : "unknown",
        unexpectedFailures: numeric(failures),
        samples: this.samples,
        dropped: this.dropped,
      }) + "\n";
    if (this.bytes + Buffer.byteLength(line) <= this.maxBytes)
      appendFileSync(this.file, line);
    this.full = true;
  }
}
