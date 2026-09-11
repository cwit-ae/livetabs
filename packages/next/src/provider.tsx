import { Suspense } from "react"
import type { ReactNode } from "react"
import { WorkspaceProvider as CoreWorkspaceProvider } from "@live-tabs/core"
import type { PersistOptions, WorkspaceTabsOptions } from "@live-tabs/core"

import { nextRouterAdapter } from "./adapter"
import { KeepAliveProvider } from "./keepalive/keep-alive-context"
import { WorkspaceRoutesProvider } from "./routes-context"
import type { WorkspaceRoutes } from "./routes"

export type WorkspaceProviderProps = {
  /** Route table from `createWorkspaceRoutes` — what opens as a tab. */
  routes: WorkspaceRoutes
  /** Store config — pinned root path, max tabs, etc. */
  options?: WorkspaceTabsOptions
  /**
   * Restore the tab strip across reloads. `true` uses the defaults; pass an
   * object for the storage key, version or backend.
   *
   * Only the strip comes back — titles, order, groups, collapsed state — never
   * the pages, which are React subtrees and cannot be serialised. Restored
   * tabs carry `restored: true` until opened.
   */
  persist?: boolean | PersistOptions
  children: ReactNode
}

/**
 * Next-bound workspace provider: route table, keep-alive registry, tabs store
 * and the Next router adapter, pre-wired.
 *
 * The internal `<Suspense>` exists so consumers never have to add one: the
 * adapter and outlet read `useSearchParams()`, which Next requires to sit
 * under a boundary when a page is statically prerendered.
 */
export function WorkspaceProvider({
  routes,
  options,
  persist,
  children,
}: WorkspaceProviderProps) {
  return (
    <WorkspaceRoutesProvider value={routes}>
      <KeepAliveProvider>
        <Suspense fallback={null}>
          <CoreWorkspaceProvider
            adapter={nextRouterAdapter}
            options={options}
            registry={routes.registry}
            persist={persist}
          >
            {children}
          </CoreWorkspaceProvider>
        </Suspense>
      </KeepAliveProvider>
    </WorkspaceRoutesProvider>
  )
}
