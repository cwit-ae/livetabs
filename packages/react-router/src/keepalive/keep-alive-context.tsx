import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"

import type { FrozenLocation } from "./frozen-location"

/**
 * One kept page: the outlet element it last rendered, and the router context
 * values it saw at that moment. While the page is hidden both are replayed
 * verbatim, so React bails out of re-rendering it and its router hooks keep
 * answering for its own URL.
 */
export type AliveRouteData = {
  element: ReactNode
  /** Values for `FROZEN_CONTEXTS`, index-aligned. */
  contextValues: readonly unknown[]
  /** URL snapshot, for `useFrozenLocation()`. */
  frozen: FrozenLocation
}

export type AliveRoutes = Record<string, AliveRouteData>

export type KeepAliveContextState = {
  aliveRoutes: AliveRoutes
  /**
   * Record (or refresh) a page's snapshot.
   *
   * `revive` is set only when the router has just *arrived* at `pathname`. A
   * page destroyed while still on screen — closing the active tab destroys
   * first and navigates after, and a data router's navigation is async — must
   * not be re-registered by the re-renders that happen before the URL
   * actually changes, or the closed tab's subtree would linger hidden.
   */
  setAliveRoute: (
    pathname: string,
    data: AliveRouteData,
    options?: { revive?: boolean },
  ) => void
  deleteAliveRoutes: (pathnames: string[]) => void
}

const KeepAliveContext = createContext<KeepAliveContextState>({
  aliveRoutes: {},
  setAliveRoute: () => {},
  deleteAliveRoutes: () => {},
})

function sameSnapshot(a: AliveRouteData | undefined, b: AliveRouteData) {
  if (!a) return false
  if (a.element !== b.element || a.frozen !== b.frozen) return false
  if (a.contextValues.length !== b.contextValues.length) return false
  return a.contextValues.every((v, i) => v === b.contextValues[i])
}

export function KeepAliveProvider({ children }: { children: ReactNode }) {
  const [aliveRoutes, setAliveRoutes] = useState<AliveRoutes>({})
  /** Pages destroyed since the router last arrived at them. */
  const destroyed = useRef(new Set<string>())

  const setAliveRoute = useCallback<KeepAliveContextState["setAliveRoute"]>(
    (pathname, data, options) => {
      if (options?.revive) destroyed.current.delete(pathname)
      else if (destroyed.current.has(pathname)) return

      setAliveRoutes((state) =>
        // Unchanged snapshot → same state object → no re-render.
        sameSnapshot(state[pathname], data) ? state : { ...state, [pathname]: data },
      )
    },
    [],
  )

  const deleteAliveRoutes = useCallback((pathnames: string[]) => {
    for (const p of pathnames) destroyed.current.add(p)
    setAliveRoutes((state) => {
      if (!pathnames.some((p) => p in state)) return state
      const next = { ...state }
      for (const p of pathnames) delete next[p]
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ aliveRoutes, setAliveRoute, deleteAliveRoutes }),
    [aliveRoutes, setAliveRoute, deleteAliveRoutes],
  )

  return (
    <KeepAliveContext.Provider value={value}>{children}</KeepAliveContext.Provider>
  )
}

export function useKeepAliveContext() {
  return useContext(KeepAliveContext)
}
