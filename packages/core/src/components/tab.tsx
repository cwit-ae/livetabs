import { cloneElement, isValidElement } from "react"
import type { HTMLAttributes, MouseEvent, ReactElement, ReactNode } from "react"

import { chain, cx } from "./util"

export type TabProps = {
  active?: boolean
  pinned?: boolean
  /**
   * Render the tab *as* this element — e.g. a router `<Link to={tab.href} />`.
   * The element's props are merged with the tab's role/aria/data attributes
   * and handlers (className concatenated, click handlers chained). Without
   * `render` the tab falls back to a `<button>`.
   */
  render?: ReactElement
  /** Fired on middle-click — browser muscle memory for "close". */
  onMiddleClick?: () => void
  className?: string
  children?: ReactNode
} & Omit<HTMLAttributes<HTMLElement>, "children">

/**
 * Headless tab trigger. Emits `role="tab"`, `aria-selected`, `aria-current`,
 * and `data-active` / `data-pinned` (style off the data-attributes), and
 * wires middle-click. Bring your own navigation via `render`.
 */
export function Tab({
  active,
  pinned,
  render,
  onMiddleClick,
  className,
  children,
  ...rest
}: TabProps) {
  const handleAux = (e: MouseEvent) => {
    if (e.button === 1 && onMiddleClick) onMiddleClick()
  }

  const base = {
    role: "tab" as const,
    "aria-selected": active ?? undefined,
    "aria-current": active ? ("page" as const) : undefined,
    "data-active": active ? "true" : "false",
    "data-pinned": pinned ? "true" : undefined,
  }

  if (render && isValidElement(render)) {
    const cp = (render.props ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = {
      ...base,
      ...rest,
      ...cp,
      className: cx("livetabs-tab", className, cp.className as string),
      onClick: chain(
        rest.onClick as ((e: MouseEvent) => void) | undefined,
        cp.onClick as ((e: MouseEvent) => void) | undefined,
      ),
      onAuxClick: chain(
        chain(rest.onAuxClick as ((e: MouseEvent) => void) | undefined, handleAux),
        cp.onAuxClick as ((e: MouseEvent) => void) | undefined,
      ),
    }
    return cloneElement(render, merged, children ?? (cp.children as ReactNode))
  }

  return (
    <button
      type="button"
      {...base}
      {...rest}
      className={cx("livetabs-tab", className)}
      onAuxClick={chain(
        rest.onAuxClick as ((e: MouseEvent) => void) | undefined,
        handleAux,
      )}
    >
      {children}
    </button>
  )
}
