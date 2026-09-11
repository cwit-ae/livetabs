import type { ReactNode } from "react"
import type { IdleEvictionOptions } from "@live-tabs/core"

import KeepAliveIn from "./keep-alive-in"

export type KeepAliveOutletProps = {
  children?: ReactNode
  /**
   * Milliseconds a hidden tab may idle before its subtree is released, to cap
   * the memory the workspace holds. The tab stays in the bar and remounts
   * fresh when revisited. `0` (the default) never evicts.
   *
   * A sensible starting point is five minutes: `idleMs={5 * 60_000}`.
   */
  idleMs?: number
  /** Fine-tune the sweep, or protect specific paths from eviction. */
  idleOptions?: IdleEvictionOptions
}

/**
 * Drop-in replacement for TanStack's `<Outlet />` in the layout segment whose
 * children should stay alive. Renders the keep-alive cache (visible page +
 * hidden kept pages); `children` render after, if you need extra chrome.
 */
export function KeepAliveOutlet({
  children,
  idleMs,
  idleOptions,
}: KeepAliveOutletProps) {
  return (
    <>
      <KeepAliveIn idleMs={idleMs} idleOptions={idleOptions} />
      {children}
    </>
  )
}
