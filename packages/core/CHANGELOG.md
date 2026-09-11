# @live-tabs/core

## 0.2.2

### Added

**`moveTab(pathname, toIndex, options?)`** — reorder the tab strip. Surfaced on
the store and through `useWorkspaceTabs()`.

Indices use the same semantics as `arrayMove`: remove, then insert at
`toIndex` in the resulting array, so a drag library's `from`/`to` pair maps
straight through. They address the full `tabs` array, not a filtered view, so a
bar that hides collapsed group members must map its own index back first.

Drag-and-drop crosses group boundaries, so `options.groupId` says where the tab
landed — a group's id to join it, `null` to drop it loose. Omit the option and
the tab keeps the group it had.

Two invariants hold regardless:

- Pinned tabs never move, and nothing moves ahead of one. An index that would
  land before a pinned tab is clamped past it rather than rejected, so a drag
  layer needn't special-case them.
- Each group's tabs stay contiguous. A move that would split a run pulls the
  run back together, and dragging the last member out releases the group.

Reordering is a strip operation only: it never navigates and never disturbs a
kept-alive subtree, so dragging a tab cannot lose what is typed in it.

**Equal tab widths.** `<WorkspaceTabBar tabWidth="equal" />` sizes every tab
the same and shrinks them together as more open, down to a new
`--live-tabs-tab-min` (default `5.5rem`), after which the strip scrolls. The
default stays `"auto"` — content-sized, exactly as before — so no existing bar
reflows on upgrade.

Pinned tabs keep their natural width and the rest divide what's left. A group
claims one flex share per member, via a `--live-tabs-group-members` custom
property the bar now sets, so grouped tabs line up with loose ones rather than
sharing a single slot. Implemented as `data-tab-width` on the bar, so custom
stylesheets can key off it.

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

## 0.2.0

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
