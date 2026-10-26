import {
  collectSnapshot,
  DiagnosticLog,
} from "./windows-resource-diagnostics.mjs";

export default class WindowsResourceReporter {
  constructor({ directory = ".browser-diagnostics", enabled = false } = {}) {
    this.directory = directory;
    this.enabled = enabled;
    this.pending = null;
    this.queuedFailure = false;
    this.lastSample = 0;
    this.failures = 0;
  }

  onBegin() {
    if (!this.enabled) return;
    try {
      this.log = new DiagnosticLog(this.directory);
      this.request("begin");
    } catch {
      // Observation failures must not replace the test result or leak OS messages.
      this.log = undefined;
    }
  }

  request(reason) {
    if (!this.log?.canSample) return;
    if (this.pending) {
      if (reason === "unexpected-failure") this.queuedFailure = true;
      return;
    }
    if (reason === "interval" && Date.now() - this.lastSample < 15000) return;
    this.lastSample = Date.now();
    this.pending = collectSnapshot(reason === "begin")
      .then((value) => this.log?.sample(reason, value))
      .catch(() => {
        this.log = undefined;
      })
      .finally(() => {
        this.pending = null;
        if (this.queuedFailure) {
          this.queuedFailure = false;
          this.request("unexpected-failure");
        }
      });
  }

  onTestBegin() {
    this.request("interval");
  }

  onTestEnd(test, result) {
    if (result.status !== test.expectedStatus && result.status !== "skipped") {
      this.failures++;
      this.request("unexpected-failure");
    }
  }

  onError() {
    this.failures++;
    this.request("unexpected-failure");
  }

  async onEnd(result) {
    while (this.pending) await this.pending;
    this.request("end");
    while (this.pending) await this.pending;
    try {
      this.log?.finish(result.status, this.failures);
    } catch {
      // Never return a Playwright status override, even when output is unavailable.
    }
  }

  printsToStdio() {
    return false;
  }
}
