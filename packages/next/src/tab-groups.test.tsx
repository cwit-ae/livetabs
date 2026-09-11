import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
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

const Page = (label: string) => () => <div data-testid={label}>{label}</div>

/** Each lead tab needs its own test id — they are all mounted at once. */
function LeadPage() {
  const { id = "?" } = useKeptParams()
  return <div data-testid={`lead-${id}`}>lead {id}</div>
}

const routes = createWorkspaceRoutes({
  staticRoutes: {
    "/dashboard": { title: "Dashboard", component: Page("dashboard") as ComponentType },
  },
  dynamicPatterns: [
    {
      match: /^\/leads\/(?<id>[^/]+)$/,
      noun: "Lead",
      component: LeadPage as ComponentType,
    },
  ],
})

/** Test-only control surface for the group API. */
function GroupControls() {
  const { createGroup, groups } = useWorkspaceGroups()
  return (
    <button
      data-testid="make-group"
      data-group-count={groups.length}
      onClick={() =>
        createGroup({ title: "Pipeline", pathnames: ["/leads/1", "/leads/2"] })
      }
    >
      group
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
      <GroupControls />
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
  push.mockClear()
  currentPathname = "/dashboard"
})

/** Open /leads/1 and /leads/2, then group them. */
async function setupGroupedTabs() {
  const view = render(<Harness />)
  await screen.findByTestId("dashboard")

  for (const id of ["1", "2"]) {
    currentPathname = `/leads/${id}`
    view.rerender(<Harness />)
    await screen.findByTestId(`lead-${id}`)
  }

  fireEvent.click(screen.getByTestId("make-group"))
  view.rerender(<Harness />)
  return view
}

describe("tab groups in the bar", () => {
  it("renders grouped tabs inside a labelled group", async () => {
    await setupGroupedTabs()

    const group = document.querySelector(".live-tabs-group")
    expect(group).not.toBeNull()
    expect(screen.getByLabelText("Collapse Pipeline")).toBeInTheDocument()
    expect(group?.querySelectorAll('[role="tab"]')).toHaveLength(2)
    expect(tabTitles()).toEqual(["Dashboard", "Lead #1", "Lead #2"])
  })

  it("collapsing hides the member tabs and shows a count", async () => {
    const view = await setupGroupedTabs()

    // Move focus out of the group first so collapsing is a pure UI change.
    currentPathname = "/dashboard"
    view.rerender(<Harness />)

    fireEvent.click(screen.getByLabelText("Collapse Pipeline"))
    view.rerender(<Harness />)

    expect(tabTitles()).toEqual(["Dashboard"])
    expect(document.querySelector(".live-tabs-group-count")?.textContent).toBe("2")
    expect(
      document.querySelector(".live-tabs-group")?.getAttribute("data-collapsed"),
    ).toBe("true")
  })

  it("expanding brings the member tabs back", async () => {
    const view = await setupGroupedTabs()
    currentPathname = "/dashboard"
    view.rerender(<Harness />)

    fireEvent.click(screen.getByLabelText("Collapse Pipeline"))
    view.rerender(<Harness />)
    fireEvent.click(screen.getByLabelText("Expand Pipeline"))
    view.rerender(<Harness />)

    expect(tabTitles()).toEqual(["Dashboard", "Lead #1", "Lead #2"])
  })

  it("collapsing a group holding the active tab navigates out of it", async () => {
    const view = await setupGroupedTabs()
    expect(currentPathname).toBe("/leads/2")

    fireEvent.click(screen.getByLabelText("Collapse Pipeline"))
    view.rerender(<Harness />)

    // A collapsed group must not keep the active tab.
    expect(push).toHaveBeenCalledWith("/dashboard")
    expect(currentPathname).toBe("/dashboard")
  })

  it("collapsed members stay alive — their pages are only hidden from the bar", async () => {
    const view = await setupGroupedTabs()
    currentPathname = "/dashboard"
    view.rerender(<Harness />)

    fireEvent.click(screen.getByLabelText("Collapse Pipeline"))
    view.rerender(<Harness />)

    expect(
      document.querySelector('[data-keepalive-pathname="/leads/1"]'),
    ).toHaveAttribute("data-keepalive-mode", "hidden")
  })

  it("ungrouping dissolves the group and keeps every tab", async () => {
    const view = await setupGroupedTabs()

    fireEvent.click(screen.getByLabelText("Ungroup Pipeline"))
    view.rerender(<Harness />)

    expect(document.querySelector(".live-tabs-group")).toBeNull()
    expect(tabTitles()).toEqual(["Dashboard", "Lead #1", "Lead #2"])
    expect(screen.getByTestId("make-group")).toHaveAttribute("data-group-count", "0")
  })

  it("closing the last member drops the group with it", async () => {
    const view = await setupGroupedTabs()

    fireEvent.click(screen.getByLabelText("Close Lead #1"))
    view.rerender(<Harness />)
    expect(screen.getByTestId("make-group")).toHaveAttribute("data-group-count", "1")

    fireEvent.click(screen.getByLabelText("Close Lead #2"))
    view.rerender(<Harness />)

    expect(document.querySelector(".live-tabs-group")).toBeNull()
    expect(screen.getByTestId("make-group")).toHaveAttribute("data-group-count", "0")
    expect(tabTitles()).toEqual(["Dashboard"])
  })
})
