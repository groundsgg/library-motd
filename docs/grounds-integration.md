# Grounds integration and validation

The library is consumed unchanged through its public package. Portal and Forge pin `@groundsgg/motd` to the published npmjs.com version `0.1.1`; consumer lockfiles use that registry and the vendored 0.1.0 archives have been removed. The library remains usable independently of Grounds, including without React.

Forge adds optional `serverList`, `editor`, `serverListFallbackText` to both legacy settings envelopes. It validates the document, recompiles the runtime template and MiniMessage fallback, rejects contradictions and fully decodes PNGs before persistence. Existing Stage/Production permissions, optimistic version strings, audit and 262144-byte request limits remain in place. Stored legacy fallback edits discard stale editor source while keeping independent status rules.

Maintenance additionally stores `serverListOverrides`, the explicit field names changed in this environment. This Grounds-only envelope field distinguishes inheritance from deliberate resets (automatic version, removed icon, unhidden players). The universal library's model is unchanged. Empty maintenance text keeps the normal MOTD; player rules with inherit keep the normal rules. Ended maintenance removes the complete override.

The proxy consumes cached config and network presence. It resolves displayed count rules before player placeholders, caches decoded icons and static auxiliary text at refresh, and retains the previous snapshot on malformed data or refresh failure. The backwards-compatible MiniMessage field remains available to old proxies. When its comparison marker matches, current proxies resolve the semantic template before native effects and pixel alignment; stale legacy text uses its current fallback. New command text changes invalidate stale editor source while retaining independent status settings.

Portal embeds the public React editor for both normal and maintenance messages. Context and example player values are separate from persisted documents. Region and example count are selectable. This route currently has no authorized live network-presence endpoint; the example count is labeled explicitly. No local proxy count is presented as a network count.

Verified: independent Java 1.21.1 foreground text reference; 41 core/unit tests; Chromium interaction suite; install from npm pack without React; React SSR; a production-bundled packed consumer; both standalone example builds. Forge configuration/route/contract tests preserve authorization and 409 behavior. Portal typecheck, lint, unit/component tests, production build and actual authenticated-page browser tests cover inline editing, version mode, conflict payloads, drafts, environments and mobile overflow.

Two actual Velocity 4.2.0 processes at 127.0.0.1:25611 and :25612 were tested with separate cached stores and local baseline counts 3/5, shared network count 8, region-specific text, icon, sample hover, displayed 10/20 rules, maintenance start/end, invalid icon and failed refresh. The harness uses the unchanged production handler but local adapters, so live NATS/service-config delivery is outside this test. Raw responses and reproducible scripts are in the proxy branch under docs/server-list and tools/server-list.

Portal's final normal production build succeeded with the existing external font declarations, followed by four authenticated browser tests. npmjs.com publication and GitHub Packages mirroring are complete. Actual IME/Firefox verification and broader client profile validation remain separate work.

Fresh review produced ten concrete findings, all addressed in one tested fix pass: aligned placeholder/protected export, same-format opaque JSON, stale custom version text, maintenance inheritance history, falsy runtime payloads, legacy maximum commands, read-only inspection/export, hidden reserved counts, independent hover-line styles and visible evaluation warnings. The final test evidence and deliberate limits are in docs/review.md.

## October 2026 integration rollout

The approved rollout uses Forge 4.16.0 and proxy commit `0b9481f9ddb65d3daa9049eb5bd871fea3fa8c72` with immutable image digests. The proxy JAR server is updated before rolling both Java proxy replicas and the Bedrock proxy. A regression test covers maintenance ending during a ping; every maintenance decision uses the same sampled instant. The final proxy suite passes 182 tests.

Forge's Core preview contains only the Forge Helm release image/chart update. Existing Stage/Production activation flags, secrets, bindings and resource-pack mutation settings are retained. Production network configuration is not enabled by this rollout.

Portal commit `11224a62ba68b95146734d1e8df1e0ab89a3a8e1` is built through Cloudflare Workers Builds. Deployment activates that build's Worker version directly; no Portal release, tag or release-production workflow is used. Portal CI, including the authenticated editor E2E suite, passes. Deployment manifests pass all 111 contract tests.

Live activation verified on 2026-10-21: Worker version `ab601db3-662a-418c-b862-be6fa49406b6` receives 100% of Portal traffic. Worker settings and bindings match the pre-deployment snapshot. The login page, a JavaScript asset and the unauthenticated session endpoint return HTTP 200. Both Forge replicas run 4.16.0 and are ready; both Java proxies and the Bedrock proxy were replaced and are ready. Stage remains enabled, Production remains unconfigured.

Source and rollout references: [Portal #566](https://github.com/groundsgg/grounds-portal/pull/566), [Forge #597](https://github.com/groundsgg/grounds-forge/pull/597), [Proxy #104](https://github.com/groundsgg/plugin-proxy/pull/104), [Core pins #171](https://github.com/groundsgg/grounds-pulumi/pull/171), [JAR server #381](https://github.com/groundsgg/deploy/pull/381), [all proxy profiles #382](https://github.com/groundsgg/deploy/pull/382).
