import { createContext, useCallback, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { StaticDataRouteOption } from "@tanstack/react-router"

import type { FrozenLocation } from "./frozen-location"

/**
 * Keep-alive subtree registry. Adapted from `tanstack-router-keepalive`
 * (https://github.com/hemengke1997/tanstack-router-keepalive, MIT) — the
 * context/provider are essentially upstream; the renderer (`keep-alive-in`)
 * and off-screen strategy are forked. See those file headers.
 */

type AliveRouteData = {
  staticData: StaticDataRouteOption
  element?: ReactNode
  /** URL snapshot at registration — provided to the kept subtree. */
  frozen?: FrozenLocation
}

export type AliveRoutes = Record<string, AliveRouteData>

export type KeepAliveContextState = {
  aliveRoutes: AliveRoutes
  setAliveRoutes: (pathname: string, data: AliveRouteData) => void
  deleteAliveRoutes: (pathnames: string[]) => void
}

const KeepAliveContext = createContext<KeepAliveContextState>({
  aliveRoutes: {},
  setAliveRoutes: () => {},
  deleteAliveRoutes: () => {},
})

export function KeepAliveProvider({
  children,
  defaultAliveRoutes = {},
}: {
  children: ReactNode
  defaultAliveRoutes?: AliveRoutes
}) {
  const [aliveRoutes, _setAliveRoutes] =
    useState<AliveRoutes>(defaultAliveRoutes)

  // Stable callbacks and a memoised value: consumers re-render only when the
  // map itself changes.
  const setAliveRoutes = useCallback((key: string, value: AliveRouteData) => {
    _setAliveRoutes((state) => ({ ...state, [key]: value }))
  }, [])

  const deleteAliveRoutes = useCallback((keys: string[]) => {
    _setAliveRoutes((state) => {
      // Nothing to remove → same state object → no re-render.
      if (!keys.some((key) => key in state)) return state
      const next = { ...state }
      for (const key of keys) delete next[key]
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ aliveRoutes, setAliveRoutes, deleteAliveRoutes }),
    [aliveRoutes, setAliveRoutes, deleteAliveRoutes],
  )

  return (
    <KeepAliveContext.Provider value={value}>{children}</KeepAliveContext.Provider>
  )
}

export function useKeepAliveContext() {
  return useContext(KeepAliveContext)
}
