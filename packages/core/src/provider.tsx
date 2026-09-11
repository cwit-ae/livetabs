import { createContext, useContext, useEffect, useMemo, useRef } from "react"
import type { ReactNode } from "react"

import { createWorkspaceTabsStore } from "./store"
import type { WorkspaceTabsOptions, WorkspaceTabsStore } from "./store"
import { attachPersistence } from "./persistence"
import type { PersistOptions } from "./persistence"
import { buildStrip } from "./groups"
import type { StripSegment } from "./groups"
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
  /**
   * Restore the tab strip across reloads. `true` uses the defaults; pass an
   * object to set the storage key, version or backend.
   *
   * Only the strip is restored — titles, order, groups, collapsed state — not
   * the pages, which are React subtrees and cannot be serialised. Restored
   * tabs carry `restored: true` until opened, so the bar can say so rather
   * than implying state came back with them.
   */
  persist?: boolean | PersistOptions
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
  persist,
  children,
}: WorkspaceProviderProps) {
  const storeRef = useRef<WorkspaceTabsStore | undefined>(undefined)
  if (!storeRef.current) storeRef.current = createWorkspaceTabsStore(options)

  const persistConfig: PersistOptions | null =
    persist === true ? {} : persist ? persist : null

  // Re-attaching re-hydrates, which would stamp a saved strip over the live
  // one — so depend on the few primitives that genuinely change the target,
  // and read the rest through a ref. (Notably *not* a stringified config:
  // serialising one containing `localStorage` walks its contents, so the dep
  // would change on every write.)
  const configRef = useRef(persistConfig)
  configRef.current = persistConfig

  useEffect(() => {
    if (!configRef.current) return
    return attachPersistence(storeRef.current!, configRef.current)
  }, [persistConfig !== null, persistConfig?.key, persistConfig?.version])

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
      "live-tabs: useWorkspace*/useSetTabTitle must be used within <WorkspaceProvider>",
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

/** The groups list plus every group mutator, already selected. */
export function useWorkspaceGroups() {
  const store = useWorkspaceTabsStore()
  return {
    groups: store((s) => s.groups),
    createGroup: store((s) => s.createGroup),
    renameGroup: store((s) => s.renameGroup),
    setGroupColor: store((s) => s.setGroupColor),
    collapseGroup: store((s) => s.collapseGroup),
    expandGroup: store((s) => s.expandGroup),
    toggleGroup: store((s) => s.toggleGroup),
    deleteGroup: store((s) => s.deleteGroup),
    addTabToGroup: store((s) => s.addTabToGroup),
    removeTabFromGroup: store((s) => s.removeTabFromGroup),
  }
}

/**
 * The tab strip as renderable segments: loose tabs and group runs, in bar
 * order. Build a custom bar from this plus the headless primitives.
 */
export function useWorkspaceStrip(): StripSegment[] {
  const store = useWorkspaceTabsStore()
  const tabs = store((s) => s.tabs)
  const groups = store((s) => s.groups)
  return useMemo(() => buildStrip(tabs, groups), [tabs, groups])
}
