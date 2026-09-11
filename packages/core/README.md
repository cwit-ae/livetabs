# @live-tabs/core

Router-agnostic core for [live-tabs](https://github.com/cwit-ae/livetabs) —
browser-style workspace tabs with kept-alive pages.

This package has **no router dependency**. It provides:

- `createWorkspaceTabsStore` — the open-tabs store (Zustand), including tab
  groups (create / rename / recolour / collapse / expand / delete / assign).
- `createTabRegistry` — a path → `{ title, iconKey }` resolver.
- `attachPersistence` — opt-in restore of the tab strip across reloads.
- `buildStrip` / `useWorkspaceStrip` — the strip as loose tabs and group runs.
- `OffScreen`, `CachedRoute`, `createActiveHooks` — the router-agnostic half of
  the keep-alive engine, which adapters build on.
- `useIdleEviction` — release kept subtrees that have been hidden too long, to
  cap the memory a workspace holds.
- `TabStrip`, `Tab`, `TabClose` — headless, unstyled tab primitives.
- `WorkspaceProvider`, `WorkspaceTabBar`, `useSetTabTitle`, `useAutoOpenTab` —
  driven by a `RouterAdapter` you supply.
- The `RouterAdapter` interface itself (`useAdapter`, `RouterAdapterProvider`).

## Install

```bash
npm i @live-tabs/core zustand
```

> Peers: `react` (>=18), `react-dom` (>=18), `zustand` (>=4). No runtime
> dependencies of its own.

**You probably want an adapter instead.** This package alone has no keep-alive
renderer and no navigation:

| Your router | Install |
| --- | --- |
| Next.js App Router | [`@live-tabs/next`](https://github.com/cwit-ae/livetabs/tree/main/packages/next) |
| TanStack Router | [`@live-tabs/tanstack-router`](https://www.npmjs.com/package/@live-tabs/tanstack-router) |

Each re-exports everything here, so you never install both. Reach for
`@live-tabs/core` directly only when building a new router adapter, or when you
want the headless primitives and the store on their own.

## Run it: the store, standalone

No provider, no router — just the tab state.

```tsx
import { createWorkspaceTabsStore, TabStrip, Tab, TabClose } from "@live-tabs/core"
import "@live-tabs/core/styles.css" // optional default theme

const useTabs = createWorkspaceTabsStore({ pinnedPath: "/", maxTabs: 10 })

function MyBar({ active }: { active: string }) {
  const tabs = useTabs((s) => s.tabs)
  const closeTab = useTabs((s) => s.closeTab)

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

`<Tab>` emits `role="tab"`, `aria-selected`, and `data-active` / `data-pinned`
— style off those. `render` lets it become any element (a router `<Link>`, an
`<a>`) with the tab semantics merged in.

Groups and persistence work here too, without a provider:

```tsx
const groupId = useTabs.getState().createGroup({ title: "Pipeline", pathnames: ["/leads/1"] })
useTabs.getState().collapseGroup(groupId)

// Restore the strip across reloads; returns a teardown function.
const detach = attachPersistence(useTabs, { key: "my-app:workspace" })
```

## Run it: writing a router adapter

Implement `RouterAdapter`, pair it with a keep-alive renderer for your router,
and the store, registry, groups, persistence, primitives and
`<WorkspaceTabBar />` all come for free.

```tsx
import { createActiveHooks, OffScreen, CachedRoute } from "@live-tabs/core"
import type { RouterAdapter } from "@live-tabs/core"

export const myAdapter: RouterAdapter = {
  useLocation() { /* { pathname, href } */ },
  useNavigate() { /* (to: string) => void */ },
  useKeptPathname() { /* frozen inside a kept subtree, live outside */ },
  Link: MyLink,
  useDestroyPage() { /* optional — free a kept subtree when its tab closes */ },
}

// Binds the active-subtree hooks to your notion of "which page is this
// subtree", keeping the engine free of any router import.
export const { useActiveChanged, useActiveEffect } = createActiveHooks(useKeptPathname)
```

`OffScreen` is the keep-alive primitive: it keeps a subtree mounted and toggles
`display` between `contents` and `none`. `CachedRoute` renders a captured
component directly rather than through a router outlet.

`@live-tabs/tanstack-router` and `@live-tabs/next` are each ~150 lines on top
of this — read either as a worked example.

## Changelog

[CHANGELOG.md](./CHANGELOG.md).

## Credits

The keep-alive primitives here are derived from
[`tanstack-router-keepalive`](https://github.com/hemengke1997/tanstack-router-keepalive)
by hemengke1997 (MIT). The upstream copyright and permission notice is
reproduced in [LICENSE](./LICENSE), which also records what differs.

## License

MIT — see [LICENSE](./LICENSE). All peers (`react`, `react-dom`, `zustand`) are
MIT; this package bundles no third-party runtime code.
