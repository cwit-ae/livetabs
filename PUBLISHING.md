# Publishing

How releases work for the live-tabs packages (`@live-tabs/core`,
`@live-tabs/tanstack-router`, `@live-tabs/next`).

**We use [Changesets](https://github.com/changesets/changesets), not
`npm version`.** Don't run `npm version patch/minor/major` by hand — it would
desync the version bumps from the changelog and the fixed-version group. You
declare the bump type in a *changeset*; tooling does the rest.

All three packages are **fixed to one version** (see `.changeset/config.json`),
so any release bumps them together to the same number and an adapter can never
drift from the `@live-tabs/core` it targets.

> Adding a new package? Add it to the `fixed` array in `.changeset/config.json`
> in the same commit. A package left out of that array versions independently,
> which is exactly the drift the fixed group exists to prevent.

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
npm publish -w @live-tabs/next --access public
```

Order matters on a first publish: `@live-tabs/tanstack-router` and
`@live-tabs/next` both depend on `@live-tabs/core`, so publish core first.

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

For a hotfix from your machine, or any release before Trusted Publishing is
configured for a package.

### 1. Get on the branch that actually has the release

This is the step that bites. Branches in this repo drift, and publishing from a
stale one **fails silently**: `changeset publish` reads the local version, sees
it is already on npm, publishes nothing, and exits 0. It looks like success.

```bash
git checkout main
git pull                 # do not skip — being one commit behind is enough
```

Then prove you are where you think you are:

```bash
node -p "require('./packages/core/package.json').version"
```

If that is not the version you intend to ship, stop. Check whether the release
landed on another branch:

```bash
for b in main origin/main dev origin/dev; do
  printf "%-14s %s
" "$b" "$(git show $b:packages/core/package.json | node -pe "JSON.parse(require('fs').readFileSync(0)).version")"
done
```

### 2. Apply pending version bumps — only if there are any

```bash
npx changeset status     # lists what would be bumped, changes nothing
```

If it reports packages to bump, apply them:

```bash
npm run version-packages     # = changeset version: bumps + writes CHANGELOGs
git commit -am "Version Packages"
```

If it reports nothing, the versions were already set — **skip this step**.
Running it anyway is harmless but writes no bump, and it is not what makes a
release happen.

### 3. Verify exactly what CI verifies

Run the whole block before anything irreversible. These are the same six steps
as `.github/workflows/ci.yml`:

```bash
npm ci
npm run build
npm run typecheck
npm test
npm run lint:pkg
npm run audit:prod
```

`audit:prod` is a gate, not advice — it exits non-zero on any advisory in the
production tree and will fail CI even if the publish succeeded.

### 4. Publish

```bash
npm whoami               # confirm the right account
npm login                # only if that failed
npm run release          # = npm run build && changeset publish
```

`changeset publish` walks packages in dependency order (core first), and skips
any whose version is already on the registry — so it is safe to re-run if one
package fails partway through.

If the account enforces 2FA: `npx changeset publish --otp=123456`.

### 5. Push the commits and the tags it created

```bash
git push --follow-tags
```

> **Do not create release tags by hand.** `changeset publish` creates them
> itself, after each package is accepted by the registry — that is why
> `@live-tabs/*@0.2.0` and `@0.2.1` exist. Tagging beforehand either collides
> with what changesets writes, or leaves a tag pointing at a version that never
> shipped. Tag after, never before.

> A local publish authenticates with your npm login and **won't** attach the
> OIDC provenance that CI does. Prefer the automated path for real releases.

### If a package is brand new

npm can only attach a Trusted Publisher to a package that already exists, so the
first version of any new package name has to go out manually (see
[One-time setup](#one-time-setup-before-the-very-first-release)). Check the name
is actually available first — a 404 on the registry is necessary but **not
sufficient**, because npm also rejects names too similar to an existing one:

```bash
npm view <name> version          # 404 = nothing published under that exact name
npm publish -w <name> --dry-run  # surfaces a similarity rejection before it counts
```

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
| `npm run build`            | Build all packages (core → tanstack-router → next). |
| `npm test`                 | Run the test suite.                                     |
| `npm run lint:pkg`         | Validate package publish-health (publint).              |
| `npm run audit:prod`       | Audit production dependencies only.                     |

---

## Changelogs

Each package has a hand-maintained `CHANGELOG.md` with an `## Unreleased`
section describing work that has landed but not shipped. `changeset version`
inserts its own numbered section for the pending changesets; fold the
`Unreleased` notes into that section when you cut the release, so each shipped
version has exactly one entry.

The root [`CHANGELOG.md`](./CHANGELOG.md) is a summary that points at the
per-package ones. Changesets does not manage it — update it by hand.

---

## Licensing checklist (before any publish)

The keep-alive engine is derived from MIT-licensed upstream code, so the
attribution has to travel with every artifact. Verify:

```bash
# LICENSE, README.md and CHANGELOG.md must appear in every tarball
for p in core tanstack-router next; do
  (cd packages/$p && npm pack --dry-run 2>&1 | grep -E "LICENSE|README|CHANGELOG")
done
```

- Every package's `files` array includes `LICENSE`, `README.md`, `CHANGELOG.md`.
- Every package's `LICENSE` is identical to the root one, which reproduces the
  upstream copyright and permission notice in full.
- Every package declares `"license": "MIT"`.
- No new runtime `dependencies` beyond `@live-tabs/core` — everything else is a
  peer, licensed by the consuming app. Check with `npm run audit:prod`.

---

## Troubleshooting

- **`changeset publish` said nothing was published, or the version on npm
  didn't move.** You were almost certainly on a stale branch. It compares the
  *local* `package.json` version against the registry and skips anything already
  there — then exits 0. `git pull` and check
  `node -p "require('./packages/core/package.json').version"` before blaming the
  registry.
- **`E403 ... Package name too similar to existing package <x>`.** npm rejects
  names that differ from an existing one only by punctuation. This is permanent
  while that package exists, and no retry or scope flag changes it — the name has
  to change, or the package has to go. `npm publish --dry-run` surfaces it before
  it costs you a release.
- **`npm run audit:prod` fails but nothing in `dependencies` changed.** These
  packages declare almost no runtime deps, so advisories usually arrive through a
  *devDependency* that is also a declared peer (`next` is the common one). Fix the
  dev tree — `npm audit fix`, or bump the dev dependency — rather than lowering
  `--audit-level`, which would blind the gate for real issues too.
- **Every merge conflicts on the same six files** (three `package.json`, three
  `CHANGELOG.md`). That is structural, not bad luck: a version bump edits the
  `version` line and prepends to the top of each changelog, and two branches
  holding different versions always collide there. The fix is to bump on one
  branch only — let the Version Packages PR do it on `main` and delete release
  branches after merging, rather than keeping several alive with different
  versions.
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
