import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import { TabStrip } from "./tab-strip"

describe("TabStrip", () => {
  it("renders a tablist containing its children", () => {
    render(
      <TabStrip activeKey="/a">
        <button data-active="true">A</button>
        <button>B</button>
      </TabStrip>,
    )
    const strip = screen.getByRole("tablist")
    expect(strip).toBeInTheDocument()
    expect(strip).toHaveTextContent("A")
    expect(strip).toHaveTextContent("B")
  })

  it("forwards a custom className", () => {
    render(
      <TabStrip className="my-strip">
        <button>A</button>
      </TabStrip>,
    )
    expect(screen.getByRole("tablist").className).toContain("my-strip")
  })
})
