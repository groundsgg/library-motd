# Final review and execution decisions

All ten concrete findings from a fresh independent reviewer were addressed. No minor findings were deferred.

- Ruling: createDocument defaults must be deterministic (no random IDs until text is inserted) — independent round trips remain stable — cost if wrong: IDs need an explicit migration.
- Ruling: New repository is its own isolated feature branch; no additional linked worktree is necessary — there is no pre-existing checkout to protect — cost if wrong: move checkout before collaboration.
- Ruling: font source is IdreesInc/Minecraft-Font (OFL), with documented half-unit advance correction — independent distributable assets — cost if wrong: profile needs replacement after client comparison.
- Ruling: Tasks 4 and 5 share flattenText, so they were implemented in one RED→GREEN increment — serializer requires effects — cost if wrong: commit decomposition only.
- Ruling: emulate Adventure float interpolation and rainbow sampling exactly — native fixture failures exposed different semantics — cost if wrong: dynamic color differences on proxy.
- Ruling: cached Chromium 1234 is used through an optional environment override — current Playwright browser was not cached — cost if wrong: rerun with matching installed Playwright browser before release.
- Ruling: leave profile verified:false despite passing Latin reference — broader glyph/decoration/wrapping states remain unverified — cost if wrong: clients see an overly conservative warning.
- Ruling: add Grounds-only serverListOverrides envelope — explicit reset must be distinguishable from inheritance — cost if wrong: envelope migration for maintenance metadata; core remains unchanged.
- Ruling: compare legacy strings through Adventure normalization in shared fixtures — redundant §r bytes differ but rendering is identical — cost if wrong: wire consumers that compare raw strings need canonicalization.
- Ruling: initial Portal test build used Next font mocks after DNS failure, preserving product declarations. Superseded by the final successful normal build with external DNS; no font mocks are needed for the current acceptance result.
- Final review: fresh independent reviewer /root/final_review, whole library + all three integration branches. Ten actionable findings, all accepted; warning visibility regraded Important because users could not explain unreachable custom hover. No deferred minor findings.
- Final: fixed alignment/raw token loss — protected-export tests RED→GREEN; runtime compiled-MOTD test RED→GREEN; shared fixtures and real TCP resolvedAlignment passed.
- Final: fixed opaque JSON same-format loss — protected-export neighbour edit test RED→GREEN.
- Final: fixed stale custom-version text — final-review browser mode-switch test RED→GREEN.
- Final: fixed maintenance inheritance history — metadata transaction test and adapter mapMaintenanceChange RED→GREEN; actual Portal Undo→save E2E passed.
- Final: fixed falsy runtime acceptance — Forge invalid-runtime test RED→GREEN.
- Final: fixed legacy maximum commands — proxy withMaximum test RED→GREEN; updates runtime + editor metadata.
- Final: fixed read-only ancestor fieldsets — independent reviewer reproduced disabled inspection; source/copy enabled assertions and component suite passed after moving viewer editor outside fieldset.
- Final: fixed hidden reserved counts — independent review reproduction, separate evaluatePlayerCounts and preview/inline browser regression passed.
- Final: fixed hover line style scope — proxy legacyLines test RED→GREEN; JS test, native-sample preview and shared inherited-style fixture passed.
- Final: fixed invisible diagnostics — final-review hidden-hover browser test RED→GREEN.
- Final suites after user acceptance follow-up: library 41/41 unit and 31/31 Chromium, production packed consumer + SSR + both examples; Forge 25/25 targeted plus full typecheck; Proxy180/180 velocity:check; Portal26/26 targeted plus typecheck/lint/normal build and4/4 authenticated E2E. Both real Velocity processes also passed 26.3 right-alignment status pings.
- Superseded after the requested client comparison: native references establish the red incompatible-version default and white player-hover default; both were corrected and regression-tested.
- Final: Ruling: broader native glyph fidelity remains unverified — one independent Latin reference is preserved without a full-profile claim — cost if wrong: additional glyph/decoration profiles require correction.
- Final: Ruling: Firefox and real IME remain unverified — Chromium tests and incremental ProseMirror updates do not prove those environments — cost if wrong: browser/input-specific issues before wider release.

User acceptance follow-up: reproduced icon/frame overlap and missing menu backdrop. The selection frame is separate from row content; real 1.20.4/1.21.1/1.21.11/26.1/26.2/26.3 clients establish the included geometry/text cases. Eight release presets use official protocol metadata. Native 26.1.1/26.1.2 entry classes match 26.1; those patch clients were not launched independently. Alpha upload and selected compositing match a native reference, and the React/DOM upload action has a keyboard-accessible original pixel-art image-plus glyph.

Ruling: background, icon, button and font resources belong to an optional host asset provider, outside persisted documents and npm artifacts. Own illustrations/OFL fonts remain defaults; original release panoramas and all game assets need separate rights and hosting decisions. Cost if wrong: a new licensed asset pack/provider can replace the defaults without changing the document API. Current provider hooks do not certify complete pixel-perfect native UI; the old 1.20.4 version-field position remains unverified.

Portal editor and player preview now share client, compatibility, region and example-player context, while that state stays outside saved settings. A production E2E assertion exposed the initially separate preview state; it now checks both views after selecting 26.2. Hosting is deliberately unconfigured pending the user’s choice and applicable rights; assets can be injected through the Portal wrapper.
