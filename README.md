# @groundsgg/motd

[![CI](https://github.com/groundsgg/library-motd/actions/workflows/release.yml/badge.svg)](https://github.com/groundsgg/library-motd/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/@groundsgg/motd)](https://www.npmjs.com/package/@groundsgg/motd)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A standalone Minecraft Java server-list editor and preview. Use the TypeScript core in Node, the DOM editor in any framework, or the optional React adapter. Grounds is one consumer; no Portal, account or server connection is required.

```sh
npm install @groundsgg/motd
```

npmjs.com is the primary registry; the same package is also published to GitHub Packages. See [registry configuration and releases](docs/releasing.md).

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

React: import `ServerListEditor` or `ServerListPreview` from `@groundsgg/motd/react`, pass the same options as props, and return `onChange` values through controlled state. React >=18 is an optional peer; core and DOM consumers need no React. SSR renders an empty host and initializes in the browser.

- [Public API](docs/api.md)
- [Text formats](docs/formats.md)
- [Embedding and configuration](docs/embedding.md)
- [Client profile and reference evidence](docs/profiles.md)
- [Known limits](docs/limitations.md)

Develop with Node 24: `npm ci`, `npm run dev`, then open `/examples/dom/` or `/examples/react/`. All fonts are bundled locally. `npm run typecheck`, `npm test`, `npm run build`, `npm run test:browser`, `npm run test:package` and `npm run build:examples` validate the sources, package and examples. Install Chromium with `npx playwright install chromium` before browser tests.

See [contributing](CONTRIBUTING.md) for formatting, linting, checks and release conventions. Issue and PR templates come from the shared `groundsgg/.github` repository.

MIT code; local pixel fonts use SIL OFL 1.1. See THIRD_PARTY_NOTICES.md. No original Minecraft game assets are included in the npm archive. Client captures are test evidence only.

Preview profiles include 26.1, 26.1.1, 26.1.2, 26.2 and 26.3 alongside older references. Select a client independently of compatibility. Optional per-version asset providers keep original/host resources separate from this package. The bundled illustrations are approximate.

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
