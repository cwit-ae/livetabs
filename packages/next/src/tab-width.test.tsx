import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
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
import { WorkspaceTabBar, useWorkspaceGroups } from "@live-tabs/core"

/**
 * jsdom has no layout engine, so nothing here measures a rendered width.
 * These assert the *hooks the stylesheet keys off* — the bar's
 * `data-tab-width`, the group's member count, the pinned marker — plus that
 * the shipped CSS actually contains the rules that consume them. Getting the
 * widths right visually is the stylesheet's job; getting these wrong would
 * silently disable it.
 */

function LeadPage() {
  const { id = "?" } = useKeptParams()
  return <div data-testid={`lead-${id}`}>lead {id}</div>
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

function GroupControls() {
  const { createGroup } = useWorkspaceGroups()
  return (
    <button
      data-testid="make-group"
      onClick={() =>
        createGroup({ title: "Pipeline", pathnames: ["/leads/1", "/leads/2"] })
      }
    >
      group
    </button>
  )
}

function Harness({ tabWidth }: { tabWidth?: "auto" | "equal" }) {
  return (
    <WorkspaceProvider
      routes={routes}
      options={{ pinnedPath: "/dashboard", pinnedTab: { title: "Dashboard" } }}
    >
      <WorkspaceTabBar {...(tabWidth ? { tabWidth } : {})} />
      <GroupControls />
      <WorkspaceOutlet>
        <div data-testid="next-page">next page</div>
      </WorkspaceOutlet>
    </WorkspaceProvider>
  )
}

const bar = () => document.querySelector(".live-tabs-bar")

beforeEach(() => {
  push.mockClear()
  currentPathname = "/dashboard"
})

describe("tab width mode", () => {
  it("defaults to auto, so existing bars keep content-sized tabs", async () => {
    render(<Harness />)
    await screen.findByTestId("dashboard")
    expect(bar()).toHaveAttribute("data-tab-width", "auto")
  })

  it("marks the bar when equal width is asked for", async () => {
    render(<Harness tabWidth="equal" />)
    await screen.findByTestId("dashboard")
    expect(bar()).toHaveAttribute("data-tab-width", "equal")
  })

  it("marks the pinned tab, so it can keep its natural width", async () => {
    render(<Harness tabWidth="equal" />)
    await screen.findByTestId("dashboard")

    const pinned = document.querySelector('[role="tab"][data-pinned="true"]')
    expect(pinned).not.toBeNull()
    expect(pinned?.textContent).toContain("Dashboard")
  })

  it("publishes a group's member count so its tabs can claim equal shares", async () => {
    const view = render(<Harness tabWidth="equal" />)
    await screen.findByTestId("dashboard")

    for (const id of ["1", "2"]) {
      currentPathname = `/leads/${id}`
      view.rerender(<Harness tabWidth="equal" />)
      await screen.findByTestId(`lead-${id}`)
    }

    fireEvent.click(screen.getByTestId("make-group"))
    view.rerender(<Harness tabWidth="equal" />)

    const group = document.querySelector(".live-tabs-group") as HTMLElement
    expect(group).not.toBeNull()
    // A 2-tab group must claim 2 shares, or its members end up narrower than
    // the loose tabs beside them.
    expect(group.style.getPropertyValue("--live-tabs-group-members")).toBe("2")
  })

  it("keeps the group colour variable working alongside the member count", async () => {
    const view = render(<Harness tabWidth="equal" />)
    await screen.findByTestId("dashboard")
    currentPathname = "/leads/1"
    view.rerender(<Harness tabWidth="equal" />)
    await screen.findByTestId("lead-1")

    fireEvent.click(screen.getByTestId("make-group"))
    view.rerender(<Harness tabWidth="equal" />)

    const group = document.querySelector(".live-tabs-group") as HTMLElement
    expect(group.style.getPropertyValue("--live-tabs-group-members")).toBe("1")
  })
})

describe("shipped stylesheet", () => {
  const root = resolve(__dirname, "../../..")
  const read = (pkg: string) =>
    readFileSync(resolve(root, `packages/${pkg}/styles.css`), "utf-8")

  it("contains the rules the equal-width mode depends on", () => {
    const css = read("core")
    expect(css).toContain('.live-tabs-bar[data-tab-width="equal"] .live-tabs-tab')
    expect(css).toContain("--live-tabs-tab-min")
    expect(css).toContain("--live-tabs-group-members")
    // Groups are flex-shrink:0 by default; equal mode must undo that or a
    // group holds full width while everything around it shrinks.
    expect(css).toContain(
      '.live-tabs-bar[data-tab-width="equal"] .live-tabs-group',
    )
  })

  it("is identical across all three packages", () => {
    const core = read("core")
    expect(read("next")).toBe(core)
    expect(read("tanstack-router")).toBe(core)
  })
})
