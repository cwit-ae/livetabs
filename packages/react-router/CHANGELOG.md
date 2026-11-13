# @live-tabs/react-router

## 0.3.0

### Minor Changes

- Add `@live-tabs/react-router`, the React Router (7+) adapter. Routes opt in
  with `handle: { keepAlive: true }` and `<KeepAliveOutlet />` replaces
  `<Outlet />`. Kept pages get React Router's location and data contexts
  re-provided per page, so `useLocation`, `useParams` and `useLoaderData` stay
  correct while a page is hidden.

### Patch Changes

- @live-tabs/core@0.3.0

### Added

- First release: the React Router adapter for live-tabs. Supports React Router
  7 and 8 in data, declarative and framework mode.
- `KeepAliveOutlet` is a drop-in for `<Outlet />` (including its `context`
  prop). Routes opt in with `handle: { keepAlive: true }`, and the deepest
  route that sets it decides, so a layout can opt its children in and one child
  can opt out. An `include(pathname)` prop opts in by URL instead.
- Kept pages read their own URL and data while hidden. The location and
  data-router contexts are re-provided per page, so the standard `useLocation`,
  `useParams`, `useSearchParams`, `useLoaderData`, `useActionData` and
  `useMatches` describe that page and not the active tab.
- A kept page mounts once, in the same commit as its first navigation, with no
  blank registration frame. A search-only change updates it in place.
- Closing the active tab frees its page even while a data router is still
  loading the next one.
- `idleMs` / `idleOptions` for idle eviction, `useActiveEffect`,
  `useActiveChanged`, `useKeepAlive`, and the parity hooks `useKeptPathname`,
  `useKeptParams`, `useKeptSearch` and `useFrozenLocation`.
- Everything from `@live-tabs/core` is re-exported, including groups,
  persistence, `moveTab` and `tabWidth`.
