import { describe, it, expect } from "vitest"

import { createWorkspaceTabsStore } from "./store"
import { attachPersistence, writeSnapshot } from "./persistence"
import { buildStrip } from "./groups"
import type { StorageLike } from "./persistence"

/**
 * Audit: every route by which a group can come into existence, change, or be
 * released — plus whether a group's identity, membership and *position* survive
 * a reload.
 *
 * A group has no storage of its own beyond the store: it exists only while at
 * least one tab points at it. So "what the group was and where it stood" has to
 * be reconstructable from the persisted strip alone, or it is lost.
 */

const tab = (pathname: string) => ({
  pathname,
  href: pathname,
  title: pathname,
})

function seed(paths: string[]) {
  const store = createWorkspaceTabsStore({ pinnedPath: "/", maxTabs: 20 })
  for (const p of paths) store.getState().openTab(tab(p))
  return store
}

const paths = (s: ReturnType<typeof seed>) =>
  s.getState().tabs.map((t) => t.pathname)

const groupIds = (s: ReturnType<typeof seed>) =>
  s.getState().groups.map((g) => g.id)

function fakeStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } satisfies StorageLike & { map: Map<string, string> }
}

describe("group lifecycle: creating and grouping", () => {
  it("groups tabs that were already open", () => {
    const s = seed(["/a", "/b", "/c"])
    const id = s.getState().createGroup({ title: "Pipeline", pathnames: ["/a", "/c"] })

    expect(groupIds(s)).toEqual([id])
    expect(s.getState().tabs.filter((t) => t.groupId === id).map((t) => t.pathname))
      .toEqual(["/a", "/c"])
  })

  it("pulls a grouped tab next to its siblings so the run stays contiguous", () => {
    const s = seed(["/a", "/b", "/c"])
    const id = s.getState().createGroup({ title: "G", pathnames: ["/a"] })
    s.getState().addTabToGroup("/c", id)

    // /c moves up beside /a rather than leaving the group split around /b.
    expect(paths(s)).toEqual(["/", "/a", "/c", "/b"])
  })

  it("adding a tab to a second group moves it, it never belongs to two", () => {
    const s = seed(["/a", "/b"])
    const g1 = s.getState().createGroup({ title: "One", pathnames: ["/a", "/b"] })
    const g2 = s.getState().createGroup({ title: "Two" })

    s.getState().addTabToGroup("/b", g2)
    expect(s.getState().tabs.find((t) => t.pathname === "/b")?.groupId).toBe(g2)
    expect(s.getState().tabs.filter((t) => t.groupId === g1).map((t) => t.pathname))
      .toEqual(["/a"])
  })
})

describe("group lifecycle: every way a group is released", () => {
  it("1. ungroup — group gone, tabs survive and go loose", () => {
    const s = seed(["/a", "/b"])
    const id = s.getState().createGroup({ pathnames: ["/a", "/b"] })

    expect(s.getState().deleteGroup(id)).toBeNull()
    expect(groupIds(s)).toEqual([])
    expect(paths(s)).toEqual(["/", "/a", "/b"])
    expect(s.getState().tabs.every((t) => (t.groupId ?? null) === null)).toBe(true)
  })

  it("2. closing one of several members — group survives", () => {
    const s = seed(["/a", "/b"])
    const id = s.getState().createGroup({ pathnames: ["/a", "/b"] })

    s.getState().closeTab("/a")
    expect(groupIds(s)).toEqual([id])
    expect(s.getState().tabs.filter((t) => t.groupId === id)).toHaveLength(1)
  })

  it("3. closing the LAST member — group is released automatically", () => {
    const s = seed(["/a", "/b"])
    const id = s.getState().createGroup({ pathnames: ["/a"] })

    s.getState().closeTab("/a")
    expect(groupIds(s)).toEqual([])
    expect(id).toBeTruthy()
    // The other tab is untouched.
    expect(paths(s)).toEqual(["/", "/b"])
  })

  it("4. delete with closeTabs — group and its tabs both go", () => {
    const s = seed(["/a", "/b", "/c"])
    const id = s.getState().createGroup({ pathnames: ["/a", "/b"] })

    const next = s.getState().deleteGroup(id, { closeTabs: true })
    expect(groupIds(s)).toEqual([])
    expect(paths(s)).toEqual(["/", "/c"])
    expect(next).toBe("/")
  })

  it("5. closeAllTabs — every group is released with its tabs", () => {
    const s = seed(["/a", "/b", "/c"])
    s.getState().createGroup({ title: "One", pathnames: ["/a"] })
    s.getState().createGroup({ title: "Two", pathnames: ["/b", "/c"] })
    expect(groupIds(s)).toHaveLength(2)

    const next = s.getState().closeAllTabs()
    expect(groupIds(s)).toEqual([])
    expect(paths(s)).toEqual(["/"])
    expect(next).toBe("/")
  })

  it("6. moving the last member out — group is released", () => {
    const s = seed(["/a"])
    s.getState().createGroup({ pathnames: ["/a"] })

    s.getState().removeTabFromGroup("/a")
    expect(groupIds(s)).toEqual([])
    expect(paths(s)).toEqual(["/", "/a"])
  })

  it("a group deliberately created empty is NOT auto-released", () => {
    const s = seed(["/a"])
    const id = s.getState().createGroup({ title: "Staging" })

    // Nothing was closed into emptiness, so this is a user-made container
    // waiting for tabs — only an explicit delete removes it.
    expect(groupIds(s)).toEqual([id])
    s.getState().deleteGroup(id)
    expect(groupIds(s)).toEqual([])
  })

  it("releasing a group never disturbs other groups", () => {
    const s = seed(["/a", "/b", "/c"])
    const keep = s.getState().createGroup({ title: "Keep", pathnames: ["/a"] })
    const drop = s.getState().createGroup({ title: "Drop", pathnames: ["/b"] })

    s.getState().closeTab("/b")
    expect(groupIds(s)).toEqual([keep])
    expect(drop).toBeTruthy()
    expect(s.getState().tabs.find((t) => t.pathname === "/a")?.groupId).toBe(keep)
  })
})

