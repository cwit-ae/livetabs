import { createActiveHooks, useEventListener, useUpdate } from "@live-tabs/core"

import { useKeptPathname } from "./frozen-location"
import { useKeepAliveContext } from "./keep-alive-context"

/**
 * Bind the router-agnostic active hooks to the Next adapter's kept pathname,
 * so a background subtree reacts to *its own* show/hide and not the live URL's.
 */
const activeHooks = createActiveHooks(useKeptPathname)

export const useActiveChanged = activeHooks.useActiveChanged
export const useActiveEffect = activeHooks.useActiveEffect

/**
 * Read the live keep-alive map plus imperative destroy helpers.
 * `destroy(pathname)` frees a cached subtree — called for you when a tab
 * closes, so the page's React tree is torn down rather than leaking.
 */
export function useKeepAlive() {
  const { aliveRoutes, deleteAliveRoutes } = useKeepAliveContext()

  const update = useUpdate()
  useEventListener({ on: { activeChange: () => update() } })

  const destroy = (pathname: string | string[]) => {
    deleteAliveRoutes(Array.isArray(pathname) ? pathname : [pathname])
  }
  const destroyAll = () => deleteAliveRoutes(Object.keys(aliveRoutes))

  return { aliveRoutes, destroy, destroyAll }
}
