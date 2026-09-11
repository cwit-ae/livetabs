import type { WorkspaceTab } from "./store"

/**
 * A named container for tabs in the strip. Groups are session UI state: they
 * carry no routing meaning, and a tab belongs to at most one.
 */
export type TabGroup = {
  id: string
  title: string
  /** Free-form — the bar sets it as `--live-tabs-group-color`. */
  color?: string
  collapsed: boolean
}

let groupCounter = 0

export function nextGroupId(): string {
  groupCounter += 1
  return `ltg_${groupCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** A tab's effective group. Pinned tabs are never grouped. */
export function groupIdOf(tab: WorkspaceTab): string | null {
  return tab.pinned ? null : (tab.groupId ?? null)
}

/**
 * Enforce the strip's two ordering invariants:
 *   1. pinned tabs come first
 *   2. each group's tabs occupy one contiguous run, positioned where that
 *      group's first member already sat
 *
 * Relative order is otherwise preserved, so this is safe to run after every
 * mutation — grouping a tab pulls it to its group rather than reshuffling the
 * bar under the user.
 */
export function normalizeTabs(tabs: WorkspaceTab[]): WorkspaceTab[] {
  const ordered = [
    ...tabs.filter((t) => t.pinned),
    ...tabs.filter((t) => !t.pinned),
  ]
  const result: WorkspaceTab[] = []
  const flushed = new Set<string>()

  for (const tab of ordered) {
    const groupId = groupIdOf(tab)
    if (groupId === null) {
      result.push(tab)
      continue
    }
    if (flushed.has(groupId)) continue
    flushed.add(groupId)
    for (const member of ordered) {
      if (groupIdOf(member) === groupId) result.push(member)
    }
  }

  return result
}

/** One run of the tab strip: a loose tab, or a group and its members. */
export type StripSegment =
  | { kind: "tab"; tab: WorkspaceTab }
  | { kind: "group"; group: TabGroup; tabs: WorkspaceTab[] }

/**
 * Chunk the flat tab list into what a bar actually renders. Tabs whose group
 * no longer exists degrade to loose tabs rather than vanishing.
 *
 * Use this to build a custom bar out of the headless primitives; the
 * batteries-included `<WorkspaceTabBar />` renders exactly these segments.
 */
export function buildStrip(
  tabs: WorkspaceTab[],
  groups: TabGroup[],
): StripSegment[] {
  const byId = new Map(groups.map((g) => [g.id, g]))
  const segments: StripSegment[] = []
  let current: { kind: "group"; group: TabGroup; tabs: WorkspaceTab[] } | null =
    null

  for (const tab of tabs) {
    const groupId = groupIdOf(tab)
    const group = groupId === null ? undefined : byId.get(groupId)
    if (!group) {
      current = null
      segments.push({ kind: "tab", tab })
      continue
    }
    if (!current || current.group.id !== group.id) {
      current = { kind: "group", group, tabs: [] }
      segments.push(current)
    }
    current.tabs.push(tab)
  }

  return segments
}

/** Tabs hidden from the strip because their group is collapsed. */
export function isHiddenByCollapse(
  tab: WorkspaceTab,
  groups: TabGroup[],
): boolean {
  const groupId = groupIdOf(tab)
  if (groupId === null) return false
  return groups.find((g) => g.id === groupId)?.collapsed ?? false
}
