---
"@live-tabs/core": minor
"@live-tabs/tanstack-router": patch
---

Add `@live-tabs/next`, a Next.js App Router adapter.

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
  Off by default. It restores the *strip* — titles, order, groups, collapsed
  state — never page state, and flags every restored tab as `restored` until it
  is opened so the difference stays visible.

`WorkspaceTabBar` renders groups, and `WorkspaceTab` gains optional `groupId`
and `restored` fields. Both are additive; existing usage is unaffected.
