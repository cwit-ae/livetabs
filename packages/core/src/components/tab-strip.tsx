import { useEffect, useRef } from "react"
import type { CSSProperties, HTMLAttributes, ReactNode } from "react"

import { cx } from "./util"

export type TabStripProps = {
  /**
   * Key of the active tab. When it changes, the matching child
   * (`[data-active="true"]`) is scrolled into view. Optional.
   */
  activeKey?: string | null
  /** Width of the edge fade-out. Default `"1.75rem"`. */
  fadeWidth?: string
  children: ReactNode
} & Omit<HTMLAttributes<HTMLDivElement>, "children">

/**
 * Horizontal, overflow-scrolling tab rail with three quality-of-life touches
 * baked in:
 *
 *  - **Edge fade** — the strip dissolves into the chrome on whichever side
 *    has more to scroll (instead of a hard cut).
 *  - **Wheel-to-horizontal** — a vertical mouse wheel scrolls the strip
 *    sideways; genuine horizontal/trackpad intent is left alone.
 *  - **Auto-scroll active** — the active tab is scrolled into view when
 *    `activeKey` changes.
 *
 * Unstyled beyond the scroll mechanics: it ships `role="tablist"`, hides the
 * scrollbar inline, and applies the fade mask. Style the rail and its tabs
 * however you like via `className` / children.
 */
export function TabStrip({
  activeKey,
  fadeWidth = "1.75rem",
  className,
  style,
  children,
  ...rest
}: TabStripProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fadeRef = useRef<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  })

  // Recompute the fade mask imperatively (no re-render churn).
  const applyFade = () => {
    const el = scrollRef.current
    if (!el) return
    const left = el.scrollLeft > 1
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    if (left === fadeRef.current.left && right === fadeRef.current.right) return
    fadeRef.current = { left, right }
    const mask = `linear-gradient(to right, ${
      left ? `transparent 0, #000 ${fadeWidth}` : "#000 0"
    }, ${
      right ? `#000 calc(100% - ${fadeWidth}), transparent 100%` : "#000 100%"
    })`
    el.style.maskImage = mask
    el.style.webkitMaskImage = mask
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    applyFade()
    el.addEventListener("scroll", applyFade, { passive: true })

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener("wheel", onWheel, { passive: false })

    const ro = new ResizeObserver(applyFade)
    ro.observe(el)
    const mo = new MutationObserver(applyFade)
    mo.observe(el, { childList: true, subtree: true })

    return () => {
      el.removeEventListener("scroll", applyFade)
      el.removeEventListener("wheel", onWheel)
      ro.disconnect()
      mo.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadeWidth])

  // Scroll the active tab into view on change.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const active = el.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
  }, [activeKey])

  const mergedStyle: CSSProperties = {
    display: "flex",
    minWidth: 0,
    flex: "1 1 0%",
    alignItems: "center",
    overflowX: "auto",
    scrollbarWidth: "none",
    ...style,
  }

  return (
    <div
      ref={scrollRef}
      role="tablist"
      className={cx("live-tabs-strip", className)}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </div>
  )
}
