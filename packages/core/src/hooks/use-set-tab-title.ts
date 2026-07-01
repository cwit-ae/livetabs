import { useEffect } from "react"

import { useAdapter } from "../adapter"
import { useWorkspaceTabsStore } from "../provider"

/**
 * Override the current page's tab title once you have a real label — e.g. a
 * detail page renaming "Customer #123" to "Acme Inc" after its data loads.
 * Pass `null`/`undefined` while loading and the registry default stays.
 *
 * Uses the adapter's *kept* pathname (frozen inside keep-alive subtrees), so a
 * background page that re-renders never renames the tab you're actually on.
 */
export function useSetTabTitle(title: string | null | undefined): void {
  const store = useWorkspaceTabsStore()
  const renameTab = store((s) => s.renameTab)
  const pathname = useAdapter().useKeptPathname()

  useEffect(() => {
    if (!title) return
    renameTab(pathname, title)
  }, [pathname, title, renameTab])
}
