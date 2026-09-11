import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import { useEffect, useState } from "react"
import type { ComponentType } from "react"

let currentPathname = "/dashboard"
const push = vi.fn((to: string) => {
  currentPathname = to
})

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) => (
    <a href={href as string} {...(rest as Record<string, never>)}>
      {children as never}
    </a>
  ),
}))

import { createWorkspaceRoutes } from "./routes"
import { WorkspaceProvider } from "./provider"
import { WorkspaceOutlet } from "./keepalive/workspace-outlet"
import { useKeptParams } from "./keepalive/frozen-location"
import { WorkspaceTabBar, useWorkspaceTabs } from "@live-tabs/core"

const mounts: Record<string, number> = {}

function LeadPage() {
  const { id = "?" } = useKeptParams()
  const [text, setText] = useState("")
  useEffect(() => {
    mounts[id] = (mounts[id] ?? 0) + 1
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

const Dashboard = () => <div data-testid="dashboard">dashboard</div>

const routes = createWorkspaceRoutes({
  staticRoutes: {
    "/dashboard": { title: "Dashboard", component: Dashboard as ComponentType },
  },
  dynamicPatterns: [
    {
      match: /^\/leads\/(?<id>[^/]+)$/,
      noun: "Lead",
      component: LeadPage as ComponentType,
    },
  ],
})

/** Stands in for the app's drag layer: same call a dnd-kit drop would make. */
function DragControls() {
  const { moveTab, tabs } = useWorkspaceTabs()
  return (
    <button
      data-testid="drag"
      data-order={tabs.map((t) => t.pathname).join(",")}
      onClick={() => moveTab("/leads/1", 3)}
    >
      drag
    </button>
  )
}

function Harness() {
  return (
    <WorkspaceProvider
      routes={routes}
      options={{ pinnedPath: "/dashboard", pinnedTab: { title: "Dashboard" } }}
    >
      <WorkspaceTabBar />
      <DragControls />
      <WorkspaceOutlet>
        <div data-testid="next-page">next page</div>
      </WorkspaceOutlet>
    </WorkspaceProvider>
  )
}

const tabTitles = () =>
  Array.from(document.querySelectorAll('[role="tab"]')).map((el) =>
    el.textContent?.replace(/✕|×/g, "").trim(),
  )

beforeEach(() => {
  for (const k of Object.keys(mounts)) delete mounts[k]
  push.mockClear()
  currentPathname = "/dashboard"
})

async function openTwoLeads() {
  const view = render(<Harness />)
  await screen.findByTestId("dashboard")
  for (const id of ["1", "2"]) {
    currentPathname = `/leads/${id}`
    view.rerender(<Harness />)
    await screen.findByTestId(`lead-input-${id}`)
  }
  return view
}

describe("reordering through useWorkspaceTabs", () => {
  it("reorders the rendered tab bar", async () => {
    const view = await openTwoLeads()
    expect(tabTitles()).toEqual(["Dashboard", "Lead #1", "Lead #2"])

    fireEvent.click(screen.getByTestId("drag"))
    view.rerender(<Harness />)

    expect(tabTitles()).toEqual(["Dashboard", "Lead #2", "Lead #1"])
  })

  it("keeps every page alive through the reorder", async () => {
    const view = await openTwoLeads()

    fireEvent.change(screen.getByTestId("lead-input-1"), {
      target: { value: "half-typed note" },
    })
    fireEvent.change(screen.getByTestId("lead-input-2"), {
      target: { value: "second tab" },
    })

    fireEvent.click(screen.getByTestId("drag"))
    view.rerender(<Harness />)

    // Reordering is a strip operation. It must not disturb the kept subtrees:
    // dragging a tab is not a reason to lose what is typed in it.
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")
    expect(screen.getByTestId("lead-input-2")).toHaveValue("second tab")
    expect(mounts["1"]).toBe(1)
    expect(mounts["2"]).toBe(1)
  })

  it("does not navigate — reordering is not a route change", async () => {
    const view = await openTwoLeads()
    push.mockClear()

    fireEvent.click(screen.getByTestId("drag"))
    view.rerender(<Harness />)

    expect(push).not.toHaveBeenCalled()
    expect(currentPathname).toBe("/leads/2")
  })

  it("leaves the active tab active wherever it lands", async () => {
    const view = await openTwoLeads()
    currentPathname = "/leads/1"
    view.rerender(<Harness />)

    fireEvent.click(screen.getByTestId("drag"))
    view.rerender(<Harness />)

    const active = document.querySelector('[role="tab"][data-active="true"]')
    expect(active?.textContent).toContain("Lead #1")
    expect(
      document.querySelector('[data-keepalive-pathname="/leads/1"]'),
    ).toHaveAttribute("data-keepalive-mode", "visible")
  })

  it("exposes the new order to the app immediately", async () => {
    const view = await openTwoLeads()
    expect(screen.getByTestId("drag")).toHaveAttribute(
      "data-order",
      "/dashboard,/leads/1,/leads/2",
    )

    fireEvent.click(screen.getByTestId("drag"))
    view.rerender(<Harness />)

    expect(screen.getByTestId("drag")).toHaveAttribute(
      "data-order",
      "/dashboard,/leads/2,/leads/1",
    )
  })
})
