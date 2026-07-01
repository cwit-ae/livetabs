import { useEffect } from "react"

import { useAdapter } from "../adapter"
import { useWorkspaceContext } from "../provider"

/**
 * Open (or refresh) a tab for the current route on every navigation. Resolves
 * the title/icon from the registry; the tab's `href` tracks the full URL so
 * clicking it later restores exactly where you were.
 *
 * `<WorkspaceTabBar autoOpen>` calls this for you.
 */
export function useAutoOpenTab(enabled = true): void {
  const { store, registry } = useWorkspaceContext()
  const adapter = useAdapter()
  const openTab = store((s) => s.openTab)
  const { pathname, href } = adapter.useLocation()

  useEffect(() => {
    if (!enabled) return
    const meta = registry?.resolve(pathname) ?? { title: pathname }
    openTab({
      pathname,
      href: href || pathname,
      title: meta.title,
      iconKey: meta.iconKey,
    })
  }, [enabled, pathname, href, openTab, registry])
}
