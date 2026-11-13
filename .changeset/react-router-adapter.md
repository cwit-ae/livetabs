---
"@live-tabs/react-router": minor
---

Add `@live-tabs/react-router`, the React Router (7+) adapter. Routes opt in
with `handle: { keepAlive: true }` and `<KeepAliveOutlet />` replaces
`<Outlet />`. Kept pages get React Router's location and data contexts
re-provided per page, so `useLocation`, `useParams` and `useLoaderData` stay
correct while a page is hidden.
