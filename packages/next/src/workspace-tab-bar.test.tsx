import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import { useEffect, useState } from "react"
import type { ComponentType } from "react"

let currentPathname = "/dashboard"
let currentSearch = ""
// Faithful to the real router: a push actually moves the location, which is
// what re-registers a kept route after its tab is closed.
const push = vi.fn((to: string) => {
  currentPathname = to
})

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(currentSearch),
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
import { WorkspaceTabBar } from "@live-tabs/core"

const mounts: Record<string, number> = {}

function LeadDetail() {
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
      component: LeadDetail as ComponentType,
    },
  ],
})

function Harness() {
  return (
    <WorkspaceProvider routes={routes} options={{ pinnedPath: "/dashboard", pinnedTab: { title: "Dashboard" } }}>
      <WorkspaceTabBar />
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

const keptWrapper = (pathname: string) =>
  document.querySelector(`[data-keepalive-pathname="${pathname}"]`)

beforeEach(() => {
  for (const key of Object.keys(mounts)) delete mounts[key]
  push.mockClear()
  currentPathname = "/dashboard"
  currentSearch = ""
})

describe("WorkspaceTabBar on the Next adapter", () => {
  it("opens a tab per visited route, titled from the registry", async () => {
    const { rerender } = render(<Harness />)
    await screen.findByTestId("dashboard")
    expect(tabTitles()).toEqual(["Dashboard"])

    currentPathname = "/leads/42"
    rerender(<Harness />)
    await screen.findByTestId("lead-input-42")

    expect(tabTitles()).toEqual(["Dashboard", "Lead #42"])
  })

  it("keeps the backgrounded tab's subtree alive while another is active", async () => {
    const { rerender } = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/42"
    rerender(<Harness />)
    await screen.findByTestId("lead-input-42")

    expect(keptWrapper("/dashboard")).toHaveAttribute(
      "data-keepalive-mode",
      "hidden",
    )
    expect(screen.getByTestId("dashboard")).toBeInTheDocument()
  })

  it("closing a tab tears its kept subtree down and navigates away", async () => {
    const { rerender } = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/42"
    rerender(<Harness />)
    const input = await screen.findByTestId("lead-input-42")
    fireEvent.change(input, { target: { value: "draft" } })

    // The bar labels each close button with its tab title.
    fireEvent.click(screen.getByLabelText("Close Lead #42"))

    expect(tabTitles()).toEqual(["Dashboard"])
    expect(keptWrapper("/leads/42")).toBeNull()
    expect(push).toHaveBeenCalledWith("/dashboard")

    // Closing the active tab navigated us to /dashboard; flush that render.
    rerender(<Harness />)
    expect(currentPathname).toBe("/dashboard")

    // Reopening starts clean — the closed tab's state is genuinely gone.
    currentPathname = "/leads/42"
    rerender(<Harness />)
    await screen.findByTestId("lead-input-42")
    expect(screen.getByTestId("lead-input-42")).toHaveValue("")
    expect(mounts["42"]).toBe(2)
  })

  it("also opens a tab for paths outside the route table (no keep-alive)", async () => {
    const { rerender } = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/admin/billing"
    rerender(<Harness />)

    // The bar is a navigation strip: unregistered paths get a tab too, they
    // just render through Next and are never cached.
    expect(tabTitles()).toEqual(["Dashboard", "Billing"])
    expect(screen.getByTestId("next-page")).toBeInTheDocument()
    expect(keptWrapper("/admin/billing")).toBeNull()
  })
})
