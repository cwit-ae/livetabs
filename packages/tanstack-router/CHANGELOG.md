# @live-tabs/tanstack-router

## 0.2.1

### Patch Changes

- 304e7c8: Drop the `live-tabs` umbrella package and correct the docs that pointed at it.

  npm refuses the name: it is too similar to `livetabs`, an unrelated package
  published in 2024 by a third party. Both spellings are therefore unavailable,
  and no retry will change that. The umbrella existed only to offer a shorter
  install name, so it has been removed rather than renamed —
  `@live-tabs/tanstack-router` is already the batteries-included install, and it
  re-exports `@live-tabs/core` in full.

  Nothing breaks: `live-tabs` was never published, so no one could depend on it.

  This release only corrects documentation. `@live-tabs/core@0.2.0` and
  `@live-tabs/tanstack-router@0.2.0` shipped READMEs telling readers to install
  `live-tabs`, which can never exist.

  Removing the umbrella also retires a real footgun it introduced: it inlined
  `@live-tabs/core`, so mixing `live-tabs` with direct `@live-tabs/*` imports
  produced two copies of the keep-alive event bus and `useActiveEffect` silently
  stopped firing in background tabs. With one way to install, that cannot happen.

  Its build-artifact test moves to `@live-tabs/tanstack-router`, where it now
  guards the package boundary instead: `@live-tabs/core` is external there, so
  `<OffScreen>` and `useActiveEffect` must resolve the same emitter module.

  Unrelated to the rename: the test matrix now runs against Next 16. The declared
  peer range is unchanged (`next >=14`).

- Updated dependencies [304e7c8]
  - @live-tabs/core@0.2.1

## 0.2.0

The public API is unchanged: the same 17 exports, under the same names, with
the same signatures. Existing apps need no changes.

### Added

- A `persist` prop on `WorkspaceProvider`, forwarded to the core store. Off by
  default. It restores the tab strip across reloads — titles, order, groups,
  collapsed state — never page state, which is a kept-alive React subtree and
  cannot be serialised.
- Tab groups, inherited from `@live-tabs/core` through the existing
  `export * from "@live-tabs/core"`. `useWorkspaceGroups`, `useWorkspaceStrip`
  and the group actions are available from this package with no extra install,
  and `WorkspaceTabBar` renders group chips with collapse/expand/ungroup.
- The package now ships `styles.css` and exports `./styles.css`. Previously it
  shipped neither, so installing this package directly left no supported way to
  load the default theme — you had to reach into a transitive dependency, which
  breaks under strict package managers such as pnpm.

- `idleMs` / `idleOptions` on `KeepAliveOutlet` — release a hidden tab's
  subtree after it has idled, to cap memory. The tab stays in the bar and
  remounts fresh when revisited. Off by default.

### Changed

- The router-agnostic keep-alive primitives (`OffScreen`, `CachedRoute`,
  `TinyEmitter`, `useEventListener`, `useUpdate`, `ActivityMode`) now live in
  `@live-tabs/core` and are re-exported here under the same names, so both this
  adapter and `@live-tabs/next` share one implementation. Import paths for
  consumers are unaffected.
- `useActiveChanged` now reads the kept pathname explicitly via
  `useKeptPathname` instead of the live router pathname. Behaviour is the same
  — the previous version was correct only because its listener bound once on
  mount and closed over the pathname at that moment. It no longer depends on
  that, so an `exhaustive-deps` autofix can't silently break
  `useActiveEffect` in every background tab.

### Fixed

- `@live-tabs/next` is now part of the fixed version group in
  `.changeset/config.json`. Without it the Next adapter could drift from the
  `@live-tabs/core` it targets.

### Updated dependencies

- @live-tabs/core@0.2.0
