# live-tabs

**Browser-style workspace tabs with kept-alive pages.** Open pages in tabs and
switch between them without losing scroll, form input, filters, or in-flight
queries — each page's React subtree stays mounted off-screen.

Tabs can be gathered into named, collapsible **groups**, and the strip can
optionally be **restored across reloads**.

This is the monorepo. Pick the package that matches your router.

## Packages

| Package | Status | Use it when |
| --- | --- | --- |
| [`live-tabs`](./packages/live-tabs) | ✅ | You use **TanStack Router** and want one install. Umbrella over core + the TanStack adapter. |
| [`@live-tabs/next`](./packages/next) | ✅ | You use the **Next.js App Router**. Client-side, never touches the Next router. |
| [`@live-tabs/tanstack-router`](./packages/tanstack-router) | ✅ | Same as `live-tabs`, scoped. Use this if you also import `@live-tabs/core` directly. |
| [`@live-tabs/core`](./packages/core) | ✅ | You're writing a new router adapter, or want only the headless primitives. No router dependency. |
| `@live-tabs/react-router` | 🚧 planned | React Router adapter. |

> **Pick one entry point.** `live-tabs` inlines core and the TanStack adapter at
> build time, and the keep-alive event bus is a module-level singleton. Mixing
> `live-tabs` with direct `@live-tabs/*` imports in one app gives you two event
> buses and `useActiveEffect` silently stops firing.

## Install and run

Every package needs `react`, `react-dom` and `zustand` as peers.

### `live-tabs` — TanStack Router, batteries included

```bash
npm i live-tabs @tanstack/react-router zustand
```

```tsx
import { WorkspaceProvider, WorkspaceTabBar, KeepAliveOutlet } from "live-tabs"
import "live-tabs/styles.css" // optional default theme

// Opt a route into keep-alive:
//   createFileRoute("/leads/$id")({
//     staticData: { keepAlive: true },
//     component: LeadDetail,
//   })

function RootLayout() {
  return (
    <WorkspaceProvider options={{ pinnedPath: "/" }} persist>
      <WorkspaceTabBar />
      <KeepAliveOutlet />
    </WorkspaceProvider>
  )
}
```

`<KeepAliveOutlet />` replaces TanStack's `<Outlet />` in the layout whose
children should stay alive. Full guide:
[packages/live-tabs/README.md](./packages/live-tabs/README.md).

### `@live-tabs/next` — Next.js App Router

```bash
npm i @live-tabs/next zustand
```

```tsx
"use client"
import {
  createWorkspaceRoutes, WorkspaceProvider, WorkspaceTabBar, WorkspaceOutlet,
} from "@live-tabs/next"
import "@live-tabs/next/styles.css"

const routes = createWorkspaceRoutes({
  staticRoutes: { "/dashboard": { title: "Dashboard", component: Dashboard } },
  dynamicPatterns: [
    { match: /^\/leads\/(?<id>[^/]+)$/, noun: "Lead", component: LeadDetail },
  ],
})

export default function WorkspaceLayout({ children }) {
  return (
    <WorkspaceProvider routes={routes} persist>
      <WorkspaceTabBar />
      <WorkspaceOutlet>{children}</WorkspaceOutlet>
    </WorkspaceProvider>
  )
}
```

Next keeps owning navigation and the URL; live-tabs owns what the workspace
area renders. Paths absent from the route table fall through to Next untouched,
so adoption is opt-in per route. Full guide:
[packages/next/README.md](./packages/next/README.md).

### `@live-tabs/core` — building an adapter

```bash
npm i @live-tabs/core zustand
```

You implement `RouterAdapter` and pair it with your router's keep-alive
renderer; the store, registry, groups, persistence, primitives and
`<WorkspaceTabBar />` come for free. Full guide:
[packages/core/README.md](./packages/core/README.md).

## Architecture

The core is **router-agnostic**. Everything router-specific lives behind a small
`RouterAdapter` (`useLocation` / `useNavigate` / `Link` / `useKeptPathname` /
optional `useDestroyPage`). Adapter packages implement it and supply the
router-bound half of the keep-alive engine; the store, registry, groups,
persistence, primitives and `<WorkspaceTabBar>` are reused unchanged.

The keep-alive engine is split in two. Its router-agnostic half — the
off-screen renderer, the event bus, and the active-subtree hooks — lives in
`@live-tabs/core`. Each adapter supplies only the router-bound half: reading
the location, freezing it per subtree, and resolving which component to render.

```
@live-tabs/core  ◄── @live-tabs/tanstack-router ◄── live-tabs (umbrella)
                 ◄── @live-tabs/next
                 ◄── @live-tabs/react-router      (planned)
```

Adding a router is one new package and no changes to `@live-tabs/core`.

## Develop

```bash
npm install          # installs all workspaces
npm run build        # core → tanstack-router → next → live-tabs, in order
npm run typecheck    # tsc across all packages
npm test             # Vitest, all packages
npm run lint:pkg     # publint — validates publish health of every package
```

Build before testing at least once: the adapter packages resolve
`@live-tabs/core` from its built `dist`, and `packages/live-tabs` is tested
through its **built artifact** on purpose, to catch bundling bugs that
source-level tests cannot.

Versioning is via [changesets](./.changeset); all packages are **fixed** to one
version so adapters never drift from the core they target.

**Releasing?** See **[PUBLISHING.md](./PUBLISHING.md)**.

## Changelog

[CHANGELOG.md](./CHANGELOG.md), and one per package.

## Credits

The keep-alive engine is derived from
[`tanstack-router-keepalive`](https://github.com/hemengke1997/tanstack-router-keepalive)
by hemengke1997 (MIT). Its copyright and permission notice are reproduced in
[LICENSE](./LICENSE), which also records what differs from upstream.

## License

MIT — see [LICENSE](./LICENSE). All runtime peers (`react`, `react-dom`,
`zustand`, `next`, `@tanstack/react-router`) are MIT; these packages bundle no
third-party runtime code.
