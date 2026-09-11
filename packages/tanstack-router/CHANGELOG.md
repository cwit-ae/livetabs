# @live-tabs/tanstack-router

## 0.2.0

### Minor Changes

- 2f1e447: Add `@live-tabs/next`, a Next.js App Router adapter.

  The router-agnostic half of the keep-alive engine (`OffScreen`, `CachedRoute`,
  `TinyEmitter`, `useEventListener`, `useUpdate`, `createActiveHooks`) moves from
  `@live-tabs/tanstack-router` into `@live-tabs/core` so both adapters share one
  implementation. `@live-tabs/tanstack-router` re-exports the same names it always
  did — its public API is unchanged.

  `@live-tabs/core` gains those exports plus `createActiveHooks`, which binds the
  active-subtree hooks to an adapter's `useKeptPathname`.

  `@live-tabs/core` also gains tab groups and opt-in session persistence, which
  every adapter inherits through its `export * from "@live-tabs/core"`:

  - Groups: `useWorkspaceGroups`, `useWorkspaceStrip`, `buildStrip`,
    `normalizeTabs`, and the group actions on the store. A group's tabs stay
    contiguous in the bar, collapsing hides them without killing their pages, and
    a group disappears when its last tab closes.
  - Persistence: `attachPersistence` plus a `persist` prop on `WorkspaceProvider`.
    Off by default. It restores the _strip_ — titles, order, groups, collapsed
    state — never page state, and flags every restored tab as `restored` until it
    is opened so the difference stays visible.

  `WorkspaceTabBar` renders groups, and `WorkspaceTab` gains optional `groupId`
  and `restored` fields. Both are additive; existing usage is unaffected.

  `@live-tabs/tanstack-router`'s `WorkspaceProvider` forwards the new `persist`
  prop. Its public API is otherwise unchanged: the router-agnostic keep-alive
  files it used to own now live in core and are re-exported under the same names.

### Patch Changes

- Updated dependencies [2f1e447]
  - @live-tabs/core@0.2.0

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
