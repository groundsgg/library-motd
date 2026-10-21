# Contributing

Use Node 24 (see `.node-version`) and npm. Node 22 is also tested in CI.

```sh
npm ci
npx playwright install chromium
npm run dev
```

Open `/examples/dom/` or `/examples/react/`. The library must remain usable without the Grounds Portal, React or a running Minecraft server.

Before opening a pull request:

```sh
npm run format
npm run lint
npm run typecheck
npm test
npm run test:release
npm run build
npm run test:node
npm run test:browser
npm run test:package
npm run build:examples
```

Use Conventional Commits for PR titles: `fix:`, `feat:`, `docs:`, `chore:`. Mark breaking changes with `!` and describe migration steps. Release Please uses squash commit titles to maintain the changelog and release PR.

Issue and pull request templates are inherited from [groundsgg/.github](https://github.com/groundsgg/.github). Do not add local copies.

Do not commit Minecraft client binaries, extracted proprietary textures, credentials or downloaded dependencies. Client screenshots under `tests/fixtures/client` are comparison evidence and are excluded from the package. See [third-party notices](THIRD_PARTY_NOTICES.md).

Maintainers: see [releasing](docs/releasing.md).
