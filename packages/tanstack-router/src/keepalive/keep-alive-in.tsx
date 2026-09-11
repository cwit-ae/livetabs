import { useEffect, useMemo } from "react"
import type { ComponentType } from "react"
import type { StaticDataRouteOption } from "@tanstack/react-router"
import {
  Outlet,
  useLocation,
  useMatches,
  useRouter,
  useSearch,
} from "@tanstack/react-router"

import { CachedRoute, OffScreen, useIdleEviction } from "@live-tabs/core"
import type { IdleEvictionOptions } from "@live-tabs/core"

import { FrozenLocationProvider } from "./frozen-location"
import { useKeepAliveContext } from "./keep-alive-context"

/**
 * Walks the active route chain. The deepest leaf with
 * `staticData.keepAlive === true` is registered into the keep-alive map keyed
 * by pathname; revisiting that pathname reuses the cached subtree (state
 * preserved). Non-kept paths render normally through `<Outlet />`.
 *
 * Each kept subtree is wrapped in `FrozenLocationProvider` with the URL
 * captured at registration, so its URL-derived hooks see a stable view while
 * the user is elsewhere.
 */
export type KeepAliveInProps = {
  idleMs?: number
  idleOptions?: IdleEvictionOptions
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

  useIdleEviction(
    Object.keys(aliveRoutes).filter((p) => aliveRoutes[p]?.staticData.keepAlive),
    routerPathname,
    (idle) => deleteAliveRoutes([idle]),
    idleMs,
    idleOptions,
  )

  const matches = useMatches()
  const matchedKeys = useMemo(() => matches.map((m) => m.id), [matches])
  const searchKey = useMemo(() => JSON.stringify(liveSearch), [liveSearch])

  useEffect(() => {
    // Defer to a microtask so `useMatches`/`useLocation` reads settle first.
    Promise.resolve().then(() => {
      let staticData: StaticDataRouteOption | undefined
      let leafRouteId: string | undefined
      let leafParams: Record<string, string | undefined> = {}
      // Bottom→top so the deepest keep-alive route wins.
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i]!
        if (m.staticData?.keepAlive) {
          staticData = m.staticData
          leafRouteId = m.routeId
          leafParams = (m.params ?? {}) as Record<string, string | undefined>
          break
        }
      }

      if (staticData?.keepAlive && leafRouteId) {
        const route = router.routesById[leafRouteId as never] as
          | { options?: { component?: ComponentType } }
          | undefined
        const Component = route?.options?.component
        if (Component) {
          setAliveRoutes(routerPathname, {
            staticData,
            element: <CachedRoute Component={Component} />,
            frozen: {
              pathname: routerPathname,
              search: liveSearch,
              params: leafParams,
            },
          })
          return
        }
      }

      // Not a keep-alive route — record the visit so the renderer knows this
      // pathname is "live" (vs cached).
      setAliveRoutes(routerPathname, {
        ...aliveRoutes[routerPathname],
        staticData: staticData ?? {},
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedKeys, searchKey])

  return (
    <>
      {Object.entries(aliveRoutes).map(([pathname, route]) =>
        route.staticData.keepAlive ? (
          <OffScreen
            key={pathname}
            pathname={pathname}
            mode={routerPathname === pathname ? "visible" : "hidden"}
          >
            <FrozenLocationProvider value={route.frozen ?? null}>
              {route.element}
            </FrozenLocationProvider>
          </OffScreen>
        ) : (
          pathname === routerPathname && <Outlet key={pathname} />
        ),
      )}
    </>
  )
}
