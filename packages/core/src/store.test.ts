import { describe, it, expect } from "vitest"

import { createWorkspaceTabsStore } from "./store"
import type { WorkspaceTabsOptions } from "./store"

function make(opts?: Partial<WorkspaceTabsOptions>) {
  return createWorkspaceTabsStore({
    pinnedPath: "/",
    pinnedTab: { title: "Home", iconKey: "home" },
    maxTabs: 3,
    ...opts,
  })
}

const tab = (pathname: string, title = pathname, href = pathname) => ({
  pathname,
  href,
  title,
})

describe("createWorkspaceTabsStore", () => {
  it("seeds a pinned root tab", () => {
    const s = make()
    expect(s.getState().tabs).toHaveLength(1)
    expect(s.getState().tabs[0]).toMatchObject({
      pathname: "/",
      pinned: true,
      title: "Home",
      iconKey: "home",
    })
  })

  it("opens a new tab", () => {
    const s = make()
    s.getState().openTab(tab("/a"))
    expect(s.getState().tabs.map((t) => t.pathname)).toEqual(["/", "/a"])
  })

  it("openTab is idempotent on pathname", () => {
    const s = make()
    s.getState().openTab(tab("/a"))
    s.getState().openTab(tab("/a"))
    expect(s.getState().tabs).toHaveLength(2)
  })

  it("bumps href when the same pathname is revisited", () => {
    const s = make()
    s.getState().openTab(tab("/a"))
    s.getState().openTab(tab("/a", "/a", "/a?tab=x"))
    expect(s.getState().tabs.find((t) => t.pathname === "/a")?.href).toBe("/a?tab=x")
  })

  it("upgrades a fallback title but never overwrites a real one", () => {
    const s = make()
    s.getState().openTab(tab("/c/1", "Customer #1"))
    s.getState().openTab(tab("/c/1", "Acme Inc"))
    expect(s.getState().tabs.find((t) => t.pathname === "/c/1")?.title).toBe("Acme Inc")
    // A subsequent fallback title must not clobber the real one.
    s.getState().openTab(tab("/c/1", "Customer #1"))
    expect(s.getState().tabs.find((t) => t.pathname === "/c/1")?.title).toBe("Acme Inc")
  })

  it("renameTab sets the title in place", () => {
    const s = make()
    s.getState().openTab(tab("/a"))
    s.getState().renameTab("/a", "Alpha")
    expect(s.getState().tabs.find((t) => t.pathname === "/a")?.title).toBe("Alpha")
  })

  it("evicts the oldest non-pinned tab past maxTabs", () => {
    const s = make({ maxTabs: 3 })
    s.getState().openTab(tab("/a"))
    s.getState().openTab(tab("/b"))
    s.getState().openTab(tab("/c")) // exceeds 3 → evict oldest non-pinned (/a)
    expect(s.getState().tabs.map((t) => t.pathname)).toEqual(["/", "/b", "/c"])
  })

  it("never evicts the pinned tab", () => {
    const s = make({ maxTabs: 2 })
    s.getState().openTab(tab("/a"))
    s.getState().openTab(tab("/b"))
    expect(s.getState().tabs[0]?.pinned).toBe(true)
    expect(s.getState().tabs.map((t) => t.pathname)).toEqual(["/", "/b"])
  })

  it("closeTab removes the tab and returns the neighbour", () => {
    const s = make()
    s.getState().openTab(tab("/a"))
    s.getState().openTab(tab("/b"))
    expect(s.getState().closeTab("/b")).toBe("/a")
    expect(s.getState().tabs.map((t) => t.pathname)).toEqual(["/", "/a"])
  })

  it("closeTab on the pinned tab is a no-op returning null", () => {
    const s = make()
    expect(s.getState().closeTab("/")).toBeNull()
    expect(s.getState().tabs).toHaveLength(1)
  })

  it("closeTab on an unknown pathname returns null", () => {
    const s = make()
    expect(s.getState().closeTab("/nope")).toBeNull()
  })

  it("closeAllTabs keeps pinned and returns the root", () => {
    const s = make()
    s.getState().openTab(tab("/a"))
    s.getState().openTab(tab("/b"))
    expect(s.getState().closeAllTabs()).toBe("/")
    expect(s.getState().tabs.map((t) => t.pathname)).toEqual(["/"])
  })

  it("closeAllTabs returns null when only pinned remains", () => {
    const s = make()
    expect(s.getState().closeAllTabs()).toBeNull()
  })
})
