import { createContext, useContext, useMemo, useRef } from "react"
import type { ReactNode } from "react"

import { createWorkspaceTabsStore } from "./store"
import type { WorkspaceTabsOptions, WorkspaceTabsStore } from "./store"
import type { TabRegistry } from "./registry"
import type { RouterAdapter } from "./adapter"
import { RouterAdapterProvider } from "./adapter"

type WorkspaceContextValue = {
  store: WorkspaceTabsStore
  registry: TabRegistry | null
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export type WorkspaceProviderProps = {
  /** Router binding. Router packages supply this for you. */
  adapter: RouterAdapter
  /** Store config — pinned root path, max tabs, etc. */
  options?: WorkspaceTabsOptions
  /** Path → tab-meta resolver (from `createTabRegistry`). */
  registry?: TabRegistry
  children: ReactNode
}

/**
 * Core workspace provider: creates the tabs store, exposes the registry, and
 * installs the router adapter. Router-specific packages wrap this with their
 * adapter pre-supplied (and their keep-alive provider), so app code rarely
 * uses this directly.
 */
export function WorkspaceProvider({
  adapter,
  options,
  registry,
  children,
}: WorkspaceProviderProps) {
  const storeRef = useRef<WorkspaceTabsStore | undefined>(undefined)
  if (!storeRef.current) storeRef.current = createWorkspaceTabsStore(options)

  const value = useMemo<WorkspaceContextValue>(
    () => ({ store: storeRef.current!, registry: registry ?? null }),
    [registry],
  )

  return (
    <RouterAdapterProvider value={adapter}>
      <WorkspaceContext.Provider value={value}>
        {children}
      </WorkspaceContext.Provider>
    </RouterAdapterProvider>
  )
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const v = useContext(WorkspaceContext)
  if (!v) {
    throw new Error(
      "livetabs: useWorkspace*/useSetTabTitle must be used within <WorkspaceProvider>",
    )
  }
  return v
}

/** The raw Zustand store (call with a selector, or `.getState()`). */
export function useWorkspaceTabsStore(): WorkspaceTabsStore {
  return useWorkspaceContext().store
}

/** Convenience: the tabs list plus the mutators, already selected. */
export function useWorkspaceTabs() {
  const store = useWorkspaceTabsStore()
  return {
    tabs: store((s) => s.tabs),
    openTab: store((s) => s.openTab),
    renameTab: store((s) => s.renameTab),
    closeTab: store((s) => s.closeTab),
    closeAllTabs: store((s) => s.closeAllTabs),
  }
}
