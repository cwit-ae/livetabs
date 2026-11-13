---
"@live-tabs/tanstack-router": patch
---

Keep-alive engine: the current page now renders from the very first frame instead of after a deferred registration, so there is no blank frame on a route's first visit, and a kept page mounts exactly once. While a navigation is still loading, a kept page is never rendered a second time through `<Outlet />`. Closing the active tab can no longer leave its page lingering hidden if the router re-renders before the URL changes. The keep-alive context value and `useKeepAlive()` are memoised (stable callbacks) and `useKeepAlive()` no longer re-renders on every tab switch.
