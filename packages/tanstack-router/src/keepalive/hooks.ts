import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DependencyList, EffectCallback } from "react"
import { useLocation } from "@tanstack/react-router"

import { TinyEmitter } from "./event"
import type { ActivityMode } from "./types"
import { useKeepAliveContext } from "./keep-alive-context"
import type { AliveRoutes } from "./keep-alive-context"

type KeepAliveEvents = {
  activeChange: [
    { pathname: string; mode: ActivityMode; callback?: () => void },
  ]
}

/** Process-wide emitter so off-screen toggles reach `useActiveEffect`. */
const emitter = new TinyEmitter<KeepAliveEvents>()

/** Internal: the shared keep-alive event bus (used by `<OffScreen>`). */
export function getKeepAliveEmitter() {
  return emitter
}

type EventHandlers = {
  on?: Partial<{
    [K in keyof KeepAliveEvents]: (...args: KeepAliveEvents[K]) => void
  }>
}

export function useEventListener(events?: EventHandlers) {
  useEffect(() => {
    const on = events?.on
    if (!on) return
    const entries = Object.entries(on) as Array<
      [keyof KeepAliveEvents, (...args: KeepAliveEvents[keyof KeepAliveEvents]) => void]
    >
    for (const [name, fn] of entries) emitter.on(name, fn)
    return () => {
      for (const [name, fn] of entries) emitter.off(name, fn)
    }
    // Mirror upstream: bind once on mount, unbind on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { emitter }
}

/** Force a re-render. */
export function useUpdate() {
  const [, setState] = useState({})
  return useCallback(() => setState({}), [])
}

/**
 * Read the live keep-alive map (kept routes only) plus imperative destroy
 * helpers. `destroy(pathname)` frees a cached subtree — call it when closing
 * a tab so the page's React tree is torn down.
 */
export function useKeepAlive() {
  const { aliveRoutes: _aliveRoutes, deleteAliveRoutes } = useKeepAliveContext()

  const aliveRoutes = useMemo(() => {
    return Object.entries(_aliveRoutes).reduce((acc, [key, value]) => {
      if (value.staticData?.keepAlive) acc[key] = value
      return acc
    }, {} as AliveRoutes)
  }, [_aliveRoutes])

  const update = useUpdate()
  useEventListener({ on: { activeChange: () => update() } })

  const destroy = (pathname: string | string[]) => {
    deleteAliveRoutes(Array.isArray(pathname) ? pathname : [pathname])
  }
  const destroyAll = () => deleteAliveRoutes(Object.keys(aliveRoutes))

  return { aliveRoutes, destroy, destroyAll }
}

/** Run `fn(active)` whenever *this* subtree is shown/hidden via keep-alive. */
export function useActiveChanged(fn: (active: boolean) => void) {
  const routePathname = useLocation({ select: (l) => l.pathname })
  useEventListener({
    on: {
      activeChange: ({ pathname, mode, callback }) => {
        if (pathname === routePathname) fn(mode === "visible")
        callback?.()
      },
    },
  })
}

/**
 * Like `useEffect`, but the effect (re)runs when the kept subtree becomes
 * active and cleans up when it goes inactive — not just on mount/unmount.
 * Use for work that must pause while a tab is in the background (polling,
 * focus, expensive listeners).
 */
export function useActiveEffect(
  activeCallback: EffectCallback,
  deps?: DependencyList,
) {
  const returnValue = useRef<ReturnType<EffectCallback> | undefined>(undefined)
  const active = useRef(false)

  useEffect(() => {
    if (active.current) returnValue.current = activeCallback()
    return () => {
      if (active.current) returnValue.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useActiveChanged((isActive) => {
    if (isActive) {
      active.current = true
      returnValue.current = activeCallback()
    } else {
      active.current = false
      returnValue.current?.()
    }
  })
}
