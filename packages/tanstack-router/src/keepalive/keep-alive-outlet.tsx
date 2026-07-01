import type { ReactNode } from "react"

import KeepAliveIn from "./keep-alive-in"

export type KeepAliveOutletProps = { children?: ReactNode }

/**
 * Drop-in replacement for TanStack's `<Outlet />` in the layout segment whose
 * children should stay alive. Renders the keep-alive cache (visible page +
 * hidden kept pages); `children` render after, if you need extra chrome.
 */
export function KeepAliveOutlet({ children }: KeepAliveOutletProps) {
  return (
    <>
      <KeepAliveIn />
      {children}
    </>
  )
}
