import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react"

import { chain, cx } from "./util"

export type TabCloseProps = {
  onClose: () => void
  /** Accessible label. Default `"Close tab"`. */
  label?: string
  className?: string
  children?: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children">

/**
 * Close affordance for a tab. Stops propagation so it doesn't trigger the
 * tab's navigation, and is excluded from the tab order (`tabIndex={-1}`) —
 * closing via keyboard is handled at the strip level by your app.
 */
export function TabClose({
  onClose,
  label = "Close tab",
  className,
  children,
  ...rest
}: TabCloseProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      {...rest}
      className={cx("live-tabs-tab-close", className)}
      onMouseDown={chain(rest.onMouseDown, (e: MouseEvent<HTMLButtonElement>) =>
        e.stopPropagation(),
      )}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }}
    >
      {children}
    </button>
  )
}
