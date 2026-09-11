# @live-tabs/core

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

## Unreleased

Everything below is additive. No export was removed or renamed, and the tab
store behaves identically to 0.1.0 for every pre-existing operation (verified
by a differential harness that runs both builds through the same scenarios).

### Added

**Tab groups.** Named, collapsible containers for tabs — session UI state, with
no routing meaning.

- Store actions: `createGroup`, `renameGroup`, `setGroupColor`,
  `collapseGroup`, `expandGroup`, `toggleGroup`, `deleteGroup`,
  `addTabToGroup`, `removeTabFromGroup`.
- Hooks: `useWorkspaceGroups`, `useWorkspaceStrip`.
- Helpers: `buildStrip`, `normalizeTabs`, `groupIdOf`, `isHiddenByCollapse`,
  `nextGroupId`.
- Types: `TabGroup`, `StripSegment`.
- `WorkspaceTab` gains an optional `groupId`.

A group's tabs always occupy one contiguous run in the bar. Collapsing hides
the members without unmounting their pages. `collapseGroup` returns a pathname
to navigate to when the group holds the active tab, mirroring `closeTab`.
Closing a group's last tab removes the group.

**Opt-in session persistence.** Off by default.

- `attachPersistence`, `readSnapshot`, `writeSnapshot`, `clearSnapshot`.
- A `persist` prop on `WorkspaceProvider` (`true`, or `PersistOptions`).
- Types: `WorkspaceSnapshot`, `PersistOptions`, `StorageLike`.
- `WorkspaceTab` gains an optional `restored`.

Only the strip is restored — titles, order, groups, collapsed state. Page state
is a kept-alive React subtree and cannot be serialised, so a restored tab
mounts fresh on first visit. Every restored tab carries `restored: true` until
opened so the difference stays visible rather than implied away.

**The router-agnostic half of the keep-alive engine**, moved here from
`@live-tabs/tanstack-router` so every adapter shares one implementation:
`OffScreen`, `CachedRoute`, `TinyEmitter`, `getKeepAliveEmitter`,
`useEventListener`, `useUpdate`, `createActiveHooks`, and the `ActivityMode`,
`OffScreenProps`, `CachedRouteProps`, `KeepAliveEvents` types.

`createActiveHooks(useKeptPathname)` builds `useActiveChanged` /
`useActiveEffect` against an adapter's own notion of "which page is this
subtree", keeping the engine free of any router import.

**`WorkspaceTabBar` renders groups.** New props `renderGroup` and
`groupsDeletable`; new `classNames` entries `group`, `groupChip`, `groupTitle`,
`groupCount`, `groupDelete`; new `GroupRenderContext` type.

**Theme.** `styles.css` gains group styling and a muted treatment for
`[data-restored="true"]`, both driven by the existing CSS variables plus a new
`--live-tabs-group-color`.

**Idle eviction.** `useIdleEviction(keptPathnames, activePathname, destroy,
idleMs, options)` releases kept-alive subtrees that have been hidden longer
than `idleMs`, capping the memory a workspace holds. An evicted tab stays in
the bar and remounts fresh when revisited; the active tab is never evicted.
`options.keep` protects paths that are too expensive to rebuild. Disabled
unless `idleMs` is a positive finite number.

### Notes

- `WorkspaceTab.groupId` and `.restored` are optional; existing tabs and any
  persisted payloads without them keep working.
- Tab ordering with no groups in play is unchanged. `normalizeTabs` is an
  order-preserving copy in that case — it deliberately does not hoist pinned
  tabs, which 0.1.0 never did either.
