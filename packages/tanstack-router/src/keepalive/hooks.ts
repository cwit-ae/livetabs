import { useCallback, useMemo } from "react"
import { createActiveHooks } from "@live-tabs/core"

import { useKeptPathname } from "./frozen-location"
import { useKeepAliveContext } from "./keep-alive-context"
import type { AliveRoutes } from "./keep-alive-context"

/**
 * Bind the router-agnostic active hooks to TanStack's kept pathname, so a
 * background subtree reacts to *its own* show/hide and not the live URL's.
 */
const activeHooks = createActiveHooks(useKeptPathname)

export const useActiveChanged = activeHooks.useActiveChanged
export const useActiveEffect = activeHooks.useActiveEffect

/**
 * Read the live keep-alive map (kept routes only) plus imperative destroy
 * helpers. `destroy(pathname)` frees a cached subtree — call it when closing
 * a tab so the page's React tree is torn down. Every returned function is
 * referentially stable.
 */
export function useKeepAlive() {
  const { aliveRoutes: _aliveRoutes, deleteAliveRoutes } = useKeepAliveContext()

  const aliveRoutes = useMemo(() => {
    return Object.entries(_aliveRoutes).reduce((acc, [key, value]) => {
      if (value.staticData?.keepAlive) acc[key] = value
      return acc
    }, {} as AliveRoutes)
  }, [_aliveRoutes])

  const destroy = useCallback(
    (pathname: string | string[]) =>
      deleteAliveRoutes(Array.isArray(pathname) ? pathname : [pathname]),
    [deleteAliveRoutes],
  )
  const destroyAll = useCallback(
    () => deleteAliveRoutes(Object.keys(aliveRoutes)),
    [deleteAliveRoutes, aliveRoutes],
  )

  return useMemo(
    () => ({ aliveRoutes, destroy, destroyAll }),
    [aliveRoutes, destroy, destroyAll],
  )
}
