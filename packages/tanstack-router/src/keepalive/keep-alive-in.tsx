import { useCallback, useEffect, useMemo, useRef } from "react"
import type { ComponentType, ReactNode } from "react"
import type { StaticDataRouteOption } from "@tanstack/react-router"
import {
  Outlet,
  useLocation,
  useMatches,
  useRouter,
  useRouterState,
  useSearch,
} from "@tanstack/react-router"

import { CachedRoute, OffScreen, useIdleEviction } from "@live-tabs/core"
import type { IdleEvictionOptions } from "@live-tabs/core"

import { FrozenLocationProvider } from "./frozen-location"
import type { FrozenLocation } from "./frozen-location"
import { useKeepAliveContext } from "./keep-alive-context"

/**
 * Walks the active route chain. The deepest leaf with
 * `staticData.keepAlive === true` is registered into the keep-alive map keyed
 * by pathname; revisiting that pathname reuses the cached subtree (state
 * preserved). Non-kept paths render normally through `<Outlet />`.
 *
 * The current page renders from the very first commit — a kept page sits in
 * the same keyed list it will live in once registered, so it mounts exactly
 * once and there is no blank frame while it registers.
 *
 * Each kept subtree is wrapped in `FrozenLocationProvider` with the URL
 * captured at registration, so its URL-derived hooks see a stable view while
 * the user is elsewhere.
 */
export type KeepAliveInProps = {
  idleMs?: number
  idleOptions?: IdleEvictionOptions
}

type Leaf = {
  staticData: StaticDataRouteOption | undefined
  routeId: string | undefined
  params: Record<string, string | undefined>
}

export default function KeepAliveIn({
  idleMs = 0,
  idleOptions,
}: KeepAliveInProps = {}) {
  const { aliveRoutes, setAliveRoutes, deleteAliveRoutes } =
    useKeepAliveContext()
  const router = useRouter()
  const routerPathname = useLocation({ select: (l) => l.pathname })
  const liveSearch = useSearch({ strict: false }) as Record<string, unknown>
  // TanStack moves `location` at the start of a navigation but swaps
  // `matches` only once loading resolves. While loading, the matches still
  // describe the previous URL, so they must not be paired with this pathname.
  const isLoading = useRouterState({ select: (s) => s.isLoading })

  const evict = useCallback(
    (idle: string) => deleteAliveRoutes([idle]),
    [deleteAliveRoutes],
  )
  useIdleEviction(
    Object.keys(aliveRoutes).filter((p) => aliveRoutes[p]?.staticData.keepAlive),
    routerPathname,
    evict,
    idleMs,
    idleOptions,
  )

  const matches = useMatches()
  const matchedKeys = useMemo(() => matches.map((m) => m.id), [matches])
  const searchKey = useMemo(() => JSON.stringify(liveSearch), [liveSearch])

  // Bottom→top so the deepest keep-alive route wins.
  const leaf = useMemo<Leaf>(() => {
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i]!
      if (m.staticData?.keepAlive) {
        return {
          staticData: m.staticData,
          routeId: m.routeId,
          params: (m.params ?? {}) as Record<string, string | undefined>,
        }
      }
    }
    return { staticData: undefined, routeId: undefined, params: {} }
  }, [matches])

  const Component = leaf.routeId
    ? (
        router.routesById[leaf.routeId as never] as
          | { options?: { component?: ComponentType } }
          | undefined
      )?.options?.component
    : undefined

  const element = useMemo<ReactNode>(
    () => (Component ? <CachedRoute Component={Component} /> : undefined),
    [Component],
  )
  const paramsKey = JSON.stringify(leaf.params)
  const frozen = useMemo<FrozenLocation>(
    () => ({ pathname: routerPathname, search: liveSearch, params: leaf.params }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routerPathname, searchKey, paramsKey],
  )

  /**
   * The pathname of the current visit, and whether this engine registered it
   * during that visit. Closing the active tab destroys its page *before*
   * navigating, and TanStack navigates asynchronously, so a re-run of the
   * effect below in between must not resurrect the closed page as a hidden
   * subtree. A fresh arrival at the pathname registers it again.
   */
  const visit = useRef<{ pathname: string | null; registered: boolean }>({
    pathname: null,
    registered: false,
  })

  useEffect(() => {
    if (visit.current.pathname !== routerPathname) {
      visit.current = { pathname: routerPathname, registered: false }
    } else if (visit.current.registered && !(routerPathname in aliveRoutes)) {
      return // destroyed while still on screen
    }
    visit.current.registered = true

    if (leaf.staticData?.keepAlive && element) {
      setAliveRoutes(routerPathname, {
        staticData: leaf.staticData,
        element,
        frozen,
      })
      return
    }

    // Not a keep-alive route — record the visit so the renderer knows this
    // pathname is "live" (vs cached).
    setAliveRoutes(routerPathname, {
      ...aliveRoutes[routerPathname],
      staticData: leaf.staticData ?? {},
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedKeys, searchKey])

  // The pathname the live matches were committed for. While a navigation
  // loads, `location` already points at the next URL but `matches` (and so
  // `<Outlet />`) still describe this one.
  const settledPathname = useRef(routerPathname)
  if (!isLoading) settledPathname.current = routerPathname
  const settled = settledPathname.current === routerPathname

  // Whether the current page is kept, decided from the live matches. Unknown
  // (`null`) while they still describe the previous URL.
  const currentKept: boolean | null = settled
    ? Boolean(leaf.staticData?.keepAlive && element)
    : null

  // Every kept page, plus the current one before it registers.
  const keys = Object.keys(aliveRoutes).filter(
    (p) => aliveRoutes[p]!.staticData.keepAlive,
  )
  if (currentKept && !keys.includes(routerPathname)) keys.push(routerPathname)

  // Non-kept pages render through `<Outlet />` in a fixed slot, keyed by the
  // URL its matches belong to: a new pathname remounts it, and while the next
  // URL loads it keeps showing the page it already shows — exactly as a plain
  // `<Outlet />` would. A kept page is never rendered through it.
  const showOutlet = !leaf.staticData?.keepAlive || !element

  return (
    <>
      {keys.map((pathname) => {
        const active = pathname === routerPathname
        const data =
          active && currentKept
            ? { element, frozen }
            : aliveRoutes[pathname]
        if (!data) return null
        return (
          <OffScreen
            key={pathname}
            pathname={pathname}
            mode={active ? "visible" : "hidden"}
          >
            <FrozenLocationProvider value={data.frozen ?? null}>
              {data.element}
            </FrozenLocationProvider>
          </OffScreen>
        )
      })}
      {showOutlet ? <Outlet key={settledPathname.current} /> : null}
    </>
  )
}
