import type { CSSProperties, ReactNode } from "react"

import { useWorkspaceGroups, useWorkspaceStrip, useWorkspaceTabs } from "../provider"
import { useAdapter, useNoopDestroyPage } from "../adapter"
import { useAutoOpenTab } from "../hooks/use-auto-open-tab"
import type { WorkspaceTab } from "../store"
import type { TabGroup } from "../groups"
import { TabStrip } from "./tab-strip"
import { Tab } from "./tab"
import { TabClose } from "./tab-close"
import { cx } from "./util"

export type WorkspaceTabBarClassNames = {
  root?: string
  strip?: string
  tab?: string
  /** Applied to the active tab in addition to `tab`. */
  tabActive?: string
  icon?: string
  title?: string
  close?: string
  /** Wrapper around a group chip and its tabs. */
  group?: string
  /** The clickable group header. */
  groupChip?: string
  groupTitle?: string
  /** Member count, shown while the group is collapsed. */
  groupCount?: string
  groupDelete?: string
}

/** What `renderGroup` gets to build a custom group header with. */
export type GroupRenderContext = {
  tabs: WorkspaceTab[]
  collapsed: boolean
  /** Collapse/expand, navigating away first if the group holds the active tab. */
  toggle: () => void
  /** Dissolve the group. Its tabs survive and become loose. */
  remove: () => void
  /** Dissolve the group and close every tab in it. */
  removeWithTabs: () => void
}

export type WorkspaceTabBarProps = {
  /** Map a tab's `iconKey` to a node (your icon set). */
  renderIcon?: (iconKey: string | undefined, tab: WorkspaceTab) => ReactNode
  /** Custom close glyph. Defaults to a small ✕. */
  renderClose?: () => ReactNode
  /** Replace the default group header entirely. */
  renderGroup?: (group: TabGroup, context: GroupRenderContext) => ReactNode
  /** Content rendered left of the strip (sidebar toggle, divider…). */
  leftSlot?: ReactNode
  /** Content rendered right of the strip (search, notifications…). */
  rightSlot?: ReactNode
  classNames?: WorkspaceTabBarClassNames
  className?: string
  /** Auto-open a tab for the current route (default `true`). */
  autoOpen?: boolean
  /** Tear down a page's kept-alive subtree when its tab closes (default `true`). */
  destroyOnClose?: boolean
  /** Show a ✕ on group chips that dissolves the group (default `true`). */
  groupsDeletable?: boolean
  /**
   * How tabs are sized.
   *
   * - `"auto"` (default) — each tab is as wide as its title, up to
   *   `--live-tabs-tab-max`. Widths differ from tab to tab.
   * - `"equal"` — browser behaviour: every tab takes the same share of the
   *   rail and they shrink together as more open, down to
   *   `--live-tabs-tab-min`, after which the strip scrolls. Pinned tabs keep
   *   their natural width and the rest divide what's left; a group claims one
   *   share per member so grouped tabs line up with loose ones.
   *
   * Requires the shipped `styles.css`. Rendered as `data-tab-width` on the
   * bar, so a custom stylesheet can key off it too.
   */
  tabWidth?: "auto" | "equal"
}

function CloseGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M3 3l6 6M9 3l-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Batteries-included tab bar. Auto-opens tabs on navigation, restores each
 * tab's last URL on click, supports middle-click / ✕ close (which also frees
 * the kept-alive subtree when the adapter supports it), renders tab groups
 * with collapse/expand, and ships the scroll / edge-fade / wheel behaviour.
 * Navigation comes from the router adapter, so the same bar works across
 * routers.
 */
