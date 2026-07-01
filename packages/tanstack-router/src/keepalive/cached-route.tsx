import type { ComponentType } from "react"

export type CachedRouteProps = { Component: ComponentType }

/**
 * Render the route's component **directly**, not through `<Outlet />`.
 *
 * Upstream `tanstack-router-keepalive` rendered an `<Outlet />` against a
 * deep-cloned, frozen router context. That breaks on
 * `@tanstack/react-router >= ~1.150`: match IDs are now composed by joining
 * parent + child paths, and `<Outlet />` resolves against the *live* match
 * registry — so a frozen clone produces doubled IDs and an invariant error
 * (and `clonedeep` blows the stack on the new context cycles).
 *
 * Rendering the leaf route's captured `options.component` directly sidesteps
 * both. While hidden by `<OffScreen>` it simply isn't displayed; navigating
 * back re-shows the same fiber with all state intact.
 */
export default function CachedRoute({ Component }: CachedRouteProps) {
  return <Component />
}
