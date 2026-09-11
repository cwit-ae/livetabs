import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import { useEffect, useState } from "react"
import type { ComponentType } from "react"

// A mutable stand-in for the Next router. Tests move the "URL" and re-render,
// which is exactly what a client-side navigation looks like to this package.
let currentPathname = "/"
let currentSearch = ""

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentSearch),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) => (
    <a href={href}>{children as never}</a>
  ),
}))

import { createWorkspaceRoutes } from "../routes"
import { WorkspaceProvider } from "../provider"
import { WorkspaceOutlet } from "./workspace-outlet"
import { useKeptParams } from "./frozen-location"

const mounts: Record<string, number> = {}

function LeadDetail() {
  const { id = "?" } = useKeptParams()
  const [text, setText] = useState("")
  useEffect(() => {
    mounts[id] = (mounts[id] ?? 0) + 1
    // Count real mounts only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <input
      data-testid={`lead-input-${id}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  )
}

function Dashboard() {
  return <div data-testid="dashboard">dashboard</div>
}

const routes = createWorkspaceRoutes({
  staticRoutes: {
    "/dashboard": { title: "Dashboard", component: Dashboard as ComponentType },
  },
  dynamicPatterns: [
    {
      match: /^\/leads\/(?<id>[^/]+)$/,
      noun: "Lead",
      component: LeadDetail as ComponentType,
    },
  ],
})

function Harness() {
  return (
    <WorkspaceProvider routes={routes}>
      <WorkspaceOutlet>
        <div data-testid="next-page">next page</div>
      </WorkspaceOutlet>
    </WorkspaceProvider>
  )
}

const keptWrapper = (pathname: string) =>
  document.querySelector(`[data-keepalive-pathname="${pathname}"]`)

beforeEach(() => {
  for (const key of Object.keys(mounts)) delete mounts[key]
  currentPathname = "/"
  currentSearch = ""
})

describe("WorkspaceOutlet", () => {
  it("keeps a backgrounded tab mounted with its state intact", async () => {
    currentPathname = "/leads/1"
    const { rerender } = render(<Harness />)

    const input = await screen.findByTestId("lead-input-1")
    fireEvent.change(input, { target: { value: "half-typed note" } })
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")

    currentPathname = "/leads/2"
    rerender(<Harness />)
    await screen.findByTestId("lead-input-2")

    // Tab 1 is still in the DOM, hidden, and still holds what was typed.
    expect(keptWrapper("/leads/1")).toHaveAttribute(
      "data-keepalive-mode",
      "hidden",
    )
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")

    currentPathname = "/leads/1"
    rerender(<Harness />)

    expect(keptWrapper("/leads/1")).toHaveAttribute(
      "data-keepalive-mode",
      "visible",
    )
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")
    // The whole point: revisiting reused the subtree instead of remounting it.
    expect(mounts["1"]).toBe(1)
  })

  it("freezes each subtree's params so tabs don't read each other's URL", async () => {
    currentPathname = "/leads/1"
    const { rerender } = render(<Harness />)
    await screen.findByTestId("lead-input-1")

    currentPathname = "/leads/2"
    rerender(<Harness />)
    await screen.findByTestId("lead-input-2")

    // Tab 1 still renders against id=1 even though the live URL says 2.
    expect(screen.getByTestId("lead-input-1")).toBeInTheDocument()
    expect(mounts["1"]).toBe(1)
    expect(mounts["2"]).toBe(1)
  })

  it("falls through to Next's own children for unregistered paths", () => {
    currentPathname = "/admin/billing"
    render(<Harness />)

    expect(screen.getByTestId("next-page")).toBeInTheDocument()
    expect(keptWrapper("/admin/billing")).toBeNull()
  })

  it("hides Next's children once the path is a registered workspace route", async () => {
    currentPathname = "/dashboard"
    render(<Harness />)

    await screen.findByTestId("dashboard")
    expect(screen.queryByTestId("next-page")).toBeNull()
  })

  it("keeps unregistered paths out of the alive map entirely", async () => {
    currentPathname = "/dashboard"
    const { rerender } = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/admin/billing"
    rerender(<Harness />)

    // Dashboard stays alive in the background; the unregistered path renders
    // through Next and is never cached.
    expect(keptWrapper("/dashboard")).toHaveAttribute(
      "data-keepalive-mode",
      "hidden",
    )
    expect(screen.getByTestId("next-page")).toBeInTheDocument()
    expect(keptWrapper("/admin/billing")).toBeNull()
  })
})