describe("what the group was, and where it stood", () => {
  it("survives a reload with identity, title, colour, collapsed state and members", () => {
    const storage = fakeStorage()
    const first = seed(["/leads/1", "/leads/2", "/reports"])
    const detach = attachPersistence(first, { storage, key: "k", debounceMs: 0 })

    const id = first.getState().createGroup({
      title: "Pipeline",
      color: "#f97316",
      pathnames: ["/leads/1", "/leads/2"],
    })
    first.getState().collapseGroup(id)
    detach()

    // Reload.
    const second = createWorkspaceTabsStore({ pinnedPath: "/" })
    attachPersistence(second, { storage, key: "k", debounceMs: 0 })

    expect(second.getState().groups).toEqual([
      { id, title: "Pipeline", color: "#f97316", collapsed: true },
    ])
    expect(
      second.getState().tabs.filter((t) => t.groupId === id).map((t) => t.pathname),
    ).toEqual(["/leads/1", "/leads/2"])
  })

  it("keeps where it stood — the group's position in the strip", () => {
    const storage = fakeStorage()
    const first = seed(["/a", "/b", "/c", "/d"])
    const detach = attachPersistence(first, { storage, key: "k", debounceMs: 0 })
    // Group the middle two, so the group sits between /a and /d.
    first.getState().createGroup({ title: "Middle", pathnames: ["/b", "/c"] })
    const before = first.getState().tabs.map((t) => t.pathname)
    detach()

    const second = createWorkspaceTabsStore({ pinnedPath: "/" })
    attachPersistence(second, { storage, key: "k", debounceMs: 0 })

    expect(second.getState().tabs.map((t) => t.pathname)).toEqual(before)

    // And the rendered strip has the same shape: loose, group, loose.
    const strip = buildStrip(second.getState().tabs, second.getState().groups)
    expect(strip.map((s) => s.kind)).toEqual(["tab", "tab", "group", "tab"])
    const group = strip[2]
    if (group?.kind !== "group") throw new Error("expected a group segment")
    expect(group.tabs.map((t) => t.pathname)).toEqual(["/b", "/c"])
  })

  it("a group released before the reload does not come back", () => {
    const storage = fakeStorage()
    const first = seed(["/a"])
    const detach = attachPersistence(first, { storage, key: "k", debounceMs: 0 })
    const id = first.getState().createGroup({ title: "Temp", pathnames: ["/a"] })
    first.getState().deleteGroup(id)
    detach()

    const second = createWorkspaceTabsStore({ pinnedPath: "/" })
    attachPersistence(second, { storage, key: "k", debounceMs: 0 })

    expect(second.getState().groups).toEqual([])
    expect(second.getState().tabs.find((t) => t.pathname === "/a")?.groupId).toBeNull()
  })

  it("a tab whose group vanished from storage comes back loose, not dangling", () => {
    const storage = fakeStorage()
    // Hand-written snapshot: the tab references a group the payload doesn't have.
    writeSnapshot(
      { version: 1, tabs: [{ ...tab("/a"), groupId: "ghost" }], groups: [] },
      { storage, key: "k" },
    )

    const store = createWorkspaceTabsStore({ pinnedPath: "/" })
    attachPersistence(store, { storage, key: "k", debounceMs: 0 })

    expect(store.getState().tabs.find((t) => t.pathname === "/a")?.groupId).toBeNull()
    expect(buildStrip(store.getState().tabs, store.getState().groups)
      .every((s) => s.kind === "tab")).toBe(true)
  })
})
