import { isValidElement } from "react"
import type { ReactNode } from "react"

/**
 * The slice of a React Router match this package needs. Kept structural so it
 * holds across React Router 7 and 8 and both declarative and data routers.
 */
export type RouteMatchLike = {
  pathname?: string
  params?: Record<string, string | undefined>
  route: { id?: string; handle?: unknown }
}

/** Route `handle` shape that opts a route into (or out of) keep-alive. */
export type KeepAliveHandle = {
  /**
   * `true` keeps the page alive across tab switches. The deepest matched
   * route that sets this wins, so a layout route can opt every child in and
   * a single child can opt back out with `false`.
   */
  keepAlive?: boolean
}

type RouteContextLike = { outlet?: ReactNode; matches?: RouteMatchLike[] }

function routeContextOf(node: unknown): RouteContextLike | null {
  if (!isValidElement(node)) return null
  const props = node.props as { routeContext?: RouteContextLike } | null
  return props?.routeContext ?? null
}

function childOf(node: unknown): ReactNode {
  if (!isValidElement(node)) return null
  return (node.props as { children?: ReactNode } | null)?.children ?? null
}

/**
 * Full match chain (root → leaf) for the element `useOutlet()` returned.
 *
 * React Router renders an outlet as nested `RenderedRoute` elements, each
 * carrying a `routeContext` prop whose `outlet` is the next level down and
 * whose `matches` is the chain so far — optionally wrapped in an error
 * boundary (same prop) or an `OutletContext` provider. Following `outlet`
 * to the bottom yields the leaf's chain, in data *and* declarative routers.
 *
 * This only reads props; nothing is rendered. Returns `null` if the shape is
 * unrecognised, so callers can fall back to the data router's own matches.
 */
export function collectOutletMatches(outlet: ReactNode): RouteMatchLike[] | null {
  let node: ReactNode = outlet
  let found: RouteMatchLike[] | null = null

  // Bounded: a route tree deeper than this is not a real app.
  for (let depth = 0; node != null && depth < 128; depth++) {
    const ctx = routeContextOf(node)
    if (ctx) {
      if (Array.isArray(ctx.matches)) found = ctx.matches
      // An error boundary's own context has `outlet: null`; the rendered
      // route it wraps (its child) continues the chain.
      node = ctx.outlet ?? (routeContextOf(childOf(node)) ? childOf(node) : null)
    } else {
      // A provider wrapper (e.g. `OutletContext`) — step through it.
      node = childOf(node)
    }
  }

  return found
}

/**
 * Whether the page at the end of `matches` should be kept alive, from the
 * routes' `handle.keepAlive`. Only matches at or below `fromDepth` count, so a
 * flag on a layout *above* the outlet never leaks into it.
 *
 * The deepest route that declares a boolean decides.
 */
export function resolveKeepAlive(
  matches: readonly RouteMatchLike[],
  fromDepth: number,
): boolean {
  for (let i = matches.length - 1; i >= fromDepth; i--) {
    const handle = matches[i]?.route.handle as KeepAliveHandle | undefined
    if (handle && typeof handle.keepAlive === "boolean") return handle.keepAlive
  }
  return false
}
