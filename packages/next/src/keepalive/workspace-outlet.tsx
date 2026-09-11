import { useEffect } from "react"
import type { ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { CachedRoute, OffScreen, useIdleEviction } from "@live-tabs/core"
import type { IdleEvictionOptions } from "@live-tabs/core"

import { FrozenLocationProvider } from "./frozen-location"
import { useKeepAliveContext } from "./keep-alive-context"
import { useWorkspaceRoutes } from "../routes-context"

export type WorkspaceOutletProps = {
  /**
   * Next's own `children` for the layout this outlet sits in. Rendered only
   * when the current path is **not** a registered workspace route, so
   * unregistered pages behave exactly as they did before live-tabs.
   */
  children?: ReactNode
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
}

/**
 * Renders the workspace: every registered path that has been visited stays
 * mounted, with the current one visible and the rest hidden by `<OffScreen>`.
 *
 * This is what keeps live-tabs off the Next router's toes. Next still owns
 * navigation and the URL; it just never gets to decide what the workspace
 * area renders. Paths absent from `createWorkspaceRoutes` fall straight
 * through to `children`, so adoption is opt-in per route.
 */
export function WorkspaceOutlet({
  children,
  idleMs = 0,
  idleOptions,
}: WorkspaceOutletProps) {
  const { aliveRoutes, ensureAliveRoute, deleteAliveRoutes } =
    useKeepAliveContext()
  const routes = useWorkspaceRoutes()
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const searchKey = searchParams?.toString() ?? ""

  const Component = routes.resolveComponent(pathname)

  useIdleEviction(
    Object.keys(aliveRoutes),
    pathname,
    (idle) => deleteAliveRoutes([idle]),
    idleMs,
    idleOptions,
  )

  useEffect(() => {
    if (!Component) return
    ensureAliveRoute(
      pathname,
      () => <CachedRoute Component={Component} />,
      {
        pathname,
        search: Object.fromEntries(new URLSearchParams(searchKey)),
        params: routes.resolveParams(pathname),
      },
    )
    // `Component`/`routes` are registry-stable; re-running on their identity
    // would re-register on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchKey])

  return (
    <>
      {Object.entries(aliveRoutes).map(([keptPathname, route]) => (
        <OffScreen
          key={keptPathname}
          pathname={keptPathname}
          mode={keptPathname === pathname ? "visible" : "hidden"}
        >
          <FrozenLocationProvider value={route.frozen ?? null}>
            {route.element}
          </FrozenLocationProvider>
        </OffScreen>
      ))}
      {!Component && children}
    </>
  )
}
