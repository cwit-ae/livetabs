import { useCallback, useEffect, useRef, useState } from "react"
import type { DependencyList, EffectCallback } from "react"

import { TinyEmitter } from "./event"
import type { ActivityMode } from "./types"

export type KeepAliveEvents = {
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
      [
        keyof KeepAliveEvents,
        (...args: KeepAliveEvents[keyof KeepAliveEvents]) => void,
      ]
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
 * Build the router-agnostic half of the keep-alive hook surface.
 *
 * Both hooks need one thing from the host router: "which page is *this*
 * subtree?". Adapters pass their own `useKeptPathname` — the frozen pathname
 * inside a kept subtree, the live one outside — so the engine itself stays
 * free of any router import.
 *
 * Call once at module scope in an adapter; the returned hooks are stable.
 */
export function createActiveHooks(useKeptPathname: () => string) {
  /** Run `fn(active)` whenever *this* subtree is shown/hidden via keep-alive. */
  function useActiveChanged(fn: (active: boolean) => void) {
    const routePathname = useKeptPathname()
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
  function useActiveEffect(
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

  return { useActiveChanged, useActiveEffect }
}
