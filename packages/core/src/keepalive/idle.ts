import { useEffect, useRef } from "react"

export type IdleEvictionOptions = {
  /**
   * How often to sweep for idle subtrees. Default 30s, clamped to at most
   * `idleMs` (and at least 1s) so a short idle window still fires on time.
   */
  sweepMs?: number
  /** Return `true` to protect a pathname from eviction. */
  keep?: (pathname: string) => boolean
}

/**
 * Release kept-alive subtrees that have been hidden for too long, to cap the
 * memory a workspace holds.
 *
 * Keeping twenty pages mounted is the whole point of live-tabs, and also its
 * whole cost: every hidden tab retains its React tree, its DOM, and whatever
 * its components are holding. This trades the oldest of that back. An evicted
 * tab **stays in the bar** — only its subtree is freed — and revisiting it
 * mounts it fresh, exactly as a first visit would.
 *
 * The active tab is never evicted, and its clock resets on every sweep.
 *
 * Disabled when `idleMs` is 0 or non-finite, which is the default: silently
 * discarding state is the opposite of what this library is for, so it has to
 * be asked for.
 */
export function useIdleEviction(
  keptPathnames: string[],
  activePathname: string,
  destroy: (pathname: string) => void,
  idleMs: number,
  options: IdleEvictionOptions = {},
): void {
  const lastSeen = useRef(new Map<string, number>())

  // Read through refs so the sweep interval never has to be torn down and
  // rebuilt as tabs open, close, or change focus.
  const destroyRef = useRef(destroy)
  destroyRef.current = destroy
  const keepRef = useRef(options.keep)
  keepRef.current = options.keep
  const activeRef = useRef(activePathname)
  activeRef.current = activePathname
  const keptRef = useRef(keptPathnames)
  keptRef.current = keptPathnames

  const keptKey = keptPathnames.join("\n")

  useEffect(() => {
    const now = Date.now()
    const seen = lastSeen.current
    const kept = new Set(keptPathnames)
    for (const pathname of kept) if (!seen.has(pathname)) seen.set(pathname, now)
    // Being the active tab counts as being seen.
    seen.set(activePathname, now)
    // Forget anything that is no longer kept, so a reopened tab starts fresh.
    for (const pathname of [...seen.keys()]) {
      if (!kept.has(pathname)) seen.delete(pathname)
    }
    // `keptKey` stands in for `keptPathnames`, whose array identity changes on
    // every render; depending on the array itself would re-run this constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keptKey, activePathname])

  const enabled = Number.isFinite(idleMs) && idleMs > 0
  const sweepMs = Math.max(1000, Math.min(options.sweepMs ?? 30_000, idleMs))

  useEffect(() => {
    if (!enabled) return

    const timer = setInterval(() => {
      const now = Date.now()
      const seen = lastSeen.current

      for (const pathname of keptRef.current) {
        if (pathname === activeRef.current || keepRef.current?.(pathname)) {
          seen.set(pathname, now)
          continue
        }
        const last = seen.get(pathname)
        if (last === undefined) {
          seen.set(pathname, now)
          continue
        }
        if (now - last >= idleMs) {
          seen.delete(pathname)
          destroyRef.current(pathname)
        }
      }
    }, sweepMs)

    return () => clearInterval(timer)
  }, [enabled, idleMs, sweepMs])
}
