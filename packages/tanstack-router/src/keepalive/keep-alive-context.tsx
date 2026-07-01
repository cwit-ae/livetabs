import { createContext, useContext, useState } from "react"
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

  const setAliveRoutes = (key: string, value: AliveRouteData) => {
    _setAliveRoutes((state) => ({ ...state, [key]: value }))
  }

  const deleteAliveRoutes = (keys: string[]) => {
    _setAliveRoutes((state) => {
      const next = { ...state }
      for (const key of keys) delete next[key]
      return next
    })
  }

  return (
    <KeepAliveContext.Provider
      value={{ aliveRoutes, setAliveRoutes, deleteAliveRoutes }}
    >
      {children}
    </KeepAliveContext.Provider>
  )
}

export function useKeepAliveContext() {
  return useContext(KeepAliveContext)
}
