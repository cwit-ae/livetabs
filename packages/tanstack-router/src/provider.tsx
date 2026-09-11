import type { ReactNode } from "react"

import { WorkspaceProvider as CoreWorkspaceProvider } from "@live-tabs/core"
import type {
  PersistOptions,
  WorkspaceTabsOptions,
  TabRegistry,
} from "@live-tabs/core"

import { KeepAliveProvider } from "./keepalive/keep-alive-context"
import { tanstackRouterAdapter } from "./adapter"

export type WorkspaceProviderProps = {
  /** Store config — pinned root path, max tabs, etc. */
  options?: WorkspaceTabsOptions
  /** Path → tab-meta resolver (from `createTabRegistry`). */
  registry?: TabRegistry
  /**
   * Restore the tab strip across reloads. `true` uses the defaults; pass an
   * object for the storage key, version or backend. Off by default.
   *
   * Only the strip comes back — titles, order, groups, collapsed state — never
   * the pages, which are kept-alive React subtrees and cannot be serialised.
   * Restored tabs carry `restored: true` until opened.
   */
  persist?: boolean | PersistOptions
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
  persist,
  keepAlive = true,
  children,
}: WorkspaceProviderProps) {
  const inner = (
    <CoreWorkspaceProvider
      adapter={tanstackRouterAdapter}
      options={options}
      registry={registry}
      persist={persist}
    >
      {children}
    </CoreWorkspaceProvider>
  )

  return keepAlive ? <KeepAliveProvider>{inner}</KeepAliveProvider> : inner
}
