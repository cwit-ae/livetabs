# Publishing

How releases work for the live-tabs packages (`@live-tabs/core`,
`@live-tabs/tanstack-router`, `live-tabs`).

**We use [Changesets](https://github.com/changesets/changesets), not
`npm version`.** Don't run `npm version patch/minor/major` by hand — it would
desync the version bumps from the changelog and the fixed-version group. You
declare the bump type in a *changeset*; tooling does the rest.

All three packages are **fixed to one version** (see `.changeset/config.json`),
so any release bumps them together to the same number.

---

## TL;DR

```bash
# 1. While working on a change, record what kind of release it is:
npm run changeset          # pick patch / minor / major + write a summary

# 2. Commit that changeset with your PR and merge to main.
#    CI opens a "Version Packages" PR. Merge it → CI publishes to npm.
```

That's the whole day-to-day loop. Everything below is detail + first-time setup.

---

## One-time setup (before the very first release)

Publishing runs on **npm Trusted Publishing (OIDC)** from GitHub Actions — no
`NPM_TOKEN` secret. See [`.github/workflows/release.yml`](.github/workflows/release.yml).

### 1. Bootstrap the first publish (manual)

npm can only attach a Trusted Publisher to a package that **already exists**.
So the very first version of each new package name must be published manually,
once, while logged in:

```bash
npm login                 # your npm account with publish rights
npm run build
npm publish -w @live-tabs/core --access public
npm publish -w @live-tabs/tanstack-router --access public
npm publish -w live-tabs --access public
```

(The scoped packages set `publishConfig.access: public`, so `--access public`
is belt-and-suspenders.)

### 2. Configure Trusted Publishing

On npmjs.com, for **each** of the three packages:

> Package → **Settings** → **Publishing access** → add a **Trusted Publisher**

Point it at this GitHub repo, the workflow file `release.yml`, and the `main`
branch. After this, every future release publishes from CI with **no token**
and gets a **provenance** attestation automatically.

> Requirement already handled in the workflow: `id-token: write` permission and
> npm ≥ 11.5.1 (the workflow upgrades npm before publishing).

---

## Everyday: recording a change

When you make a user-facing change, add a changeset:

```bash
npm run changeset
```

It asks which packages changed (pick the group) and the **bump type**, then you
write a one-line summary that becomes the changelog entry. This creates a small
file under `.changeset/` — **commit it with your PR**.

Pick the bump type by what the change does:

| Bump    | When                                             | Example (from `0.1.0`) |
| ------- | ------------------------------------------------ | ---------------------- |
| `patch` | Bug fix, no API change                           | `0.1.1`                |
| `minor` | New feature, backward compatible                 | `0.2.0`                |
| `major` | Breaking change                                  | `1.0.0`                |

> **Pre-1.0 note:** Changesets follows semver literally, so a `major` changeset
> on `0.x` jumps straight to `1.0.0`. While the API is still settling, prefer
> `minor` for breaking changes to stay in `0.x`, and `patch` for everything else.

No user-facing change (docs, CI, tests)? No changeset needed.

---

## Cutting a release (automated — the normal path)

1. Merge PRs (each carrying its changeset) into `main`.
2. The **Release** workflow sees the pending changesets and opens/updates a
   **"Version Packages"** PR. That PR bumps the version, rewrites the
   `CHANGELOG.md` files, and deletes the consumed changesets.
3. Review and **merge the Version Packages PR**.
4. The workflow runs again and:
   - builds the packages,
   - runs `changeset publish` → `npm publish` for each (via OIDC, with provenance),
   - creates the **git tag(s)** and a **GitHub Release** with the changelog.

You never touch versions or tags by hand — merging the Version Packages PR is
the "publish" button.

---

## Cutting a release (manual / local fallback)

If you need to release without CI (e.g. a hotfix from your machine):

```bash
npm run changeset            # if you haven't already
npm run version-packages     # applies bumps + updates CHANGELOGs (= changeset version)
git commit -am "Version Packages"

npm login                    # local publish uses your token, NOT OIDC
npm run release              # = npm run build && changeset publish
git push --follow-tags       # push the version commit + tags
```

> A local publish authenticates with your npm login and **won't** attach the
> OIDC provenance that CI does. Prefer the automated path for real releases.

---

## Tagged releases

Tags and GitHub Releases are created for you by the release workflow when the
Version Packages PR merges — one release per version, with the aggregated
changelog. For a manual release, `changeset publish` creates the tags locally;
`git push --follow-tags` pushes them.

---

## Command reference

| Command                    | What it does                                             |
| -------------------------- | ------------------------------------------------------- |
| `npm run changeset`        | Record a change + its bump type (patch/minor/major).    |
| `npm run version-packages` | Apply pending changesets: bump versions + changelogs.   |
| `npm run release`          | Build, then `changeset publish` to npm.                 |
| `npm run build`            | Build all packages (core → tanstack-router → umbrella). |
| `npm test`                 | Run the test suite.                                     |
| `npm run lint:pkg`         | Validate package publish-health (publint).              |
| `npm run audit:prod`       | Audit production dependencies only.                     |

---

## Troubleshooting

- **`ENEEDAUTH` / OIDC not used in CI** — the runner's npm is too old. The
  workflow runs `npm install -g npm@latest`; ensure that step is present and
  `permissions: id-token: write` is set.
- **`402 Payment Required` / private publish error on a scoped package** —
  missing public access. The scoped packages set `publishConfig.access:
  public`; for a manual publish add `--access public`.
- **Trusted publisher can't be added** — the package must exist first. Do the
  one-time manual bootstrap publish above, then configure it.
- **Version didn't bump** — no changeset was committed. `changeset publish`
  only releases packages whose version changed; add a changeset first.
