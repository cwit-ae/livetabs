import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"

import type { FrozenLocation } from "./frozen-location"

/**
 * Keep-alive subtree registry for the Next adapter.
 *
 * Unlike the TanStack adapter there is no `staticData.keepAlive` opt-in —
 * appearing in `createWorkspaceRoutes` *is* the opt-in, so every entry in this
 * map is a kept route by construction.
 */
export type AliveRouteData = {
  element?: ReactNode
  /** URL snapshot at registration — provided to the kept subtree. */
  frozen?: FrozenLocation
}

export type AliveRoutes = Record<string, AliveRouteData>

export type KeepAliveContextState = {
  aliveRoutes: AliveRoutes
  setAliveRoutes: (pathname: string, data: AliveRouteData) => void
  /**
   * Register a route on first visit, refresh its URL snapshot on every later
   * one. The element is created **once** and then reused verbatim: re-creating
   * it on revisit is what silently remounts a tab and loses its state.
   *
   * Both reads happen inside the state updater so no stale `aliveRoutes`
   * closure is needed — which would otherwise force `aliveRoutes` into the
   * caller's effect deps and loop.
   */
  ensureAliveRoute: (
    pathname: string,
    createElement: () => ReactNode,
    frozen: FrozenLocation,
  ) => void
  deleteAliveRoutes: (pathnames: string[]) => void
}

const KeepAliveContext = createContext<KeepAliveContextState>({
  aliveRoutes: {},
  setAliveRoutes: () => {},
  ensureAliveRoute: () => {},
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

  const ensureAliveRoute = (
    key: string,
    createElement: () => ReactNode,
    frozen: FrozenLocation,
  ) => {
    _setAliveRoutes((state) => {
      const existing = state[key]
      return {
        ...state,
        [key]: { element: existing?.element ?? createElement(), frozen },
      }
    })
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
      value={{
        aliveRoutes,
        setAliveRoutes,
        ensureAliveRoute,
        deleteAliveRoutes,
      }}
    >
      {children}
    </KeepAliveContext.Provider>
  )
}

export function useKeepAliveContext() {
  return useContext(KeepAliveContext)
}
