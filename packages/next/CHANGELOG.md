# @live-tabs/next

## Unreleased

Initial release. Next.js App Router adapter — client-side workspace tabs whose
pages stay alive across switches.

### Added

- `createWorkspaceRoutes` — the path → `{ title, iconKey, component }` table.
  The App Router has no runtime route registry to read components from the way
  TanStack Router does, so the mapping is declared explicitly. Dynamic routes
  use named capture groups, exposed to the tab as params.
- `WorkspaceOutlet` — renders every visited registered path, the current one
  visible and the rest hidden. Paths absent from the route table fall straight
  through to Next's own `children`, which makes adoption opt-in per route.
- `WorkspaceProvider` — route table, keep-alive registry, tabs store and the
  Next adapter, pre-wired. Supplies its own `<Suspense>` boundary, since the
  adapter reads `useSearchParams()` and Next requires a boundary above it
  during static prerendering.
- `nextRouterAdapter` — the `RouterAdapter` implementation. It only reads
  `usePathname()` and calls `router.push()`; it never takes over rendering.
- `useKeptPathname`, `useKeptParams`, `useKeptSearch` — the frozen URL for the
  current subtree, so a backgrounded tab never reacts to the live URL.
- `useActiveEffect`, `useActiveChanged`, `useKeepAlive` — pause and resume work
  as a tab is shown or hidden.
- `persist` prop for restoring the tab strip across reloads.
- Everything from `@live-tabs/core` is re-exported, including tab groups.

- `idleMs` / `idleOptions` on `WorkspaceOutlet` — release a hidden tab's
  subtree after it has idled, to cap memory. `idleMs={5 * 60_000}` is a
  sensible starting point. Off by default.

### Notes

- **Client-only by design.** The whole package is `"use client"`. There is no
  Server Component support and none is planned: a Server Component subtree
  cannot be held alive on the client, so tab bodies are client components.
- Tabs are keyed by pathname, so one pathname is one tab.
- `treeshake` is disabled for this package's build. Rollup's treeshake pass
  hoists away module-level directives, which silently dropped the
  `"use client"` banner and would have made the package unusable from a Server
  Component.
