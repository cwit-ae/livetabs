import type { ReactNode } from "react"

import { useWorkspaceTabs } from "../provider"
import { useAdapter, useNoopDestroyPage } from "../adapter"
import { useAutoOpenTab } from "../hooks/use-auto-open-tab"
import type { WorkspaceTab } from "../store"
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
}

export type WorkspaceTabBarProps = {
  /** Map a tab's `iconKey` to a node (your icon set). */
  renderIcon?: (iconKey: string | undefined, tab: WorkspaceTab) => ReactNode
  /** Custom close glyph. Defaults to a small ✕. */
  renderClose?: () => ReactNode
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
 * the kept-alive subtree when the adapter supports it), and ships the scroll /
 * edge-fade / wheel behaviour. Navigation comes from the router adapter, so
 * the same bar works across routers.
 */
export function WorkspaceTabBar({
  renderIcon,
  renderClose,
  leftSlot,
  rightSlot,
  classNames,
  className,
  autoOpen = true,
  destroyOnClose = true,
}: WorkspaceTabBarProps) {
  const { tabs, closeTab } = useWorkspaceTabs()
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

  return (
    <div className={cx("live-tabs-bar", className, classNames?.root)}>
      {leftSlot}
      <TabStrip activeKey={pathname} className={classNames?.strip}>
        {tabs.map((tab) => {
          const isActive = tab.pathname === pathname
          return (
            <Tab
              key={tab.pathname}
              active={isActive}
              pinned={tab.pinned}
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
        })}
      </TabStrip>
      {rightSlot}
    </div>
  )
}
