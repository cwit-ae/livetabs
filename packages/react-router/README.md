# @live-tabs/react-router

[React Router](https://reactrouter.com) adapter for
[live-tabs](https://github.com/cwit-ae/livetabs): browser-style workspace tabs
whose pages stay **alive** across switches. Scroll, form input, filters and
query state are all preserved.

Works with React Router **7 and 8**, in data mode (`createBrowserRouter`),
declarative mode (`<BrowserRouter>` + `<Routes>`) and framework mode.

Re-exports everything from [`@live-tabs/core`](https://www.npmjs.com/package/@live-tabs/core),
plus:

- `KeepAliveOutlet`, a drop-in replacement for `<Outlet />`.
- A pre-wired `WorkspaceProvider` (React Router adapter + keep-alive baked in).
- `useKeepAlive`, `useActiveEffect`, `useActiveChanged`.
- `useKeptPathname`, `useKeptParams`, `useKeptSearch`, `useFrozenLocation`, for
  parity with the other adapters. With React Router you usually don't need
  them (see below).
- `reactRouterAdapter` (the `RouterAdapter` implementation).

Tab groups, drag-to-reorder and opt-in session persistence come from the core
and are re-exported here, so there's nothing extra to install.

## Install

```bash
npm i @live-tabs/react-router react-router zustand
```

> Peers: `react-router` (>=7), `react` (>=18), `react-dom` (>=18),
> `zustand` (>=4). The only runtime dependency is `@live-tabs/core`.

## Run it

**1. Put the provider, the tab bar and `<KeepAliveOutlet />` in a layout route.**

```tsx
import {
  WorkspaceProvider, WorkspaceTabBar, KeepAliveOutlet, createTabRegistry,
} from "@live-tabs/react-router"
import "@live-tabs/react-router/styles.css" // optional default theme

const registry = createTabRegistry({
  staticRoutes: { "/dashboard": { title: "Dashboard", iconKey: "home" } },
  dynamicPatterns: [{ match: /^\/leads\/[^/]+$/, iconKey: "lead", noun: "Lead" }],
})

function AppLayout() {
  return (
    <WorkspaceProvider
      options={{ pinnedPath: "/dashboard", pinnedTab: { title: "Dashboard" } }}
      registry={registry}
      persist
    >
      <WorkspaceTabBar />
      <KeepAliveOutlet />
    </WorkspaceProvider>
  )
}
```

`<KeepAliveOutlet />` replaces `<Outlet />` in the layout whose children should
stay alive, and accepts the same `context` prop. `WorkspaceProvider` mounts
`KeepAliveProvider` for you; pass `keepAlive={false}` to place it yourself.

**2. Opt routes in with `handle`.**

```tsx
// Data mode
createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { path: "dashboard", element: <Dashboard /> },
      { path: "leads/:id", handle: { keepAlive: true }, loader: leadLoader, element: <LeadDetail /> },
    ],
  },
])

// Declarative mode
<Route element={<AppLayout />}>
  <Route path="leads/:id" handle={{ keepAlive: true }} element={<LeadDetail />} />
</Route>

// Framework mode (app/routes/leads.$id.tsx)
export const handle = { keepAlive: true }
```

The **deepest** matched route that sets `keepAlive` decides. A layout route can
opt in every child, and one child can opt back out with `keepAlive: false`.
Flags on routes *above* the outlet are ignored. Routes without the flag render
exactly as `<Outlet />` would, including React Router's own remount rules.

Rather not touch the route tree? Decide by URL instead:

```tsx
<KeepAliveOutlet include={(pathname) => pathname.startsWith("/leads/")} />
```

**3. Give detail pages a real title.**

```tsx
import { useSetTabTitle } from "@live-tabs/react-router"

function LeadDetail() {
  const lead = useLoaderData()
  useSetTabTitle(lead.name) // "Lead #42" becomes "Acme Inc"
}
```

## Your router hooks keep working while a page is hidden

This is the main difference from the other adapters. A hidden page is still
mounted, so normally it would keep reading the *live* router: `useLocation()`
would report another tab's URL, and `useLoaderData()` would return
`undefined`, or worse, the data of a different page that shares the route
(`/leads/2`'s lead showing inside `/leads/1`'s tab).

`KeepAliveOutlet` re-provides React Router's location and data-router contexts
to each kept page, using the values that page last saw while it was active. So
inside a kept page, the standard hooks answer for **that page's own URL**,
visible or hidden:

| Hook | Inside a kept page |
| --- | --- |
| `useLocation`, `useSearchParams` | the page's own URL |
| `useParams`, `useMatch`, `useResolvedPath` | the page's own match |
| `useLoaderData`, `useActionData`, `useRouteLoaderData`, `useMatches` | the page's own data |
| `useNavigation` | the router state as of when the page was hidden; live again once shown |

You don't need adapter-specific hooks to stay correct. `useKeptPathname()` and
friends are still exported, for code shared across live-tabs adapters.

Kept pages also mount exactly once, in the same commit as the first
navigation, with no blank frame while they register. When only the search
changes on the same page (`/leads/1?tab=notes` → `?tab=emails`), the page
updates in place and keeps its state.

## Pausing work in background tabs

Kept pages stay mounted, so their effects keep running. For polling, sockets
or expensive listeners, use `useActiveEffect`. It re-runs when the page is
shown and cleans up when it is hidden:

```tsx
useActiveEffect(() => {
  const timer = setInterval(revalidate, 5000)
  return () => clearInterval(timer)
}, [revalidate])
```

## Memory footprint

Every hidden tab keeps its React tree, its DOM, and whatever its components
hold. `idleMs` caps that by releasing subtrees that have been hidden too long:

```tsx
<KeepAliveOutlet
  idleMs={5 * 60_000}
  idleOptions={{ keep: (pathname) => pathname.startsWith("/reports/") }}
/>
```

An evicted tab **stays in the bar**. Only its subtree is freed, and revisiting
it mounts it fresh, just like a first visit. The active tab is never evicted.
This is off by default (`idleMs={0}`).

Closing a tab frees its page as well, including the tab you're currently on.
That page is not brought back by the re-renders that happen while the router
loads the next one.

## Tab groups, widths, reordering, persistence

These are shared with every adapter. See the
[`@live-tabs/tanstack-router` README](https://github.com/cwit-ae/livetabs/tree/main/packages/tanstack-router#tab-groups);
everything there applies here unchanged, with imports from
`@live-tabs/react-router`.

## How it works

`KeepAliveOutlet` reads the element React Router would render for the child
route (`useOutlet()`). For a kept route, that element is stored per pathname
together with the router context values of the moment. The active page renders
the live element; hidden pages replay their stored element inside
`<OffScreen>` (from `@live-tabs/core`), which toggles `display` and never
unmounts. Because the stored element keeps its identity, React skips
re-rendering it. Only components that call router hooks re-run when the live
router changes, and those read the frozen values.

It relies on React Router's exported `UNSAFE_` contexts, which is the
supported way for libraries to re-provide router state. The test suite runs
against both React Router 7 and 8.

## Changelog

[CHANGELOG.md](./CHANGELOG.md).

## License

MIT. See [LICENSE](./LICENSE). All peers (`react`, `react-dom`, `zustand`,
`react-router`) are MIT; this package bundles no third-party runtime code.
