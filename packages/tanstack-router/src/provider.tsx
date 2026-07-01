import type { ReactNode } from "react"

import { WorkspaceProvider as CoreWorkspaceProvider } from "@livetabs/core"
import type { WorkspaceTabsOptions, TabRegistry } from "@livetabs/core"

import { KeepAliveProvider } from "./keepalive/keep-alive-context"
import { tanstackRouterAdapter } from "./adapter"

export type WorkspaceProviderProps = {
  /** Store config — pinned root path, max tabs, etc. */
  options?: WorkspaceTabsOptions
  /** Path → tab-meta resolver (from `createTabRegistry`). */
  registry?: TabRegistry
  /**
   * Also mount `KeepAliveProvider` (default `true`). Set `false` if you place
   * `KeepAliveProvider` yourself, higher in the tree.
   */
  keepAlive?: boolean
  children: ReactNode
}

/**
 * One provider for a TanStack Router app: the TanStack adapter is pre-wired,
 * the tabs store + registry are created, and `KeepAliveProvider` is mounted so
 * kept pages have a cache to live in. Put it above your `RouterProvider`.
 */
export function WorkspaceProvider({
  options,
  registry,
  keepAlive = true,
  children,
}: WorkspaceProviderProps) {
  const inner = (
    <CoreWorkspaceProvider
      adapter={tanstackRouterAdapter}
      options={options}
      registry={registry}
    >
      {children}
    </CoreWorkspaceProvider>
  )

  return keepAlive ? <KeepAliveProvider>{inner}</KeepAliveProvider> : inner
}
