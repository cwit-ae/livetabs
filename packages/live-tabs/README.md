# live-tabs

**Browser-style workspace tabs with kept-alive pages, for [TanStack Router](https://tanstack.com/router).**

Open pages in tabs and switch between them without losing a thing — scroll
position, form input, filters, sub-section pickers, and in-flight queries all
survive because each page's React subtree stays mounted off-screen. Built for
admin consoles and dashboards where users hop between records all day.

```bash
npm i live-tabs @tanstack/react-router zustand
```

> Peer deps: `react`, `react-dom`, `@tanstack/react-router` (>=1.150), `zustand`.
> Zero runtime dependencies of its own.

> **Pick one entry point.** This package inlines `@live-tabs/core` and
> `@live-tabs/tanstack-router` at build time so the published artifact is
> self-contained. The keep-alive event bus is a module-level singleton, so
> mixing `live-tabs` with direct `@live-tabs/*` imports in one app gives you two
> event buses and `useActiveEffect` silently stops firing. If you need to import
> `@live-tabs/core` directly, install
> [`@live-tabs/tanstack-router`](https://www.npmjs.com/package/@live-tabs/tanstack-router)
> instead of this umbrella.

> **On the Next.js App Router?** Install
> [`@live-tabs/next`](https://github.com/cwit-ae/livetabs/tree/main/packages/next) — this
> package carries the TanStack Router adapter.

---

## Why

A normal router unmounts the old page on every navigation. Go from a customer
you were editing to another tab and back, and your form is blank, your scroll
is at the top, your filters are reset. `live-tabs` keeps each page **alive** —
the way native app tabs work — and gives you the tab strip to drive it.

- **Kept-alive pages** — `useState`, refs, scroll, and TanStack Query
  subscriptions resume exactly where you left them.
- **Auto-managed tabs** — every distinct URL opens a tab; clicking it restores
  the exact URL you last saw (including `?search` state).
- **Headless or batteries-included** — drop in `<WorkspaceTabBar>`, or compose
  the unstyled `<TabStrip>/<Tab>/<TabClose>` primitives yourself.
- **Live titles** — `useSetTabTitle("Acme Inc")` upgrades a tab from its
  registry fallback once data lands.
- **Tab groups** — gather tabs into named, collapsible groups. Collapsing hides
  them from the bar without unmounting their pages.
- **Optional session restore** — bring the tab strip back after a reload.

---

## Quick start (5 steps)

### 1. Wrap your app

```tsx
import { WorkspaceProvider, createTabRegistry } from "live-tabs"

const registry = createTabRegistry({
  staticRoutes: {
    "/dashboard": { title: "Dashboard", iconKey: "home" },
    "/dashboard/customers": { title: "Customers", iconKey: "customer" },
  },
  dynamicPatterns: [
    { match: /^\/dashboard\/customers\/[^/]+$/, iconKey: "customer", noun: "Customer" },
  ],
})

;<WorkspaceProvider
  options={{ pinnedPath: "/dashboard", pinnedTab: { title: "Dashboard", iconKey: "home" }, maxTabs: 12 }}
  registry={registry}
>
  <RouterProvider router={router} />
</WorkspaceProvider>
```

`WorkspaceProvider` also mounts `KeepAliveProvider` for you (pass
`keepAlive={false}` to mount it yourself).

### 2. Swap `<Outlet/>` for `<KeepAliveOutlet/>` in your layout segment

```tsx
// routes/dashboard/route.tsx
import { KeepAliveOutlet } from "live-tabs"

function DashboardLayout() {
  return (
    <div className="layout">
      <WorkspaceTabBar /* see step 4 */ />
      <KeepAliveOutlet />
    </div>
  )
}
```

### 3. Opt each leaf route into keep-alive

```tsx
export const Route = createFileRoute("/dashboard/customers/$id")({
  staticData: { keepAlive: true }, // ← the only per-route change
  component: CustomerDetail,
})
```

`live-tabs` augments TanStack's `StaticDataRouteOption` type, so `keepAlive` is
fully typed. (Set it on leaf pages, not on layout `route.tsx` segments.)

### 4. Render the tab bar

```tsx
import { WorkspaceTabBar } from "live-tabs"
import "live-tabs/styles.css" // optional default theme
import { IconHome, IconUser } from "@tabler/icons-react"

const ICONS: Record<string, React.ReactNode> = {
  home: <IconHome size={14} />,
  customer: <IconUser size={14} />,
}

;<WorkspaceTabBar
  renderIcon={(key) => (key ? ICONS[key] : null)}
  leftSlot={<SidebarToggle />}
  rightSlot={<><GlobalSearch /><Notifications /></>}
/>
```

### 5. Give detail pages a real title

```tsx
import { useSetTabTitle } from "live-tabs"

function CustomerDetail() {
  const { data } = useQuery(customerQuery)
  useSetTabTitle(data?.name) // tab reads "Acme Inc" instead of "Customer #42"
  // ...
}
```

That's it. Pages now persist across tab switches, and the bar manages itself.

---

## Tab groups

Tabs can be gathered into named, collapsible groups. `<WorkspaceTabBar />`
renders them; `useWorkspaceGroups()` drives them from your own menus:

```tsx
import { useWorkspaceGroups } from "live-tabs"

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

- A group's tabs always sit together in the bar; grouping a tab slides it next
  to its new siblings rather than reshuffling the strip.
- Collapsing hides the members but **keeps their pages alive** — a collapsed
  tab is still exactly where you left it.
- A collapsed group never holds the active tab; the bar navigates out of it.
- Closing the last tab in a group removes the group, as Chrome does.
- The pinned root tab is never grouped.

Building a custom bar? `useWorkspaceStrip()` returns the strip already chunked
into loose tabs and group runs.

## Surviving a reload

Off by default. Opt in with `persist`:

```tsx
<WorkspaceProvider options={{ pinnedPath: "/dashboard" }} persist>
```

```tsx
// or configure it — namespace the key per user, localStorage is shared
<WorkspaceProvider persist={{ key: `live-tabs:${userId}`, version: 1 }}>
```

**What comes back is the strip, not the pages.** Titles, order, groups and
collapsed state are restored; the pages are kept-alive React subtrees and
cannot be serialised, so a restored tab mounts fresh the first time it is
opened. Every restored tab carries `restored: true` until visited, and the
default theme renders it muted and italic — style `[data-restored="true"]` to
change that.

---

## Headless usage

Want your own bar, or just the tab UI without the router glue? Use
`@live-tabs/core` directly (router-agnostic — no TanStack/keep-alive code):

```tsx
import { createWorkspaceTabsStore, TabStrip, Tab, TabClose } from "@live-tabs/core"

const useTabs = createWorkspaceTabsStore({ pinnedPath: "/", maxTabs: 10 })

function MyBar() {
  const tabs = useTabs((s) => s.tabs)
  const closeTab = useTabs((s) => s.closeTab)
  const active = useActivePathSomehow()

  return (
    <TabStrip activeKey={active}>
      {tabs.map((t) => (
        <Tab
          key={t.pathname}
          active={t.pathname === active}
          pinned={t.pinned}
          render={<a href={t.href} />}
          onMiddleClick={() => closeTab(t.pathname)}
        >
          <span>{t.title}</span>
          {!t.pinned && <TabClose onClose={() => closeTab(t.pathname)}>✕</TabClose>}
        </Tab>
      ))}
    </TabStrip>
  )
}
```

`<Tab>` emits `role="tab"`, `aria-selected`, and `data-active`/`data-pinned`
— style off those. `render` lets it become any element (a router `<Link>`,
an `<a>`, etc.) with the tab semantics merged in.

---

## API

### Provider & store
| Export | What |
| --- | --- |
| `WorkspaceProvider` | Creates the store, exposes the registry, mounts keep-alive. |
| `useWorkspaceTabs()` | `{ tabs, openTab, renameTab, closeTab, closeAllTabs }`. |
| `useWorkspaceTabsStore()` | The raw Zustand store (selector or `.getState()`). |
| `createWorkspaceTabsStore(options)` | Standalone store factory (no provider). |
| `createTabRegistry(options)` | Path → `{ title, iconKey }` resolver. |

### Groups & persistence
| Export | What |
| --- | --- |
| `useWorkspaceGroups()` | Groups list + every group mutator. |
| `useWorkspaceStrip()` | The strip as loose tabs and group runs. |
| `buildStrip(tabs, groups)` | Same, as a pure function. |
| `attachPersistence(store, opts)` | Restore + save the strip; returns a teardown. |
| `readSnapshot` / `writeSnapshot` / `clearSnapshot` | Direct snapshot access. |

### Components
| Export | What |
| --- | --- |
| `WorkspaceTabBar` | Batteries-included bar (auto-open, restore, close, scroll). |
| `TabStrip` | Headless scroll rail (edge-fade, wheel-to-horizontal, auto-scroll). |
| `Tab`, `TabClose` | Headless, unstyled tab + close primitives. |

### Keep-alive
| Export | What |
| --- | --- |
| `KeepAliveProvider`, `KeepAliveOutlet` | The cache + the `<Outlet/>` replacement. |
| `useKeepAlive()` | `{ aliveRoutes, destroy, destroyAll }` — free cached subtrees. |
| `useActiveEffect(fn, deps)` | Like `useEffect`, but (re)runs on show / cleans up on hide. |
| `useSetTabTitle(title)` | Live-rename the current tab. |
| `useKeptPathname()` | The frozen pathname inside a kept subtree. |

---

## How keep-alive works (and its one trade-off)

Each kept route is rendered once and toggled with `display` (`contents` when
visible, `none` when hidden) — the **only** approach that reliably preserves
state in stable React 19. Hidden subtrees stay mounted but don't display.

Trade-off: a hidden subtree's *router* hooks (`useParams`, `useLocation`) see
the live URL when it re-renders. `live-tabs` wraps each kept subtree in a frozen
location so its own state isn't disturbed; use `useKeptPathname()` (not
`useLocation`) when a kept page needs "which page am I?". `useQuery` dedupes,
so query-driven UI is unaffected.

Page state is **never** persisted across reloads — kept React subtrees can't
survive one. Session restore is therefore opt-in and restores the *strip* only
(see [Surviving a reload](#surviving-a-reload)), flagging every restored tab so
it never pretends its page came back with it. Without `persist`, a reload
starts fresh with the pinned tab + the opened URL.

---

## Changelog

[CHANGELOG.md](./CHANGELOG.md).

## Credits

The keep-alive engine is derived from
[`tanstack-router-keepalive`](https://github.com/hemengke1997/tanstack-router-keepalive)
by hemengke1997 (MIT). The off-screen rendering strategy and the
direct-component render path differ from upstream to work with
`@tanstack/react-router >= ~1.150` and stable React 19. The full upstream
copyright and permission notice is reproduced in [LICENSE](./LICENSE).

## License

MIT — see [LICENSE](./LICENSE). All peers (`react`, `react-dom`, `zustand`,
`@tanstack/react-router`) are MIT; this package bundles no third-party runtime
code.
