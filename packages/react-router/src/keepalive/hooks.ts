import { useCallback, useMemo } from "react"
import { createActiveHooks } from "@live-tabs/core"

import { useKeptPathname } from "./frozen-location"
import { useKeepAliveContext } from "./keep-alive-context"

/**
 * Bind the router-agnostic active hooks to the kept pathname, so a background
 * page reacts to *its own* show/hide and not the live URL's.
 */
const activeHooks = createActiveHooks(useKeptPathname)

export const useActiveChanged = activeHooks.useActiveChanged
export const useActiveEffect = activeHooks.useActiveEffect

/**
 * The live keep-alive map plus imperative destroy helpers.
 * `destroy(pathname)` frees a kept page's subtree — the tab bar calls it for
 * you when a tab closes. Every returned function is referentially stable.
 */
export function useKeepAlive() {
  const { aliveRoutes, deleteAliveRoutes } = useKeepAliveContext()

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
