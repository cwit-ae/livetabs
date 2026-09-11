# @live-tabs/next

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

- Updated dependencies [304e7c8]
  - @live-tabs/core@0.2.1

## 0.2.0

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

### Updated dependencies

- @live-tabs/core@0.2.0
