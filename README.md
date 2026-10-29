# @groundsgg/motd

[![CI](https://github.com/groundsgg/library-motd/actions/workflows/release.yml/badge.svg)](https://github.com/groundsgg/library-motd/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/@groundsgg/motd)](https://www.npmjs.com/package/@groundsgg/motd)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A standalone Minecraft Java server-list editor and preview. Use the TypeScript core in Node, the DOM editor in any framework, or the optional React adapter. Grounds is one consumer; no Portal, account or server connection is required.

The viewer targets Vanilla Java behavior for the selected client profile. MOTDs and servericons remain supplied status snapshots; client-owned obfuscation and panorama motion are separate effects. Preview-only MOTD animation timelines are outside its scope. Profile-specific evidence and approximations remain explicit; see [native behavior and limits](https://docs.grounds.gg/reference/development/motd/vanilla-behavior).

```sh
npm install @groundsgg/motd
```

npmjs.com is the primary registry; the same package is also published to GitHub Packages. See [registry configuration and releases](https://docs.grounds.gg/reference/development/motd/releasing).

```ts
import { createDocument, parseText, java1211Profile } from "@groundsgg/motd";
import { createEditor } from "@groundsgg/motd/dom";
import "@groundsgg/motd/styles.css";

const document = createDocument(
  parseText(
    "<gold><bold>Hello</bold><newline><gray>{{players}} online",
    "minimessage",
  ).value!,
);
const context = {
  base: {
    version: { protocol: 767, name: "1.21.1" },
    players: { online: 42, max: 500, sample: [] },
    description: "",
  },
  clientProtocol: 767,
  values: { region: "EU" },
  profile: java1211Profile,
  viewportWidth: 640,
  guiScale: 2,
  serverName: "My server",
  pingMs: 35,
  animations: true,
};
const editor = createEditor(host, {
  document,
  context,
  onChange(next, change) {
    // Persist next; context and UI history are separate.
  },
});
// editor.update({...}); editor.getDocument(); editor.destroy();
```

Use `createComparison` (DOM) or `ServerListComparison` (React) for [side-by-side client comparisons](https://docs.grounds.gg/reference/development/motd/comparison) with per-client context and diagnostics.

React: import `ServerListEditor` or `ServerListPreview` from `@groundsgg/motd/react`, pass the same options as props, and return `onChange` values through controlled state. React >=18 is an optional peer; core and DOM consumers need no React. SSR renders an empty host and initializes in the browser.

- [Public API](https://docs.grounds.gg/reference/development/motd/api)
- [Text formats](https://docs.grounds.gg/reference/development/motd/formats)
- [Embedding and configuration](https://docs.grounds.gg/reference/development/motd/embedding)
- [Localization, catalogs and diagnostics](https://docs.grounds.gg/reference/development/motd/localization)
- [Opt-in gradient and alignment import assistance](https://docs.grounds.gg/reference/development/motd/import-assistance)
- [Native inline sprites and optional editor catalogs](https://docs.grounds.gg/reference/development/motd/sprites) (unreleased)
- [Static server icons and animation limits](https://docs.grounds.gg/reference/development/motd/icons)
- [Vanilla viewer behavior and native MOTD timing](https://docs.grounds.gg/reference/development/motd/vanilla-behavior)
- [Client profile and reference evidence](https://docs.grounds.gg/reference/development/motd/profiles)
- [Local font-provider inspection](https://docs.grounds.gg/reference/development/motd/resource-pack-fonts)
- [Local bitmap glyph decoding](https://docs.grounds.gg/reference/development/motd/bitmap-fonts)
- [Local Unihex glyph decoding](https://docs.grounds.gg/reference/development/motd/unihex-fonts)
- [Paired runtime sources and MOTD viewer rendering](https://docs.grounds.gg/reference/development/motd/runtime-font-source)
- [Known limits](https://docs.grounds.gg/reference/development/motd/limitations)

Develop with Node 24: `npm ci`, `npm run dev`, then open `/examples/dom/` or `/examples/react/`. Bundled fonts are local; host asset providers remain optional. `npm run typecheck`, `npm test`, `npm run build`, `npm run test:browser`, `npm run test:package` and `npm run build:examples` validate the sources, package and examples. Install the engines and dependencies with `npx playwright install --with-deps chromium firefox webkit` before browser tests. The same suite runs in all three engines; see [browser verification](https://docs.grounds.gg/reference/development/motd/browser-verification) for coverage and limits.

Builds and type checks use TypeScript 7 through the `@typescript/native` npm alias. The `typescript` alias supplies Microsoft's TypeScript 6 compatibility API for ESLint and other API consumers. This is the [TypeScript team's recommended side-by-side setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0): `npx tsc --version` reports 7.x, while `node -p "require('typescript').version"` reports 6.x. Keep both aliases until API-dependent tools support the native compiler.

See [contributing](CONTRIBUTING.md) for formatting, linting, checks and release conventions. Issue and PR templates come from the shared `groundsgg/.github` repository.

MIT code; local pixel fonts use SIL OFL 1.1. See THIRD_PARTY_NOTICES.md. No original Minecraft game assets are included in the npm archive. Client captures are test evidence only.

Preview profiles include 26.1, 26.1.1, 26.1.2, 26.2 and 26.3 alongside older references. Select a client independently of compatibility. Optional per-version asset providers keep original/host resources separate from this package. The bundled illustrations are approximate.

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
