import type { WorkspaceSnapshot, WorkspaceTabsStore } from "./store"

/** The slice of the Storage API this needs — `localStorage` satisfies it. */
export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type PersistOptions = {
  /** Storage key. Namespace it per user if sessions are per-account. */
  key?: string
  /** Defaults to `localStorage`; pass `null` to disable. */
  storage?: StorageLike | null
  /** Bump to invalidate saved sessions after a breaking change. Default 1. */
  version?: number
  /** Coalesce writes. Default 250ms. */
  debounceMs?: number
}

const DEFAULT_KEY = "live-tabs:workspace"
const DEFAULT_VERSION = 1
const DEFAULT_DEBOUNCE = 250

/**
 * `localStorage` access throws outright in some configurations (Safari private
 * browsing, third-party iframes with cookies blocked), so this never assumes
 * the property is merely absent.
 */
function defaultStorage(): StorageLike | null {
  try {
    if (typeof globalThis === "undefined") return null
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage
    return candidate ?? null
  } catch {
    return null
  }
}

function resolveStorage(options: PersistOptions): StorageLike | null {
  return options.storage === undefined ? defaultStorage() : options.storage
}

function isSnapshot(value: unknown, version: number): value is WorkspaceSnapshot {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<WorkspaceSnapshot>
  return (
    candidate.version === version &&
    Array.isArray(candidate.tabs) &&
    Array.isArray(candidate.groups)
  )
}

/**
 * Read a saved session. Returns `null` when there is none, when it was written
 * by a different `version`, or when storage is unavailable or corrupt — a bad
 * snapshot is never worth throwing a whole app's boot over.
 */
export function readSnapshot(
  options: PersistOptions = {},
): WorkspaceSnapshot | null {
  const storage = resolveStorage(options)
  if (!storage) return null
  const version = options.version ?? DEFAULT_VERSION
  try {
    const raw = storage.getItem(options.key ?? DEFAULT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isSnapshot(parsed, version) ? parsed : null
  } catch {
    return null
  }
}

export function writeSnapshot(
  snapshot: WorkspaceSnapshot,
  options: PersistOptions = {},
): void {
  const storage = resolveStorage(options)
  if (!storage) return
  try {
    storage.setItem(options.key ?? DEFAULT_KEY, JSON.stringify(snapshot))
  } catch {
    // Quota exceeded or storage disabled mid-session. A workspace that can't
    // be saved is not a reason to break the one the user is using.
  }
}

export function clearSnapshot(options: PersistOptions = {}): void {
  const storage = resolveStorage(options)
  if (!storage) return
  try {
    storage.removeItem(options.key ?? DEFAULT_KEY)
  } catch {
    // As above.
  }
}

/**
 * Restore a saved strip into `store`, then keep saving it as it changes.
 * Returns a teardown function.
 *
 * What survives a reload is the **strip**, not the pages: tab titles, order,
 * groups and collapsed state come back, and every restored tab is flagged
 * `restored` until it is opened. Kept-alive subtrees are React state and
 * cannot be serialised, so a restored tab mounts fresh on its first visit —
 * which is exactly what the flag exists to let you show.
 *
 * Call this from an effect, not during render: reading storage while
 * rendering would desync a server-rendered first paint from the client.
 */
export function attachPersistence(
  store: WorkspaceTabsStore,
  options: PersistOptions = {},
): () => void {
  const version = options.version ?? DEFAULT_VERSION
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE

  const saved = readSnapshot(options)
  if (saved) store.getState().hydrate(saved)

  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    timer = undefined
    const { tabs, groups } = store.getState()
    writeSnapshot({ version, tabs, groups }, options)
  }

  const unsubscribe = store.subscribe(() => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  })

  return () => {
    unsubscribe()
    if (timer === undefined) return
    // Don't lose the pending write on unmount — a workspace closed by
    // navigating away should still come back.
    clearTimeout(timer)
    flush()
  }
}
