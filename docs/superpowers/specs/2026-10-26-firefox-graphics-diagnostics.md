# Firefox graphics diagnostics

#90 records Firefox declining a native WebGL context before panorama texture or
shader initialization. Unchanged assertions subsequently passed. Upstream
Mozilla code emits EXHAUSTED_DRIVERS when no allowed initialization path returns
a context; that label alone does not prove a context/resource count limit.

Collect evidence without forcing graphics preferences, retrying assertions or
changing production rendering. A test-only observer wraps the native getContext
call in the two panorama suites, preserving its arguments, receiver, return and
exceptions. Keep at most 32 context creation/loss/error observations and numeric
attempt totals. Error messages yield only fixed known failure codes and blocked
path flags; renderer descriptions yield fixed software/other categories. Never
retain arbitrary messages, URLs, source text or machine/user identifiers.

On unexpected failure, attach those observations with Linux CI memory, open-file
limits/counts and installed Mesa/Xvfb package versions. A two-second/16 KiB
glxinfo -B probe reports only direct-rendering/acceleration booleans, classified
renderer and bounded numeric version. Missing measurements remain null with
fixed error labels. Probe the failed runner, not an unrelated browser restart.
This remains evidence rather than a certified root cause.

Write one startup snapshot before the browser matrix under its existing Xvfb
display, without creating a GL context. Upload it on success and failure with
seven-day retention. Each JSON artifact is at most 16 KiB; no periodic sampling
or background timers. Failure attachments use the existing retained traces.
Native host collection is enabled only on Linux GitHub Actions. Ordinary local
runs keep only page-owned graphics observations. All diagnostic failures are
contained and cannot replace Playwright's test result. Keep #90 and release #67
open; preserve the preview and public GitHub-hosted runners.
