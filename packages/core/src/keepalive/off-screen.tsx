import { useEffect, useRef } from "react"
import type { ReactNode } from "react"

import type { ActivityMode } from "./types"
import { getKeepAliveEmitter } from "./hooks"

export type OffScreenProps = {
  mode: ActivityMode
  pathname: string
  children: ReactNode
}

/**
 * Keep a route subtree mounted at all times and toggle visibility with CSS.
 * This is the only approach that reliably preserves `useState`, refs, scroll
 * position, and in-progress form input across switches in stable React 19.
 *
 * (The upstream Suspense throw-promise pattern preserves offscreen state only
 * inside `startTransition` / specific render modes; in stable React 19
 * without transitions, re-suspending an already-rendered subtree unmounts it
 * — so detail pages re-rendered fresh on every switch.)
 *
 * `display: contents` keeps the wrapper layout-invisible so it never disturbs
 * the page's own flex/grid structure when visible.
 */
export default function OffScreen({ mode, pathname, children }: OffScreenProps) {
  const emitter = getKeepAliveEmitter()
  const emitted = useRef(false)

  const emitActiveChange = (next?: ActivityMode) => {
    emitter.emit("activeChange", {
      pathname,
      mode: next ?? mode,
      callback() {
        emitted.current = true
      },
    })
  }

  useEffect(() => {
    if (mode === "visible") emitActiveChange()
    else if (emitted.current) emitActiveChange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    return () => emitActiveChange("hidden")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      data-keepalive-pathname={pathname}
      data-keepalive-mode={mode}
      style={{ display: mode === "visible" ? "contents" : "none" }}
    >
      {children}
    </div>
  )
}