export function WorkspaceTabBar({
  renderIcon,
  renderClose,
  renderGroup,
  leftSlot,
  rightSlot,
  classNames,
  className,
  autoOpen = true,
  destroyOnClose = true,
  groupsDeletable = true,
  tabWidth = "auto",
}: WorkspaceTabBarProps) {
  const { closeTab } = useWorkspaceTabs()
  const { toggleGroup, deleteGroup } = useWorkspaceGroups()
  const segments = useWorkspaceStrip()
  const adapter = useAdapter()
  const navigate = adapter.useNavigate()
  const { pathname } = adapter.useLocation()
  // Stable selection: adapter identity is constant, so the chosen hook is too.
  const useDestroyPage = adapter.useDestroyPage ?? useNoopDestroyPage
  const destroy = useDestroyPage()
  const Link = adapter.Link

  useAutoOpenTab(autoOpen)

  const handleClose = (p: string, isActive: boolean) => {
    if (destroyOnClose) destroy(p)
    const next = closeTab(p)
    if (isActive && next) navigate(next)
  }

  /**
   * Collapsing hides the group's tabs, so it must not keep the active one.
   * Whether the active tab is inside is decided *before* the toggle, since
   * the store has no notion of "active" — that lives in the router.
   */
  const handleToggleGroup = (group: TabGroup, groupTabs: WorkspaceTab[]) => {
    const holdsActive = groupTabs.some((t) => t.pathname === pathname)
    const next = toggleGroup(group.id)
    if (holdsActive && next) navigate(next)
  }

  const handleDeleteGroupTabs = (group: TabGroup, groupTabs: WorkspaceTab[]) => {
    const holdsActive = groupTabs.some((t) => t.pathname === pathname)
    if (destroyOnClose) for (const t of groupTabs) destroy(t.pathname)
    const next = deleteGroup(group.id, { closeTabs: true })
    if (holdsActive && next) navigate(next)
  }

  const renderTab = (tab: WorkspaceTab) => {
    const isActive = tab.pathname === pathname
    return (
      <Tab
        key={tab.pathname}
        active={isActive}
        pinned={tab.pinned}
        data-restored={tab.restored ? "true" : undefined}
        onMiddleClick={
          tab.pinned ? undefined : () => handleClose(tab.pathname, isActive)
        }
        className={cx(classNames?.tab, isActive && classNames?.tabActive)}
        render={<Link to={tab.href} />}
      >
        {renderIcon && (
          <span
            className={cx("live-tabs-tab-icon", classNames?.icon)}
            aria-hidden
          >
            {renderIcon(tab.iconKey, tab)}
          </span>
        )}
        <span className={cx("live-tabs-tab-title", classNames?.title)}>
          {tab.title}
        </span>
        {!tab.pinned && (
          <TabClose
            className={classNames?.close}
            label={`Close ${tab.title}`}
            onClose={() => handleClose(tab.pathname, isActive)}
          >
            {renderClose ? renderClose() : <CloseGlyph />}
          </TabClose>
        )}
      </Tab>
    )
  }

  return (
    <div
      className={cx("live-tabs-bar", className, classNames?.root)}
      data-tab-width={tabWidth}
    >
      {leftSlot}
      <TabStrip activeKey={pathname} className={classNames?.strip}>
        {segments.map((segment) => {
          if (segment.kind === "tab") return renderTab(segment.tab)

          const { group, tabs: groupTabs } = segment
          const context: GroupRenderContext = {
            tabs: groupTabs,
            collapsed: group.collapsed,
            toggle: () => handleToggleGroup(group, groupTabs),
            remove: () => deleteGroup(group.id),
            removeWithTabs: () => handleDeleteGroupTabs(group, groupTabs),
          }

          return (
            <div
              key={group.id}
              className={cx("live-tabs-group", classNames?.group)}
              data-collapsed={group.collapsed ? "true" : "false"}
              style={
                {
                  // One flex share per member, so a group's tabs end up the
                  // same width as loose ones in `equal` mode.
                  "--live-tabs-group-members": groupTabs.length,
                  ...(group.color
                    ? { "--live-tabs-group-color": group.color }
                    : {}),
                } as CSSProperties
              }
            >
              {renderGroup ? (
                renderGroup(group, context)
              ) : (
                <div className={cx("live-tabs-group-chip", classNames?.groupChip)}>
                  <button
                    type="button"
                    className={cx(
                      "live-tabs-group-toggle",
                      classNames?.groupTitle,
                    )}
                    aria-expanded={!group.collapsed}
                    aria-label={`${group.collapsed ? "Expand" : "Collapse"} ${group.title}`}
                    onClick={context.toggle}
                  >
                    <span className="live-tabs-group-dot" aria-hidden />
                    {group.title}
                    {group.collapsed && (
                      <span
                        className={cx(
                          "live-tabs-group-count",
                          classNames?.groupCount,
                        )}
                      >
                        {groupTabs.length}
                      </span>
                    )}
                  </button>
                  {groupsDeletable && (
                    <button
                      type="button"
                      className={cx(
                        "live-tabs-group-delete",
                        classNames?.groupDelete,
                      )}
                      aria-label={`Ungroup ${group.title}`}
                      title={`Ungroup ${group.title}`}
                      onClick={context.remove}
                    >
                      <CloseGlyph />
                    </button>
                  )}
                </div>
              )}
              {!group.collapsed && groupTabs.map(renderTab)}
            </div>
          )
        })}
      </TabStrip>
      {rightSlot}
    </div>
  )
}
