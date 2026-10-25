# Composition paint recovery

Issue #87 follows a native Chromium composition-recovery CI failure. After
access was restored, an assumed end caret inserted X in the middle. The same
artifact retained the composition-only rendering marker. These are distinct
requirements of the same recovery path: establish the edit's source position,
and leave live-text fallback only while a composition actually owns it.

The controller may reconfigure the display plugin in an earlier composition-end
microtask. A destroyed plugin must not dispatch updates, but must still release
its own finished composition's paint mode. A later composition must retain its
mode even if an older callback runs afterward. Track ownership privately per
editor DOM node; do not change public APIs or persisted documents.

Use existing rendered-range helpers for native test preconditions. Keep the
shortcut/edit/rejection assertions, and add observable rendering checks for
supported glyphs after native replacement/access recovery. Add a cross-engine
lifecycle case for back-to-back composition-end/start, preserving the current
preedit mode until the newer composition ends. Retain source/history semantics.

No new permission policy, keyboard workaround, arbitrary sleep or test retry.
CDP and synthetic lifecycle coverage do not certify a physical IME or screen
reader; #17 remains the manual verification boundary.
