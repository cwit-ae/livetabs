import { create } from "zustand"

import { nextGroupId, normalizeTabs } from "./groups"
import type { TabGroup } from "./groups"

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
  /** Owning group, or null/undefined when loose. Pinned tabs are never grouped. */
  groupId?: string | null
  /**
   * True for a tab rebuilt from a persisted session that hasn't been visited
   * yet this run. Its page is *not* alive — nothing was restored but the entry
   * in the bar — so surface it differently if you like. Cleared the first time
   * the tab is opened.
   */
  restored?: boolean
}

export type WorkspaceSnapshot = {
  version: number
  tabs: WorkspaceTab[]
  groups: TabGroup[]
}

export type WorkspaceTabsState = {
  tabs: WorkspaceTab[]
  groups: TabGroup[]
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

  // Groups ────────────────────────────────────────────────────────────────
  /** Create a group, optionally moving tabs into it. Returns its id. */
  createGroup: (input?: {
    title?: string
    color?: string
    collapsed?: boolean
    pathnames?: string[]
  }) => string
  renameGroup: (groupId: string, title: string) => void
  setGroupColor: (groupId: string, color: string | undefined) => void
  /**
   * Collapse a group, hiding its tabs from the strip. Returns the pathname to
   * navigate to if the caller is currently showing a tab inside the group — a
   * collapsed group must not hold the active tab — else `null`.
   */
  collapseGroup: (groupId: string) => string | null
  expandGroup: (groupId: string) => void
  /** Collapse/expand. Returns the same fallback pathname as `collapseGroup`. */
  toggleGroup: (groupId: string) => string | null
  /**
   * Delete a group. By default its tabs survive and become loose; pass
   * `closeTabs` to close them too, in which case the pathname to navigate to
   * is returned, as `closeTab` does.
   */
  deleteGroup: (
    groupId: string,
    options?: { closeTabs?: boolean },
  ) => string | null
  /** Move a tab into a group. Pinned tabs are ignored. */
  addTabToGroup: (pathname: string, groupId: string) => void
  /** Make a tab loose again. */
  removeTabFromGroup: (pathname: string) => void

  /** Replace tabs/groups from a persisted snapshot. */
  hydrate: (snapshot: WorkspaceSnapshot) => void
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
 * Drop groups that had members before but none after. Chrome does this too.
 *
 * Returns the *same array* when nothing is dropped: every tab open and close
 * runs this, and handing back a fresh array each time would re-render every
 * subscriber of `groups` on every navigation.
 */
function pruneEmptiedGroups(
  groups: TabGroup[],
  before: WorkspaceTab[],
  after: WorkspaceTab[],
): TabGroup[] {
  if (groups.length === 0) return groups
  const had = new Set(before.map((t) => t.groupId).filter(Boolean) as string[])
  const has = new Set(after.map((t) => t.groupId).filter(Boolean) as string[])
  const next = groups.filter((g) => !(had.has(g.id) && !has.has(g.id)))
  return next.length === groups.length ? groups : next
}

/**
 * Create a workspace-tabs store. Returns a Zustand hook you can call with a
 * selector (`useStore(s => s.tabs)`), or read imperatively via
 * `useStore.getState()`.
 *
 * Nothing here is persisted by default: the kept-alive React subtrees don't
 * survive a reload, so persisting metadata silently would lie about what's
 * actually live. Opt in with `attachPersistence`, which restores only the
 * *strip* and flags every rebuilt tab as `restored`, keeping the difference
 * visible.
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
    groups: [],

    openTab: (tab) => {
      set((state) => {
        const existing = state.tabs.find((t) => t.pathname === tab.pathname)
        if (existing) {
          const titleUpgrade =
            !!tab.title &&
            tab.title !== existing.title &&
            isFallbackTitle(existing.title, existing.pathname)
          const hrefChanged = !!tab.href && tab.href !== existing.href
          // Visiting a restored tab makes it live again.
          const wasRestored = existing.restored === true
          if (titleUpgrade || hrefChanged || wasRestored) {
            return {
              tabs: state.tabs.map((t) =>
                t.pathname === tab.pathname
                  ? {
                      ...t,
                      title: titleUpgrade ? tab.title : t.title,
                      iconKey: tab.iconKey ?? t.iconKey,
                      href: hrefChanged ? tab.href : t.href,
                      restored: false,
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

        return {
          tabs: normalizeTabs(next),
          groups: pruneEmptiedGroups(state.groups, state.tabs, next),
        }
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
      const { tabs, groups } = get()
      const idx = tabs.findIndex((t) => t.pathname === pathname)
      if (idx === -1) return null
      if (tabs[idx]!.pinned) return null

      // Removing one element from a normalized list keeps it normalized.
      const next = [...tabs.slice(0, idx), ...tabs.slice(idx + 1)]
      set({ tabs: next, groups: pruneEmptiedGroups(groups, tabs, next) })

      return next[idx - 1]?.pathname ?? next[idx]?.pathname ?? pinnedPath
    },

    closeAllTabs: () => {
      const { tabs, groups } = get()
      const pinned = tabs.filter((t) => t.pinned)
      if (pinned.length === tabs.length) return null
      set({ tabs: pinned, groups: pruneEmptiedGroups(groups, tabs, pinned) })
      return pinned[0]?.pathname ?? pinnedPath
    },

    createGroup: (input = {}) => {
      const id = nextGroupId()
      const group: TabGroup = {
        id,
        title: input.title ?? "Group",
        color: input.color,
        collapsed: input.collapsed ?? false,
      }
      const members = new Set(input.pathnames ?? [])
      set((state) => ({
        groups: [...state.groups, group],
        tabs: normalizeTabs(
          state.tabs.map((t) =>
            members.has(t.pathname) && !t.pinned ? { ...t, groupId: id } : t,
          ),
        ),
      }))
      return id
    },

    renameGroup: (groupId, title) => {
      if (!title) return
      set((state) => ({
        groups: state.groups.map((g) =>
          g.id === groupId ? { ...g, title } : g,
        ),
      }))
    },

    setGroupColor: (groupId, color) => {
      set((state) => ({
        groups: state.groups.map((g) =>
          g.id === groupId ? { ...g, color } : g,
        ),
      }))
    },

    collapseGroup: (groupId) => {
      const { tabs, groups } = get()
      if (!groups.some((g) => g.id === groupId)) return null
      set({
        groups: groups.map((g) =>
          g.id === groupId ? { ...g, collapsed: true } : g,
        ),
      })
      // A collapsed group must not hold the active tab; hand the caller the
      // nearest tab outside it.
      const outside = tabs.filter((t) => t.groupId !== groupId)
      return outside[outside.length - 1]?.pathname ?? pinnedPath
    },

    expandGroup: (groupId) => {
      set((state) => ({
        groups: state.groups.map((g) =>
          g.id === groupId ? { ...g, collapsed: false } : g,
        ),
      }))
    },

    toggleGroup: (groupId) => {
      const group = get().groups.find((g) => g.id === groupId)
      if (!group) return null
      if (group.collapsed) {
        get().expandGroup(groupId)
        return null
      }
      return get().collapseGroup(groupId)
    },

    deleteGroup: (groupId, deleteOptions) => {
      const { tabs, groups } = get()
      if (!groups.some((g) => g.id === groupId)) return null
      const remainingGroups = groups.filter((g) => g.id !== groupId)

      if (!deleteOptions?.closeTabs) {
        set({
          groups: remainingGroups,
          tabs: normalizeTabs(
            tabs.map((t) =>
              t.groupId === groupId ? { ...t, groupId: null } : t,
            ),
          ),
        })
        return null
      }

      const firstIdx = tabs.findIndex((t) => t.groupId === groupId)
      const next = tabs.filter((t) => t.groupId !== groupId || t.pinned)
      set({ groups: remainingGroups, tabs: next })
      if (firstIdx === -1) return null
      return (
        next[firstIdx - 1]?.pathname ?? next[firstIdx]?.pathname ?? pinnedPath
      )
    },

    addTabToGroup: (pathname, groupId) => {
      set((state) => {
        if (!state.groups.some((g) => g.id === groupId)) return state
        const tab = state.tabs.find((t) => t.pathname === pathname)
        if (!tab || tab.pinned || tab.groupId === groupId) return state
        return {
          tabs: normalizeTabs(
            state.tabs.map((t) =>
              t.pathname === pathname ? { ...t, groupId } : t,
            ),
          ),
        }
      })
    },

    removeTabFromGroup: (pathname) => {
      set((state) => {
        const tab = state.tabs.find((t) => t.pathname === pathname)
        if (!tab || (tab.groupId ?? null) === null) return state
        const next = state.tabs.map((t) =>
          t.pathname === pathname ? { ...t, groupId: null } : t,
        )
        return {
          tabs: normalizeTabs(next),
          groups: pruneEmptiedGroups(state.groups, state.tabs, next),
        }
      })
    },

    hydrate: (snapshot) => {
      const liveGroupIds = new Set(snapshot.groups.map((g) => g.id))
      const restored = snapshot.tabs
        .filter((t) => t.pathname !== pinnedPath)
        .map((t) => ({
          ...t,
          pinned: false,
          restored: true,
          groupId: t.groupId && liveGroupIds.has(t.groupId) ? t.groupId : null,
        }))
      set({
        tabs: normalizeTabs([root, ...restored]),
        groups: snapshot.groups,
      })
    },
  }))
}

export type WorkspaceTabsStore = ReturnType<typeof createWorkspaceTabsStore>
