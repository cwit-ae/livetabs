# live-tabs

## 0.2.0

The umbrella over `@live-tabs/core` + `@live-tabs/tanstack-router`, so it picks
up everything added to both. No breaking changes.

### Added

- Tab groups: `useWorkspaceGroups`, `useWorkspaceStrip`, the group store
  actions, and group rendering in `WorkspaceTabBar`.
- Opt-in session persistence: `attachPersistence` and the `persist` prop on
  `WorkspaceProvider`.
- Group and restored-tab styling in `styles.css`.

- Idle eviction: `<KeepAliveOutlet idleMs={5 * 60_000} />` releases subtrees
  that have been hidden too long.

### Notes

- This package inlines `@live-tabs/core` and `@live-tabs/tanstack-router` at
  build time so the published artifact is self-contained. The keep-alive event
  bus is a module-level singleton, so **do not mix `live-tabs` with direct
  `@live-tabs/*` imports in one app** — you would end up with two event buses
  and `useActiveEffect` would stop firing. Pick one entry point. (This has
  always been true; it is documented here for the first time.)
- Using the Next.js App Router? Install
  [`@live-tabs/next`](https://github.com/cwit-ae/livetabs/tree/main/packages/next) instead —
  this umbrella carries the TanStack Router adapter.
