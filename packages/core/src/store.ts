import { create } from "zustand"

/**
 * One open tab. Tabs are keyed by `pathname`; `href` tracks the last full
 * URL (pathname + search + hash) the user saw on that page so clicking the
 * tab restores exactly where they were.
 */
export type WorkspaceTab = {
  /** Pathname only — no search/hash. The unique key for a tab. */
  pathname: string
  /** Full URL the tab should restore on click. Defaults to `pathname`. */
  href: string
  title: string
  /** Resolved by a tab registry. A key (not a component) so the store stays
   *  serialisable; map it to an icon at render time. */
  iconKey?: string
  /** Pinned tabs never close and are never evicted. */
  pinned?: boolean
}

export type WorkspaceTabsState = {
  tabs: WorkspaceTab[]
  /**
   * Idempotent. If the pathname is already open we upgrade its title (when a
   * better label arrives and the current one looks like a registry fallback)
   * and bump its `href` to the latest visit. Otherwise we append, evicting
   * the oldest non-pinned tab past `maxTabs`.
   */
  openTab: (tab: WorkspaceTab) => void
  /** Set a tab's title without touching anything else (live rename). */
  renameTab: (pathname: string, title: string) => void
  /**
   * Close a tab. Returns the pathname the caller should navigate to next
   * (left neighbour, then right, then the pinned root), or `null` if the tab
   * was pinned/unknown (caller stays put).
   */
  closeTab: (pathname: string) => string | null
  /**
   * Close every non-pinned tab. Returns the pinned root to land on, or `null`
   * if only pinned tabs remained.
   */
  closeAllTabs: () => string | null
}

export type WorkspaceTabsOptions = {
  /** Pathname of the always-present pinned root tab. Default `"/"`. */
  pinnedPath?: string
  /** Title/icon for the pinned root tab. Default title `"Home"`. */
  pinnedTab?: { title?: string; iconKey?: string }
  /** Max open tabs before the oldest non-pinned one is evicted. Default 12. */
  maxTabs?: number
  /**
   * Heuristic: does `currentTitle` look like a registry default for
   * `pathname`? If so, an incoming page-supplied title is allowed to replace
   * it. Default flags titles containing a `#id` marker.
   */
  isFallbackTitle?: (currentTitle: string, pathname: string) => boolean
}

function defaultIsFallbackTitle(currentTitle: string): boolean {
  return currentTitle.startsWith("#") || currentTitle.includes(" #")
}

/**
 * Create a workspace-tabs store. Returns a Zustand hook you can call with a
 * selector (`useStore(s => s.tabs)`), or read imperatively via
 * `useStore.getState()`.
 *
 * State is intentionally **not** persisted — the kept-alive React subtrees
 * don't survive a reload, so persisting just the metadata would lie about
 * what's actually live.
 */
export function createWorkspaceTabsStore(options: WorkspaceTabsOptions = {}) {
  const pinnedPath = options.pinnedPath ?? "/"
  const maxTabs = options.maxTabs ?? 12
  const isFallbackTitle = options.isFallbackTitle ?? defaultIsFallbackTitle

  const root: WorkspaceTab = {
    pathname: pinnedPath,
    href: pinnedPath,
    title: options.pinnedTab?.title ?? "Home",
    iconKey: options.pinnedTab?.iconKey,
    pinned: true,
  }

  return create<WorkspaceTabsState>((set, get) => ({
    tabs: [root],

    openTab: (tab) => {
      set((state) => {
        const existing = state.tabs.find((t) => t.pathname === tab.pathname)
        if (existing) {
          const titleUpgrade =
            !!tab.title &&
            tab.title !== existing.title &&
            isFallbackTitle(existing.title, existing.pathname)
          const hrefChanged = !!tab.href && tab.href !== existing.href
          if (titleUpgrade || hrefChanged) {
            return {
              tabs: state.tabs.map((t) =>
                t.pathname === tab.pathname
                  ? {
                      ...t,
                      title: titleUpgrade ? tab.title : t.title,
                      iconKey: tab.iconKey ?? t.iconKey,
                      href: hrefChanged ? tab.href : t.href,
                    }
                  : t,
              ),
            }
          }
          return state
        }

        const fresh: WorkspaceTab = {
          ...tab,
          href: tab.href || tab.pathname,
          pinned: tab.pathname === pinnedPath ? true : tab.pinned,
        }
        let next = [...state.tabs, fresh]

        if (next.length > maxTabs) {
          const evictIdx = next.findIndex((t) => !t.pinned)
          if (evictIdx !== -1) {
            next = [...next.slice(0, evictIdx), ...next.slice(evictIdx + 1)]
          }
        }

        return { tabs: next }
      })
    },

    renameTab: (pathname, title) => {
      if (!title) return
      set((state) => {
        const existing = state.tabs.find((t) => t.pathname === pathname)
        if (!existing || existing.title === title) return state
        return {
          tabs: state.tabs.map((t) =>
            t.pathname === pathname ? { ...t, title } : t,
          ),
        }
      })
    },

    closeTab: (pathname) => {
      const { tabs } = get()
      const idx = tabs.findIndex((t) => t.pathname === pathname)
      if (idx === -1) return null
      if (tabs[idx]!.pinned) return null

      const next = [...tabs.slice(0, idx), ...tabs.slice(idx + 1)]
      set({ tabs: next })

      return next[idx - 1]?.pathname ?? next[idx]?.pathname ?? pinnedPath
    },

    closeAllTabs: () => {
      const { tabs } = get()
      const pinned = tabs.filter((t) => t.pinned)
      if (pinned.length === tabs.length) return null
      set({ tabs: pinned })
      return pinned[0]?.pathname ?? pinnedPath
    },
  }))
}

export type WorkspaceTabsStore = ReturnType<typeof createWorkspaceTabsStore>
