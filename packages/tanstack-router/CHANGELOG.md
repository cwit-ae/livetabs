# @live-tabs/tanstack-router

## Unreleased

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
