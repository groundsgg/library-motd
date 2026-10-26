# Windows Resource Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain bounded Windows resource evidence for intermittent browser startup/navigation failures in #89.

**Architecture:** An additional CI-only Playwright reporter requests a read-only PowerShell snapshot. A numeric allowlist and bounded JSONL writer isolate diagnostic data from test results. Existing runners and browser invocations stay unchanged.

**Tech Stack:** Node 22/24, Playwright reporter API, PowerShell, GitHub Actions artifacts.

**Spec:** `docs/superpowers/specs/2026-10-26-windows-resource-diagnostics.md`

## Global Constraints

- Only Windows GitHub Actions runs enable the extra Playwright reporter.
- There is at most one native query in flight.
- Each query has an 8 second timeout and a 16 KiB stdout limit.
- Each run writes at most 120 samples and 128 KiB, including a final summary.
- Preserve Playwright's exit status, assertions and retry policy.
- Never record addresses, connection rows, process names/arguments, test titles, arbitrary exception text, environment or secrets.
- Keep #89 and release PR #67 open; preserve the running user preview.

## Review Focus

- Native query failures produce missing data, never fabricated zero measurements.
- Large or malformed native output cannot grow or leak through the artifact.
- Repeated failure hooks cannot overlap native queries or exceed the sample budget.
- A failed Playwright test remains failed when the reporter or artifact writer fails.
- A second run replaces old diagnostic data; collection never runs on an ordinary developer machine.

### Task 1: Add the bounded diagnostic reporter and CI artifact

**Files:** Create `tools/windows-resource-diagnostics.mjs`, `tools/windows-resource-reporter.mjs`, `tools/windows-resource-snapshot.ps1`, `tests/tooling/windows-resource-diagnostics.test.mjs`. Modify `playwright.config.ts`, `.github/workflows/ci.yml`, `.gitignore`, `docs/browser-verification.md`.

**Interfaces:** `sanitizeSnapshot(value)` returns only fixed numeric fields and error categories. `DiagnosticLog(directory, limits)` replaces `resources.jsonl` and exposes `sample(reason, snapshot)` and `finish(status, failures)`. `collectSnapshot(includeRanges)` asynchronously returns a sanitized observation. The default reporter class uses the normal Playwright lifecycle; `onEnd` returns no status override.

- [ ] Write tests for numeric allowlisting/missing values, bounded real file output and run reset, plus a real intentionally failing Playwright fixture with normal and unwritable diagnostic output paths.
- [ ] Run `node --test tests/tooling/windows-resource-diagnostics.test.mjs`; observe missing implementation failure.
- [ ] Implement collector, writer and reporter; test non-Windows collection explicitly returns unsupported without host queries. Keep native invocation single flight and bound samples at the reporter and writer.
- [ ] Wire the Windows CI reporter and always-uploaded 7-day artifact. Document fields, limits and interpretation.
- [ ] Run `npm run test:release`, lint, typecheck, formatting and PowerShell syntax validation. Review the fresh CI artifact for actual Windows counters before claiming usable evidence.
- [ ] Commit as `ci: collect bounded Windows browser resource diagnostics`, open a PR referencing #89, and request independent review.
- [ ] Merge only after current main release validation and PR checks are green. Leave #89 open pending actual failure evidence.
