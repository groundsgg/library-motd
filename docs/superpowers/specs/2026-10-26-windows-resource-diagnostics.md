# Windows browser resource diagnostics

Issue #89 records Windows Chromium navigation failing with `ERR_NO_BUFFER_SPACE`
before the fixture initialized. A fresh runner passed. Neither result identifies
the exhausted resource. Collect bounded observations rather than retrying tests
or changing system limits.

Only Windows GitHub Actions runs enable the extra Playwright reporter. It samples
at suite start, at most once per 15 seconds when a test starts, after unexpected
test failures, and at suite end. There is at most one native query in flight.
Each query has an 8 second timeout and a 16 KiB stdout limit. Each run writes at
most 120 samples and 128 KiB, including a final summary, to an ignored directory
outside Playwright's cleaned output directory.

The read-only PowerShell collector records numeric TCP state totals across the
runner and for fixture port 4173, aggregate process resources for the test runner
and fixture connection owners, and Windows memory counters. Initial samples also
record the configured IPv4/IPv6 TCP dynamic port ranges. Missing counters are
null with a fixed error category. Never record addresses, connection rows, process
names/arguments, test titles, arbitrary exception text, environment or secrets.

The reporter preserves Playwright's exit status, assertions and retry policy.
Diagnostic failures never replace a failed test result. An always-uploaded,
7-day CI artifact permits comparing passing and failing runners. This is
investigation evidence, not a claim that port exhaustion caused #89. Keep that
issue open until evidence supports a cause and fix. Existing public GitHub-hosted
runner labels and npm trusted publishing remain unchanged.
