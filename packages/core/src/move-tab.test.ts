import { describe, it, expect } from "vitest"

import { createWorkspaceTabsStore } from "./store"
import { buildStrip } from "./groups"

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

const groupOf = (s: ReturnType<typeof seed>, pathname: string) =>
  s.getState().tabs.find((t) => t.pathname === pathname)?.groupId ?? null

/** What `@dnd-kit`'s arrayMove would produce, for semantics parity. */
function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item!)
  return copy
}

describe("moveTab: ordering", () => {
  it("moves a tab later in the strip", () => {
    const s = seed(["/a", "/b", "/c"])
    s.getState().moveTab("/a", 3)
    expect(paths(s)).toEqual(["/", "/b", "/c", "/a"])
  })

  it("moves a tab earlier in the strip", () => {
    const s = seed(["/a", "/b", "/c"])
    s.getState().moveTab("/c", 1)
    expect(paths(s)).toEqual(["/", "/c", "/a", "/b"])
  })

  it("matches arrayMove semantics, so a dnd-kit index maps straight through", () => {
    for (const [from, to] of [
      [1, 3],
      [3, 1],
      [2, 2],
      [1, 2],
      [3, 2],
    ] as const) {
      const s = seed(["/a", "/b", "/c"])
      const before = paths(s)
      s.getState().moveTab(before[from]!, to)
      expect(paths(s)).toEqual(arrayMove(before, from, to))
    }
  })

  it("is a no-op for an unknown pathname", () => {
    const s = seed(["/a", "/b"])
    s.getState().moveTab("/ghost", 0)
    expect(paths(s)).toEqual(["/", "/a", "/b"])
  })

  it("clamps an index past the end instead of dropping the tab", () => {
    const s = seed(["/a", "/b"])
    s.getState().moveTab("/a", 99)
    expect(paths(s)).toEqual(["/", "/b", "/a"])
  })
})

describe("moveTab: pinned tabs anchor the strip", () => {
  it("refuses to move the pinned tab", () => {
    const s = seed(["/a", "/b"])
    s.getState().moveTab("/", 2)
    expect(paths(s)).toEqual(["/", "/a", "/b"])
  })

  it("clamps a drop ahead of the pinned tab to just after it", () => {
    const s = seed(["/a", "/b"])
    s.getState().moveTab("/b", 0)
    // Not ["/b", "/", "/a"] — the pinned root keeps the front.
    expect(paths(s)).toEqual(["/", "/b", "/a"])
  })

  it("clamps past the last pinned tab even when several are pinned", () => {
    const s = seed(["/a", "/b"])
    // A second pinned tab, opened explicitly.
    s.getState().openTab({ ...tab("/x"), pinned: true })
    s.getState().moveTab("/x", 0)
    const order = paths(s)
    expect(order.indexOf("/")).toBeLessThan(order.indexOf("/a"))

    s.getState().moveTab("/b", 0)
    // /b lands after every pinned tab, never between or before them.
    const after = paths(s)
    expect(after.indexOf("/b")).toBeGreaterThan(after.indexOf("/"))
  })
})

describe("moveTab: groups stay contiguous", () => {
  it("reorders within a group", () => {
    const s = seed(["/a", "/b", "/c"])
    s.getState().createGroup({ title: "G", pathnames: ["/a", "/b"] })

    s.getState().moveTab("/b", 1)
    expect(paths(s)).toEqual(["/", "/b", "/a", "/c"])
    expect(groupOf(s, "/b")).toBe(groupOf(s, "/a"))
  })

  it("a loose tab dropped inside a group's run is pushed back out", () => {
    const s = seed(["/a", "/b", "/c"])
    s.getState().createGroup({ title: "G", pathnames: ["/a", "/b"] })

    // Land /c between the two group members without claiming membership.
    s.getState().moveTab("/c", 2)
    expect(paths(s)).toEqual(["/", "/a", "/b", "/c"])
    expect(groupOf(s, "/c")).toBeNull()
  })

  it("joins a group when the drop says so", () => {
    const s = seed(["/a", "/b", "/c"])
    const id = s.getState().createGroup({ title: "G", pathnames: ["/a", "/b"] })

    s.getState().moveTab("/c", 2, { groupId: id })
    expect(paths(s)).toEqual(["/", "/a", "/c", "/b"])
    expect(groupOf(s, "/c")).toBe(id)
  })

  it("leaves a group when dropped loose", () => {
    const s = seed(["/a", "/b", "/c"])
    const id = s.getState().createGroup({ title: "G", pathnames: ["/a", "/b"] })

    s.getState().moveTab("/a", 3, { groupId: null })
    expect(groupOf(s, "/a")).toBeNull()
    expect(groupOf(s, "/b")).toBe(id)
    expect(paths(s)).toEqual(["/", "/b", "/c", "/a"])
  })

  it("dragging the last member out releases the group", () => {
    const s = seed(["/a", "/b"])
    s.getState().createGroup({ title: "G", pathnames: ["/a"] })

    s.getState().moveTab("/a", 2, { groupId: null })
    expect(s.getState().groups).toEqual([])
    expect(paths(s)).toEqual(["/", "/b", "/a"])
  })

  it("keeps the rendered strip well-formed after a cross-group drag", () => {
    const s = seed(["/a", "/b", "/c", "/d"])
    const one = s.getState().createGroup({ title: "One", pathnames: ["/a", "/b"] })
    const two = s.getState().createGroup({ title: "Two", pathnames: ["/c", "/d"] })

    s.getState().moveTab("/c", 1, { groupId: one })

    const strip = buildStrip(s.getState().tabs, s.getState().groups)
    expect(strip.map((seg) => seg.kind)).toEqual(["tab", "group", "group"])
    const first = strip[1]
    const second = strip[2]
    if (first?.kind !== "group" || second?.kind !== "group") {
      throw new Error("expected two group segments")
    }
    expect(first.group.id).toBe(one)
    expect(first.tabs.map((t) => t.pathname)).toEqual(["/c", "/a", "/b"])
    expect(second.group.id).toBe(two)
    expect(second.tabs.map((t) => t.pathname)).toEqual(["/d"])
  })
})

describe("moveTab: state hygiene", () => {
  it("does not churn the groups reference when no group is affected", () => {
    const s = seed(["/a", "/b", "/c"])
    let changes = 0
    let last = s.getState().groups
    s.subscribe(() => {
      const now = s.getState().groups
      if (now !== last) {
        changes += 1
        last = now
      }
    })

    s.getState().moveTab("/a", 3)
    s.getState().moveTab("/c", 1)
    expect(changes).toBe(0)
  })

  it("leaves the store untouched when the move changes nothing", () => {
    const s = seed(["/a", "/b"])
    const before = s.getState().tabs
    s.getState().moveTab("/", 0)
    expect(s.getState().tabs).toBe(before)
  })
})
