# @live-tabs/next

[Next.js App Router](https://nextjs.org/docs/app) adapter for
[live-tabs](https://github.com/cwit-ae/livetabs) — browser-style workspace tabs
whose pages stay **alive** (scroll, form input, filters, query state preserved)
across switches.

Re-exports everything from [`@live-tabs/core`](https://www.npmjs.com/package/@live-tabs/core),
plus:

- `createWorkspaceRoutes` — the path → `{ title, iconKey, component }` table.
- `WorkspaceOutlet` — renders the kept tabs; unregistered paths fall through.
- A pre-wired `WorkspaceProvider` (Next adapter + keep-alive baked in).
- `nextRouterAdapter` (the `RouterAdapter` implementation).
- `useKeptPathname`, `useKeptParams`, `useKeptSearch`, `useActiveEffect`.

Tab groups and session persistence live in the core and are re-exported here.

## Install

```bash
npm i @live-tabs/next zustand
```

> Peers: `next` (>=14), `react` (>=18), `react-dom` (>=18), `zustand` (>=4).
> The only runtime dependency is `@live-tabs/core`, installed for you.

Using TanStack Router instead? Install
[`@live-tabs/tanstack-router`](https://www.npmjs.com/package/@live-tabs/tanstack-router).

## Client-only by design

The whole package is `"use client"`. It never touches the Next router beyond
reading `usePathname()` and calling `router.push()`:

- **Next keeps owning navigation and the URL.** Links, history, and deep links
  work exactly as they do today.
- **live-tabs owns what the workspace area renders.** Tab bodies come from your
  route table, not from Next's route files — which is what makes keeping twenty
  of them mounted at once possible.

There is no Server Component support and none is planned: a Server Component
subtree can't be held alive on the client, so tab bodies are client components.

## Setup

**1. Declare what opens as a tab.** The App Router has no runtime route table
to read components from, so you supply one. Use named capture groups for
params:

```tsx
// workspace-routes.ts
"use client"
import { createWorkspaceRoutes } from "@live-tabs/next"
import Dashboard from "@/components/dashboard"
import LeadDetail from "@/components/lead-detail"

export const routes = createWorkspaceRoutes({
  staticRoutes: {
    "/dashboard": { title: "Dashboard", iconKey: "home", component: Dashboard },
  },
  dynamicPatterns: [
    {
      match: /^\/leads\/(?<id>[^/]+)$/,
      noun: "Lead",
      iconKey: "lead",
      component: LeadDetail,
    },
  ],
})
```

**2. Mount the shell** in the layout whose children should stay alive:

```tsx
// app/(workspace)/layout.tsx
"use client"
import { WorkspaceProvider, WorkspaceTabBar, WorkspaceOutlet } from "@live-tabs/next"
import "@live-tabs/next/styles.css"
import { routes } from "@/workspace-routes"

export default function WorkspaceLayout({ children }) {
  return (
    <WorkspaceProvider routes={routes} options={{ pinnedPath: "/dashboard", maxTabs: 12 }}>
      <WorkspaceTabBar />
      <WorkspaceOutlet>{children}</WorkspaceOutlet>
    </WorkspaceProvider>
  )
}
```

`<WorkspaceTabBar />` is just a component — put it anywhere inside the provider
(top rail, under a header, in a sidebar). For full control over markup, use the
headless `TabStrip` / `Tab` / `TabClose` primitives from core instead.

**3. That's it.** Navigating to `/leads/42` opens a tab instead of replacing the
page. Navigating away hides it; navigating back shows the same React subtree,
with every bit of state where you left it.

### Adoption is per route

Any path **not** in the route table renders through `children` exactly as it
did before — so you can move one section into the workspace and leave the rest
of the app alone.

## Tab groups

Tabs can be gathered into named, collapsible groups — session UI state, with no
routing meaning. `<WorkspaceTabBar />` renders them, and `useWorkspaceGroups()`
drives them from your own menus:

```tsx
import { useWorkspaceGroups } from "@live-tabs/next"

const {
  groups,
  createGroup,      // ({ title, color, pathnames }) => groupId
  renameGroup,
  setGroupColor,
  collapseGroup,    // returns where to navigate if the group held the active tab
  expandGroup,
  toggleGroup,
  deleteGroup,      // ({ closeTabs: true }) to close its tabs as well
  addTabToGroup,
  removeTabFromGroup,
} = useWorkspaceGroups()
```

Behaviour worth knowing:

- A group's tabs always sit together in the bar; grouping a tab slides it next
  to its new siblings rather than reshuffling the strip.
- Collapsing hides the members from the bar but **keeps their pages alive** —
  a collapsed tab is still exactly where you left it.
- A collapsed group never holds the active tab; the bar navigates out of it.
- Closing the last tab in a group removes the group, as Chrome does.
- The pinned root tab is never grouped.

Building a custom bar? `useWorkspaceStrip()` gives you the strip already
chunked into loose tabs and group runs.

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
import { useWorkspaceTabs } from "@live-tabs/next"
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

Off by default. Opt in with `persist`:

```tsx
<WorkspaceProvider routes={routes} persist>
```

```tsx
// or configure it
<WorkspaceProvider
  routes={routes}
  persist={{ key: `live-tabs:${userId}`, version: 1 }}
/>
```

**What comes back is the strip, not the pages.** Tab titles, order, groups and
collapsed state are restored; the pages are React subtrees and cannot be
serialised, so a restored tab mounts fresh the first time it is opened.

That difference is deliberately visible rather than papered over: every
restored tab carries `restored: true` until visited, and the default theme
renders it muted and italic. Style `[data-restored="true"]` to change that.

Namespace the `key` per user if sessions are per-account — `localStorage` is
shared across everyone who signs in on that browser.

## Reading the URL inside a tab

A backgrounded tab must not react to the live URL, or every tab would re-render
against whatever page the user is currently on. Inside a tab body, read the
frozen snapshot instead of Next's hooks:

```tsx
import { useKeptParams, useKeptPathname, useSetTabTitle } from "@live-tabs/next"

export default function LeadDetail() {
  const { id } = useKeptParams()          // not useParams()
  const lead = useLead(id)
  useSetTabTitle(lead?.name)              // rename "Lead #42" → "Acme Inc"
  return <>{/* ... */}</>
}
```

## Pausing work in background tabs

Kept tabs stay mounted, so their effects keep running. For anything that should
stop while a tab is backgrounded — polling, websocket traffic, expensive
listeners — use `useActiveEffect`, which re-runs on show and cleans up on hide:

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
<WorkspaceOutlet idleMs={5 * 60_000}>{children}</WorkspaceOutlet>
```

An evicted tab **stays in the bar** — only its subtree is freed — and revisiting
it mounts it fresh, exactly as a first visit would. The active tab is never
evicted, however long it sits there.

Off by default (`idleMs={0}`): silently discarding state is the opposite of
what this library is for, so it has to be asked for.

Some pages are expensive enough to rebuild that you would rather pay the
memory. Protect them:

```tsx
<WorkspaceOutlet
  idleMs={5 * 60_000}
  idleOptions={{ keep: (pathname) => pathname.startsWith("/reports/") }}
>
  {children}
</WorkspaceOutlet>
```

## Notes

- **Page state never survives a reload**, with or without `persist` — kept
  subtrees are React state. Persistence restores the strip only.
- `useSearchParams()` is read internally, and `<WorkspaceProvider>` supplies its
  own `<Suspense>` boundary so you don't have to add one.
- Tabs are keyed by pathname, so one pathname is one tab. Two records that
  should each get a tab need distinct paths.

## Changelog

[CHANGELOG.md](./CHANGELOG.md).

## Credits

The keep-alive engine is derived from
[`tanstack-router-keepalive`](https://github.com/hemengke1997/tanstack-router-keepalive)
by hemengke1997 (MIT), by way of `@live-tabs/tanstack-router`. The upstream
copyright and permission notice is reproduced in [LICENSE](./LICENSE), which
also records what differs.

## License

MIT — see [LICENSE](./LICENSE). All peers (`next`, `react`, `react-dom`,
`zustand`) are MIT; this package bundles no third-party runtime code.
