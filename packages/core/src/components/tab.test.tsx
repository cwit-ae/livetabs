import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { Tab } from "./tab"
import { TabClose } from "./tab-close"

describe("Tab", () => {
  it("renders a button with tab semantics by default", () => {
    render(<Tab active>Hello</Tab>)
    const el = screen.getByRole("tab")
    expect(el.tagName).toBe("BUTTON")
    expect(el).toHaveAttribute("aria-selected", "true")
    expect(el).toHaveAttribute("data-active", "true")
    expect(el).toHaveTextContent("Hello")
  })

  it("renders as the element passed to `render` (asChild)", () => {
    render(<Tab render={<a href="/x" />}>Link</Tab>)
    const el = screen.getByRole("tab")
    expect(el.tagName).toBe("A")
    expect(el).toHaveAttribute("href", "/x")
    expect(el).toHaveTextContent("Link")
  })

  it("merges className from both the render element and the prop", () => {
    render(
      <Tab className="mine" render={<a className="theirs" />}>
        x
      </Tab>,
    )
    const el = screen.getByRole("tab")
    expect(el.className).toContain("mine")
    expect(el.className).toContain("theirs")
    expect(el.className).toContain("live-tabs-tab")
  })

  it("fires onMiddleClick on a middle auxclick", () => {
    const onMid = vi.fn()
    render(<Tab onMiddleClick={onMid}>x</Tab>)
    fireEvent(
      screen.getByRole("tab"),
      new MouseEvent("auxclick", { bubbles: true, button: 1 }),
    )
    expect(onMid).toHaveBeenCalledTimes(1)
  })

  it("ignores non-middle auxclicks", () => {
    const onMid = vi.fn()
    render(<Tab onMiddleClick={onMid}>x</Tab>)
    fireEvent(
      screen.getByRole("tab"),
      new MouseEvent("auxclick", { bubbles: true, button: 2 }),
    )
    expect(onMid).not.toHaveBeenCalled()
  })

  it("marks data-pinned when pinned", () => {
    render(<Tab pinned>x</Tab>)
    expect(screen.getByRole("tab")).toHaveAttribute("data-pinned", "true")
  })
})

describe("TabClose", () => {
  it("calls onClose and stops the click reaching the tab", () => {
    const onClose = vi.fn()
    const onTabClick = vi.fn()
    render(
      <Tab onClick={onTabClick} render={<a href="#" />}>
        <TabClose onClose={onClose}>x</TabClose>
      </Tab>,
    )
    fireEvent.click(screen.getByLabelText("Close tab"))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onTabClick).not.toHaveBeenCalled()
  })

  it("is excluded from the tab order", () => {
    render(<TabClose onClose={() => {}}>x</TabClose>)
    expect(screen.getByLabelText("Close tab")).toHaveAttribute("tabindex", "-1")
  })

  it("honours a custom label", () => {
    render(
      <TabClose onClose={() => {}} label="Close Acme">
        x
      </TabClose>,
    )
    expect(screen.getByLabelText("Close Acme")).toBeInTheDocument()
  })
})
