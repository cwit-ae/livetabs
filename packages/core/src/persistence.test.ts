import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { createWorkspaceTabsStore } from "./store"
import {
  attachPersistence,
  clearSnapshot,
  readSnapshot,
  writeSnapshot,
} from "./persistence"
import type { StorageLike } from "./persistence"

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } satisfies StorageLike & { map: Map<string, string> }
}

const tab = (pathname: string, title = pathname) => ({
  pathname,
  href: pathname,
  title,
})

const KEY = "test:workspace"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("readSnapshot", () => {
  it("returns null when nothing is stored", () => {
    expect(readSnapshot({ storage: fakeStorage(), key: KEY })).toBeNull()
  })

  it("returns null on unparseable JSON rather than throwing", () => {
    const storage = fakeStorage({ [KEY]: "{not json" })
    expect(readSnapshot({ storage, key: KEY })).toBeNull()
  })

  it("returns null when the saved version differs", () => {
    const storage = fakeStorage()
    writeSnapshot({ version: 1, tabs: [], groups: [] }, { storage, key: KEY })
    expect(readSnapshot({ storage, key: KEY, version: 2 })).toBeNull()
  })

  it("returns null on a structurally wrong payload", () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ version: 1, tabs: "no" }) })
    expect(readSnapshot({ storage, key: KEY })).toBeNull()
  })

  it("round-trips a snapshot", () => {
    const storage = fakeStorage()
    const snapshot = {
      version: 1,
      tabs: [tab("/a")],
      groups: [{ id: "g1", title: "G", collapsed: true }],
    }
    writeSnapshot(snapshot, { storage, key: KEY })
    expect(readSnapshot({ storage, key: KEY })).toEqual(snapshot)
  })

  it("survives storage that throws on access", () => {
    const hostile: StorageLike = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {
        throw new Error("blocked")
      },
    }
    expect(readSnapshot({ storage: hostile, key: KEY })).toBeNull()
    expect(() =>
      writeSnapshot({ version: 1, tabs: [], groups: [] }, { storage: hostile }),
    ).not.toThrow()
    expect(() => clearSnapshot({ storage: hostile })).not.toThrow()
  })

  it("is disabled by an explicit null storage", () => {
    expect(readSnapshot({ storage: null, key: KEY })).toBeNull()
  })
})

describe("attachPersistence", () => {
  it("saves the strip as it changes, debounced", () => {
    const storage = fakeStorage()
    const store = createWorkspaceTabsStore({ pinnedPath: "/" })
    const detach = attachPersistence(store, { storage, key: KEY, debounceMs: 50 })

    store.getState().openTab(tab("/a"))
    store.getState().openTab(tab("/b"))
    expect(storage.map.has(KEY)).toBe(false)

    vi.advanceTimersByTime(50)
    const saved = readSnapshot({ storage, key: KEY })
    expect(saved?.tabs.map((t) => t.pathname)).toEqual(["/", "/a", "/b"])

    detach()
  })

  it("restores the strip, including groups and collapsed state", () => {
    const storage = fakeStorage()
    const first = createWorkspaceTabsStore({ pinnedPath: "/" })
    const detachFirst = attachPersistence(first, {
      storage,
      key: KEY,
      debounceMs: 0,
    })

    first.getState().openTab(tab("/leads/1", "Lead #1"))
    first.getState().openTab(tab("/leads/2", "Lead #2"))
    const groupId = first
      .getState()
      .createGroup({ title: "Pipeline", pathnames: ["/leads/1", "/leads/2"] })
    first.getState().collapseGroup(groupId)
    vi.advanceTimersByTime(1)
    detachFirst()

    // A reload: brand new store, same storage.
    const second = createWorkspaceTabsStore({ pinnedPath: "/" })
    attachPersistence(second, { storage, key: KEY, debounceMs: 0 })

    expect(second.getState().tabs.map((t) => t.pathname)).toEqual([
      "/",
      "/leads/1",
      "/leads/2",
    ])
    expect(second.getState().groups).toEqual([
      { id: groupId, title: "Pipeline", color: undefined, collapsed: true },
    ])
  })

  it("flags restored tabs as not-live, and clears the flag once opened", () => {
    const storage = fakeStorage()
    writeSnapshot(
      { version: 1, tabs: [tab("/leads/1", "Lead #1")], groups: [] },
      { storage, key: KEY },
    )

    const store = createWorkspaceTabsStore({ pinnedPath: "/" })
    attachPersistence(store, { storage, key: KEY, debounceMs: 0 })

    const restored = store.getState().tabs.find((t) => t.pathname === "/leads/1")
    expect(restored?.restored).toBe(true)
    // The pinned root is seeded fresh, never "restored".
    expect(store.getState().tabs[0]).toMatchObject({ pathname: "/", pinned: true })
    expect(store.getState().tabs[0]!.restored).toBeUndefined()

    store.getState().openTab(tab("/leads/1", "Lead #1"))
    expect(
      store.getState().tabs.find((t) => t.pathname === "/leads/1")?.restored,
    ).toBe(false)
  })

  it("drops a restored tab's group when that group is gone", () => {
    const storage = fakeStorage()
    writeSnapshot(
      {
        version: 1,
        tabs: [{ ...tab("/a"), groupId: "ghost" }],
        groups: [],
      },
      { storage, key: KEY },
    )

    const store = createWorkspaceTabsStore({ pinnedPath: "/" })
    attachPersistence(store, { storage, key: KEY, debounceMs: 0 })

    expect(store.getState().tabs.find((t) => t.pathname === "/a")?.groupId).toBeNull()
  })

  it("flushes a pending write on detach instead of losing it", () => {
    const storage = fakeStorage()
    const store = createWorkspaceTabsStore({ pinnedPath: "/" })
    const detach = attachPersistence(store, {
      storage,
      key: KEY,
      debounceMs: 10_000,
    })

    store.getState().openTab(tab("/a"))
    expect(storage.map.has(KEY)).toBe(false)

    detach()
    expect(readSnapshot({ storage, key: KEY })?.tabs.map((t) => t.pathname)).toEqual([
      "/",
      "/a",
    ])
  })

  it("stops saving after detach", () => {
    const storage = fakeStorage()
    const store = createWorkspaceTabsStore({ pinnedPath: "/" })
    const detach = attachPersistence(store, { storage, key: KEY, debounceMs: 0 })

    store.getState().openTab(tab("/a"))
    vi.advanceTimersByTime(1)
    detach()

    store.getState().openTab(tab("/late"))
    vi.advanceTimersByTime(100)
    expect(readSnapshot({ storage, key: KEY })?.tabs.map((t) => t.pathname)).toEqual([
      "/",
      "/a",
    ])
  })
})
