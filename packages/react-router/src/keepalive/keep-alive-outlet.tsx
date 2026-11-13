import { useCallback, useContext, useEffect, useMemo, useRef } from "react"
import type { Context, ReactNode } from "react"
import { useOutlet } from "react-router"
import type { Location } from "react-router"

import { OffScreen, useIdleEviction } from "@live-tabs/core"
import type { IdleEvictionOptions } from "@live-tabs/core"

import { FrozenLocationProvider } from "./frozen-location"
import type { FrozenLocation } from "./frozen-location"
import { useKeepAliveContext } from "./keep-alive-context"
import type { AliveRouteData } from "./keep-alive-context"
import { collectOutletMatches, resolveKeepAlive } from "./matches"
import type { RouteMatchLike } from "./matches"
import {
  DataRouterStateContext,
  FROZEN_CONTEXTS,
  LocationContext,
  RouteContext,
} from "./router-contexts"

export type KeepAliveOutletProps = {
  /**
   * Forwarded to the child route exactly like `<Outlet context>`; read it with
   * `useOutletContext()`. A hidden page keeps the value it last received.
   */
  context?: unknown
  /**
   * Keep a page alive even without `handle.keepAlive` on its route. Useful in
   * declarative `<Routes>` trees you'd rather not touch, or to decide by URL.
   * Returning `false` defers to the route's `handle`.
   */
  include?: (pathname: string) => boolean
  /**
   * Milliseconds a hidden tab may idle before its subtree is released, to cap
   * the memory the workspace holds. The tab stays in the bar and remounts
   * fresh when revisited. `0` (the default) never evicts.
   *
   * A sensible starting point is five minutes: `idleMs={5 * 60_000}`.
   */
  idleMs?: number
  /** Fine-tune the sweep, or protect specific paths from eviction. */
  idleOptions?: IdleEvictionOptions
  /** Rendered after the outlet, for extra chrome. */
  children?: ReactNode
}

type LocationContextValue = { location: Location }
type DataRouterStateLike = { matches?: RouteMatchLike[] } | null

/** Wrap `element` in each frozen context, innermost last. */
function provide(values: readonly unknown[], element: ReactNode): ReactNode {
  return FROZEN_CONTEXTS.reduceRight<ReactNode>((child, Ctx, i) => {
    const Provider = (Ctx as Context<unknown>).Provider
    return <Provider value={values[i]}>{child}</Provider>
  }, element)
}

/**
 * Drop-in replacement for React Router's `<Outlet />` in the layout whose
 * children should stay alive.
 *
 * A child route opts in with `handle: { keepAlive: true }`. Its page is then
 * kept mounted after you navigate away — hidden, with its state, scroll and
 * form input intact — and shown again when you come back. Routes without the
 * flag render exactly as `<Outlet />` would, remounting as React Router
 * normally decides.
 *
 * **The page's own router hooks stay truthful while hidden.** Each kept page
 * is rendered with the location and data-router contexts it last saw, so
 * `useLocation`, `useParams`, `useSearchParams`, `useLoaderData`,
 * `useActionData` and `useMatches` all describe that page's URL — not the tab
 * you are looking at — and the hidden subtree does not re-render as the live
 * router moves on.
 */
export function KeepAliveOutlet({
  context,
  include,
  idleMs = 0,
  idleOptions,
  children,
}: KeepAliveOutletProps) {
  const { aliveRoutes, setAliveRoute, deleteAliveRoutes } = useKeepAliveContext()

  const outlet = useOutlet(context)
  // `FROZEN_CONTEXTS` is module-constant, so this loop is a fixed hook list.
  const liveValues = FROZEN_CONTEXTS.map((ctx) => useContext(ctx))
  const { location } = useContext(LocationContext) as LocationContextValue
  const pathname = location.pathname
  const depth =
    (useContext(RouteContext) as { matches?: unknown[] } | null)?.matches
      ?.length ?? 0
  const dataState = useContext(DataRouterStateContext) as DataRouterStateLike

  const matches = useMemo(
    () => collectOutletMatches(outlet) ?? dataState?.matches ?? [],
    [outlet, dataState],
  )

  const kept =
    outlet != null &&
    ((include?.(pathname) ?? false) || resolveKeepAlive(matches, depth))

  const leafParams = matches[matches.length - 1]?.params
  const frozen = useMemo<FrozenLocation>(
    () => ({
      pathname,
      search: Object.fromEntries(new URLSearchParams(location.search)),
      params: { ...leafParams },
    }),
    // `location` changes identity on every navigation, covering `pathname`
    // and `search`; `leafParams` only ever changes alongside it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location],
  )

  // Kept on a ref so the effect below can memoise against a stable array.
  const liveValuesRef = useRef(liveValues)
  liveValuesRef.current = liveValues

  const lastPathname = useRef<string | null>(null)
  useEffect(() => {
    const arrived = lastPathname.current !== pathname
    lastPathname.current = pathname
    if (!kept || outlet == null) return
    setAliveRoute(
      pathname,
      { element: outlet, contextValues: liveValuesRef.current, frozen },
      { revive: arrived },
    )
    // `liveValues` is spread so a change to any router context refreshes the
    // snapshot; its length is module-constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kept, pathname, outlet, frozen, setAliveRoute, ...liveValues])

  const evict = useCallback(
    (p: string) => deleteAliveRoutes([p]),
    [deleteAliveRoutes],
  )
  useIdleEviction(Object.keys(aliveRoutes), pathname, evict, idleMs, idleOptions)

  // Every kept page, plus the current one on its first visit — rendered in
  // the same keyed list from the very first frame, so a kept page never mounts
  // twice and there is no blank frame while it registers.
  const keys = Object.keys(aliveRoutes)
  if (kept && !(pathname in aliveRoutes)) keys.push(pathname)

  return (
    <>
      {keys.map((p) => {
        const active = kept && p === pathname
        const data: AliveRouteData | undefined = active
          ? { element: outlet, contextValues: liveValues, frozen }
          : aliveRoutes[p]
        if (!data) return null
        return (
          <OffScreen key={p} pathname={p} mode={active ? "visible" : "hidden"}>
            <FrozenLocationProvider value={data.frozen}>
              {provide(data.contextValues, data.element)}
            </FrozenLocationProvider>
          </OffScreen>
        )
      })}
      {/* Not kept: exactly what `<Outlet />` renders, in a fixed slot so React
          Router's own remount rules apply unchanged. */}
      {kept ? null : outlet}
      {children}
    </>
  )
}
