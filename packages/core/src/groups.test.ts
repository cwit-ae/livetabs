import { describe, it, expect } from "vitest"

import { createWorkspaceTabsStore } from "./store"
import { buildStrip, isHiddenByCollapse, normalizeTabs } from "./groups"
import type { WorkspaceTab } from "./store"

function make() {
  return createWorkspaceTabsStore({ pinnedPath: "/", maxTabs: 20 })
}

const tab = (pathname: string) => ({
  pathname,
  href: pathname,
  title: pathname,
})

function seed(paths: string[]) {
  const store = make()
  for (const p of paths) store.getState().openTab(tab(p))
  return store
}

const paths = (store: ReturnType<typeof make>) =>
  store.getState().tabs.map((t) => t.pathname)

describe("normalizeTabs", () => {
  const t = (pathname: string, groupId?: string | null, pinned?: boolean) =>
    ({ pathname, href: pathname, title: pathname, groupId, pinned }) as WorkspaceTab

  it("leaves ungrouped order exactly as it found it", () => {
    // Order with no groups must match pre-groups behaviour byte for byte —
    // including not hoisting pinned tabs, which 0.1.0 never did.
    const out = normalizeTabs([t("/a"), t("/", null, true), t("/b")])
    expect(out.map((x) => x.pathname)).toEqual(["/a", "/", "/b"])
  })

  it("gathers a group's tabs into one run at its first member's position", () => {
    const out = normalizeTabs([
      t("/a", "g1"),
      t("/b"),
      t("/c", "g1"),
      t("/d"),
    ])
    expect(out.map((x) => x.pathname)).toEqual(["/a", "/c", "/b", "/d"])
  })

  it("keeps two groups from interleaving", () => {
    const out = normalizeTabs([
      t("/a", "g1"),
      t("/x", "g2"),
      t("/b", "g1"),
      t("/y", "g2"),
    ])
    expect(out.map((x) => x.pathname)).toEqual(["/a", "/b", "/x", "/y"])
  })

  it("never groups a pinned tab", () => {
    const out = normalizeTabs([t("/", "g1", true), t("/a", "g1")])
    expect(out.map((x) => x.pathname)).toEqual(["/", "/a"])
  })
})

describe("buildStrip", () => {
  it("splits loose tabs and group runs in bar order", () => {
    const store = seed(["/a", "/b", "/c"])
    const id = store.getState().createGroup({ title: "Leads", pathnames: ["/a", "/c"] })
    const segments = buildStrip(store.getState().tabs, store.getState().groups)

    expect(segments.map((s) => s.kind)).toEqual(["tab", "group", "tab"])
    const group = segments[1]
    if (group?.kind !== "group") throw new Error("expected a group segment")
    expect(group.group.id).toBe(id)
    expect(group.tabs.map((t) => t.pathname)).toEqual(["/a", "/c"])
  })

  it("degrades tabs of a vanished group to loose tabs", () => {
    const store = seed(["/a"])
    store.getState().createGroup({ title: "G", pathnames: ["/a"] })
    const segments = buildStrip(store.getState().tabs, [])
    expect(segments.every((s) => s.kind === "tab")).toBe(true)
  })
})

