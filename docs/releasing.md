# Releasing

The canonical package is [`@groundsgg/motd` on npm](https://www.npmjs.com/package/@groundsgg/motd). GitHub Packages mirrors exactly the same archive and version. npm consumers do not need GitHub credentials.

## Normal releases

1. Merge Conventional Commit PRs into `main`. The Release workflow runs all CI checks before updating the Release Please PR.
2. Review and merge the release PR after its CI checks pass. Release Please updates `package.json`, the lockfile, the changelog and its manifest, then creates `vX.Y.Z` and a GitHub release.
3. The same workflow publishes its tested archive to npm through OIDC and to GitHub Packages with `GITHUB_TOKEN`. There is no long-lived npm token.

Release PR CI is dispatched explicitly because a PR created with `GITHUB_TOKEN` does not trigger another workflow automatically. No personal access token is needed.

Both registries receive the same bytes. The publisher rejects tag/version mismatches, unknown registries and existing versions with different integrity. Authentication and network errors fail the job. To recover a failed publication, run the Release workflow manually with the existing release tag. It rebuilds and verifies the tagged source; an already published version is skipped only when its SHA512 integrity matches. Changes to package tooling must be released under a new version.

The `npm` and `github-packages` GitHub environments isolate publication permissions. npm's trusted publisher must name `groundsgg/library-motd`, workflow `release.yml` and environment `npm`. Actions run on GitHub-hosted Ubuntu runners. Node 24 supplies an npm version supporting trusted publishing.

## First npm publication

npm requires an existing package before configuring a trusted publisher. An npm organization owner must publish the first validated CI archive once using their normal npm login and complete npm's interactive authentication, then configure:

```sh
npm trust github @groundsgg/motd \
  --repository groundsgg/library-motd \
  --file release.yml \
  --environment npm \
  --allow-publish --yes
```

This needs npm 11.15 or newer and an owner account with two-factor authentication. Configure the trusted publisher just before the next automated publication; npm expires a new publisher configuration if unused for two days. Subsequent releases use OIDC. Restrict token publishing in the npm package settings after verifying the first automated release.

GitHub Packages uses the repository's `GITHUB_TOKEN`. Verify package visibility after its initial publication; package visibility is managed separately from repository visibility.

## Installing the GitHub mirror

GitHub's npm registry requires authentication even for public packages. Configure the consumer's `.npmrc`:

```ini
@groundsgg:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Use a token with `read:packages`, or an appropriately authorized Actions `GITHUB_TOKEN`. For ordinary consumers prefer npmjs.com; this repository's `.npmrc` explicitly selects it for `@groundsgg`.
