# @live-tabs/core

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

### Notes

- `WorkspaceTab.groupId` and `.restored` are optional; existing tabs and any
  persisted payloads without them keep working.
- Tab ordering with no groups in play is unchanged. `normalizeTabs` is an
  order-preserving copy in that case — it deliberately does not hoist pinned
  tabs, which 0.1.0 never did either.
