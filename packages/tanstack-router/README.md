# @live-tabs/tanstack-router

[TanStack Router](https://tanstack.com/router) adapter for
[live-tabs](https://github.com/cwit-ae/livetabs) — browser-style workspace tabs
whose pages stay **alive** (scroll, form input, filters, query state preserved)
across switches.

Re-exports everything from [`@live-tabs/core`](https://www.npmjs.com/package/@live-tabs/core),
plus:

- The keep-alive engine: `KeepAliveProvider`, `KeepAliveOutlet`, `useKeepAlive`,
  `useActiveEffect`, `useActiveChanged`.
- A pre-wired `WorkspaceProvider` (TanStack adapter + keep-alive baked in).
- `tanstackRouterAdapter` (the `RouterAdapter` implementation).
- `useKeptPathname`, `useFrozenLocation`, `FrozenLocationProvider`.

Tab groups and opt-in session persistence come from the core and are
re-exported here — no extra install.

## Install

```bash
npm i @live-tabs/tanstack-router @tanstack/react-router zustand
```

> Peers: `@tanstack/react-router` (>=1.150), `react` (>=18), `react-dom`,
> `zustand` (>=4).


## Run it

**1. Wrap your router.**

```tsx
import { WorkspaceProvider, createTabRegistry } from "@live-tabs/tanstack-router"

const registry = createTabRegistry({
  staticRoutes: { "/dashboard": { title: "Dashboard", iconKey: "home" } },
  dynamicPatterns: [
    { match: /^\/leads\/[^/]+$/, iconKey: "lead", noun: "Lead" },
  ],
})

<WorkspaceProvider
  options={{ pinnedPath: "/dashboard", pinnedTab: { title: "Dashboard" } }}
  registry={registry}
  persist
>
  <RouterProvider router={router} />
</WorkspaceProvider>
```

`WorkspaceProvider` mounts `KeepAliveProvider` for you — pass
`keepAlive={false}` to place it yourself.

**2. Swap `<Outlet />` for `<KeepAliveOutlet />`** in the layout segment whose
children should stay alive.

```tsx
import { KeepAliveOutlet, WorkspaceTabBar } from "@live-tabs/tanstack-router"
import "@live-tabs/tanstack-router/styles.css" // optional default theme

function DashboardLayout() {
  return (
    <div className="layout">
      <WorkspaceTabBar />
      <KeepAliveOutlet />
    </div>
  )
}
```

**3. Opt each leaf route into keep-alive.**

```tsx
export const Route = createFileRoute("/leads/$id")({
  staticData: { keepAlive: true }, // the only per-route change
  component: LeadDetail,
})
```

This package augments TanStack's `StaticDataRouteOption`, so `keepAlive` is
fully typed. Set it on leaf pages, not on layout `route.tsx` segments.

**4. Give detail pages a real title.**

```tsx
import { useSetTabTitle, useKeptPathname } from "@live-tabs/tanstack-router"

function LeadDetail() {
  const { data } = useQuery(leadQuery)
  useSetTabTitle(data?.name) // "Lead #42" becomes "Acme Inc"
}
```

Inside a kept subtree, use `useKeptPathname()` rather than `useLocation()` —
a backgrounded page must act on its own URL, not the live one.

## Tab groups

```tsx
import { useWorkspaceGroups, useWorkspaceStrip } from "@live-tabs/tanstack-router"

const { createGroup, collapseGroup, expandGroup, toggleGroup,
        deleteGroup, addTabToGroup, removeTabFromGroup } = useWorkspaceGroups()
```

`<WorkspaceTabBar />` renders group chips with collapse/expand/ungroup.
Collapsing hides a group's tabs from the bar but **keeps their pages alive**.
Closing a group's last tab removes the group. `useWorkspaceStrip()` gives you
the strip pre-chunked into loose tabs and group runs for a custom bar.

## Tab widths

By default each tab is as wide as its title (capped at `--live-tabs-tab-max`),
so widths differ from tab to tab. For browser behaviour — every tab the same
width, all shrinking together as more open — ask for it:

```tsx
<WorkspaceTabBar tabWidth="equal" />
```

Tabs then divide the rail evenly and shrink down to `--live-tabs-tab-min`
(default `5.5rem`), after which the strip scrolls rather than thinning them to
slivers. Titles already truncate with an ellipsis.

Retune the bounds like any other token:

```css
:root {
  --live-tabs-tab-min: 7rem;   /* floor before the strip scrolls */
  --live-tabs-tab-max: 240px;  /* ceiling, both modes */
}
```

Two details it handles for you: **pinned tabs keep their natural width** and
the rest divide what's left, as in a browser; and **a group claims one share
per member**, so grouped tabs line up with loose ones instead of being squeezed
into a single share.

This needs the shipped `styles.css`. It is implemented as `data-tab-width` on
the bar, so a custom stylesheet can key off the same attribute.

## Reordering tabs

`moveTab` reorders the strip. It uses the same index semantics as `arrayMove`,
so a drag library's `from`/`to` pair maps straight through:

```tsx
import { useWorkspaceTabs } from "@live-tabs/tanstack-router"
import { DndContext, closestCenter } from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable"

function Bar() {
  const { tabs, moveTab } = useWorkspaceTabs()

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return
        const to = tabs.findIndex((t) => t.pathname === over.id)
        moveTab(active.id as string, to)
      }}
    >
      <SortableContext
        items={tabs.map((t) => t.pathname)}
        strategy={horizontalListSortingStrategy}
      >
        {/* your sortable tabs */}
      </SortableContext>
    </DndContext>
  )
}
```

Indices address the **full `tabs` array**, not a filtered view of it. If your
bar hides the members of collapsed groups, resolve the drop target back to its
index in `tabs` — as above, by looking up the pathname — rather than using the
index of the rendered item.

Dropping across a group boundary is explicit:

```tsx
moveTab(pathname, to, { groupId })        // join that group
moveTab(pathname, to, { groupId: null })  // drop it loose
```

Omit the option and the tab keeps the group it had — in which case landing
inside another group's run is undone, because a group's tabs must stay
contiguous.

Two invariants hold whatever you pass, so the drag layer needn't special-case
them: **pinned tabs never move and nothing moves ahead of one** (an index that
would land before a pinned tab is clamped past it), and **a group's tabs stay
contiguous** (dragging the last member out releases the group).

Reordering is a strip operation only. It never navigates, and it never disturbs
a kept-alive subtree — dragging a tab cannot lose what is typed in it.

## Surviving a reload

Off by default; opt in with `persist` (shown above), or configure it:

```tsx
// Namespace the key per user — localStorage is shared across everyone who
// signs in on that browser.
<WorkspaceProvider persist={{ key: `live-tabs:${userId}`, version: 1 }}>
```

Only the **strip** is restored — titles, order, groups, collapsed state. Page
state is a kept-alive React subtree and cannot be serialised, so a restored tab
mounts fresh on first visit and carries `restored: true` until then.

## Pausing work in background tabs

Kept tabs stay mounted, so their effects keep running. For polling, sockets or
expensive listeners, use `useActiveEffect` — it re-runs on show and cleans up
on hide:

```tsx
useActiveEffect(() => {
  const timer = setInterval(refetch, 5000)
  return () => clearInterval(timer)
}, [refetch])
```

## Memory footprint

Keeping twenty pages mounted is the point of live-tabs, and also its cost:
every hidden tab retains its React tree, its DOM, and whatever its components
hold. `idleMs` caps that by releasing subtrees that have been hidden too long.

```tsx
<KeepAliveOutlet idleMs={5 * 60_000} />
```

An evicted tab **stays in the bar** — only its subtree is freed — and revisiting
it mounts it fresh, exactly as a first visit would. The active tab is never
evicted, however long it sits there.

Off by default (`idleMs={0}`): silently discarding state is the opposite of
what this library is for, so it has to be asked for.

Some pages are expensive enough to rebuild that you would rather pay the
memory. Protect them:

```tsx
<KeepAliveOutlet
  idleMs={5 * 60_000}
  idleOptions={{ keep: (pathname) => pathname.startsWith("/reports/") }}
/>
```

## How keep-alive works

Each kept route renders once and is toggled with `display` — `contents` when
visible, `none` when hidden. That is the only approach that reliably preserves
`useState`, refs, scroll and in-progress form input in stable React 19; the
Suspense throw-promise pattern unmounts an already-rendered subtree outside
specific render modes.

Hidden subtrees stay mounted, so each is wrapped in a frozen location and its
own URL snapshot — that is what `useKeptPathname()` reads.

## Changelog

[CHANGELOG.md](./CHANGELOG.md).

## Credits

The keep-alive engine is derived from
[`tanstack-router-keepalive`](https://github.com/hemengke1997/tanstack-router-keepalive)
by hemengke1997 (MIT). The off-screen strategy and the direct-component render
path differ from upstream to work with `@tanstack/react-router >= ~1.150` and
stable React 19. The upstream copyright and permission notice is reproduced in
[LICENSE](./LICENSE).

## License

MIT — see [LICENSE](./LICENSE). All peers (`react`, `react-dom`, `zustand`,
`@tanstack/react-router`) are MIT; this package bundles no third-party runtime
code.