describe("group actions", () => {
  it("creates a group and moves the named tabs into it", () => {
    const store = seed(["/a", "/b"])
    const id = store.getState().createGroup({ title: "Leads", pathnames: ["/a"] })

    expect(store.getState().groups).toHaveLength(1)
    expect(store.getState().groups[0]).toMatchObject({
      id,
      title: "Leads",
      collapsed: false,
    })
    expect(store.getState().tabs.find((t) => t.pathname === "/a")?.groupId).toBe(id)
    expect(store.getState().tabs.find((t) => t.pathname === "/b")?.groupId).toBeUndefined()
  })

  it("refuses to group the pinned tab", () => {
    const store = seed(["/a"])
    const id = store.getState().createGroup({ pathnames: ["/", "/a"] })
    expect(store.getState().tabs.find((t) => t.pathname === "/")?.groupId).toBeUndefined()
    expect(store.getState().tabs.find((t) => t.pathname === "/a")?.groupId).toBe(id)
  })

  it("collapses and expands, reporting where to go when the group held focus", () => {
    const store = seed(["/a", "/b"])
    const id = store.getState().createGroup({ pathnames: ["/a"] })

    const fallback = store.getState().collapseGroup(id)
    expect(store.getState().groups[0]!.collapsed).toBe(true)
    expect(fallback).toBe("/b")

    store.getState().expandGroup(id)
    expect(store.getState().groups[0]!.collapsed).toBe(false)
  })

  it("toggles both ways", () => {
    const store = seed(["/a"])
    const id = store.getState().createGroup({ pathnames: ["/a"] })

    store.getState().toggleGroup(id)
    expect(store.getState().groups[0]!.collapsed).toBe(true)
    expect(store.getState().toggleGroup(id)).toBeNull()
    expect(store.getState().groups[0]!.collapsed).toBe(false)
  })

  it("hides collapsed members from the strip but keeps the tabs", () => {
    const store = seed(["/a", "/b"])
    const id = store.getState().createGroup({ pathnames: ["/a"] })
    store.getState().collapseGroup(id)

    const { tabs, groups } = store.getState()
    expect(tabs).toHaveLength(3)
    expect(isHiddenByCollapse(tabs.find((t) => t.pathname === "/a")!, groups)).toBe(true)
    expect(isHiddenByCollapse(tabs.find((t) => t.pathname === "/b")!, groups)).toBe(false)
  })

  it("deleting a group keeps its tabs by default", () => {
    const store = seed(["/a", "/b"])
    const id = store.getState().createGroup({ pathnames: ["/a"] })

    expect(store.getState().deleteGroup(id)).toBeNull()
    expect(store.getState().groups).toHaveLength(0)
    expect(paths(store)).toEqual(["/", "/a", "/b"])
    expect(store.getState().tabs.find((t) => t.pathname === "/a")?.groupId).toBeNull()
  })

  it("deleting a group can close its tabs too", () => {
    const store = seed(["/a", "/b", "/c"])
    const id = store.getState().createGroup({ pathnames: ["/a", "/b"] })

    const next = store.getState().deleteGroup(id, { closeTabs: true })
    expect(store.getState().groups).toHaveLength(0)
    expect(paths(store)).toEqual(["/", "/c"])
    expect(next).toBe("/")
  })

  it("moves a tab between groups and back out", () => {
    const store = seed(["/a", "/b"])
    const g1 = store.getState().createGroup({ title: "One", pathnames: ["/a"] })
    const g2 = store.getState().createGroup({ title: "Two" })

    store.getState().addTabToGroup("/b", g2)
    expect(store.getState().tabs.find((t) => t.pathname === "/b")?.groupId).toBe(g2)

    store.getState().addTabToGroup("/b", g1)
    expect(store.getState().tabs.find((t) => t.pathname === "/b")?.groupId).toBe(g1)
    // Joining a group pulls the tab next to its new siblings.
    expect(paths(store)).toEqual(["/", "/a", "/b"])

    store.getState().removeTabFromGroup("/b")
    expect(store.getState().tabs.find((t) => t.pathname === "/b")?.groupId).toBeNull()
  })

  it("renames and recolours a group", () => {
    const store = seed(["/a"])
    const id = store.getState().createGroup({ pathnames: ["/a"] })

    store.getState().renameGroup(id, "Pipeline")
    store.getState().setGroupColor(id, "#f97316")
    expect(store.getState().groups[0]).toMatchObject({
      title: "Pipeline",
      color: "#f97316",
    })
  })

  it("drops a group once its last tab is closed", () => {
    const store = seed(["/a", "/b"])
    const id = store.getState().createGroup({ pathnames: ["/a"] })

    store.getState().closeTab("/a")
    expect(store.getState().groups).toHaveLength(0)
    expect(id).toBeTruthy()
  })

  it("keeps a group alive while it still has members", () => {
    const store = seed(["/a", "/b"])
    store.getState().createGroup({ pathnames: ["/a", "/b"] })

    store.getState().closeTab("/a")
    expect(store.getState().groups).toHaveLength(1)
  })

  it("keeps an empty group created on purpose", () => {
    const store = seed(["/a"])
    store.getState().createGroup({ title: "Staging" })
    expect(store.getState().groups).toHaveLength(1)
  })

  it("does not churn the groups reference when groups are untouched", () => {
    const store = make()
    let changes = 0
    let last = store.getState().groups
    store.subscribe(() => {
      const now = store.getState().groups
      if (now !== last) {
        changes += 1
        last = now
      }
    })

    for (const p of ["/a", "/b", "/c"]) store.getState().openTab(tab(p))
    store.getState().closeTab("/a")

    // Opening and closing tabs runs the group pruner. If it handed back a new
    // array each time, every subscriber of `groups` would re-render on every
    // navigation.
    expect(changes).toBe(0)
  })

  it("still swaps the groups reference when a group really is dropped", () => {
    const store = seed(["/a"])
    store.getState().createGroup({ pathnames: ["/a"] })
    const before = store.getState().groups

    store.getState().closeTab("/a")
    expect(store.getState().groups).not.toBe(before)
    expect(store.getState().groups).toHaveLength(0)
  })

  it("ignores unknown groups and tabs", () => {
    const store = seed(["/a"])
    expect(store.getState().collapseGroup("nope")).toBeNull()
    expect(store.getState().deleteGroup("nope")).toBeNull()
    expect(store.getState().toggleGroup("nope")).toBeNull()
    store.getState().addTabToGroup("/a", "nope")
    expect(store.getState().tabs.find((t) => t.pathname === "/a")?.groupId).toBeUndefined()
  })
})
