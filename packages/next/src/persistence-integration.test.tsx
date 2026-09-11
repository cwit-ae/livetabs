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
import { WorkspaceTabBar, useWorkspaceGroups } from "@live-tabs/core"
import type { StorageLike } from "@live-tabs/core"

const store = new Map<string, string>()
const storage: StorageLike = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => void store.set(k, v),
  removeItem: (k) => void store.delete(k),
}
const KEY = "test:next-workspace"

function LeadPage() {
  const { id = "?" } = useKeptParams()
  const [text, setText] = useState("")
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

function GroupControls() {
  const { createGroup } = useWorkspaceGroups()
  return (
    <button
      data-testid="make-group"
      onClick={() => createGroup({ title: "Pipeline", pathnames: ["/leads/1"] })}
    >
      group
    </button>
  )
}

/** A fresh mount stands in for a page reload. */
function Harness() {
  return (
    <WorkspaceProvider
      routes={routes}
      options={{ pinnedPath: "/dashboard", pinnedTab: { title: "Dashboard" } }}
      persist={{ storage, key: KEY, debounceMs: 0 }}
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
  store.clear()
  push.mockClear()
  currentPathname = "/dashboard"
})

describe("persistence through the provider", () => {
  it("restores the strip after a reload, but not the page state", async () => {
    const first = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    first.rerender(<Harness />)
    const input = await screen.findByTestId("lead-input-1")
    fireEvent.change(input, { target: { value: "half-typed note" } })
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")

    // Reload: tear the tree down and mount a brand new one.
    first.unmount()
    expect(store.has(KEY)).toBe(true)

    currentPathname = "/dashboard"
    render(<Harness />)
    await screen.findByTestId("dashboard")

    // The tab is back in the bar…
    expect(tabTitles()).toEqual(["Dashboard", "Lead #1"])
    // …but its page was never alive, so nothing is mounted for it yet.
    expect(screen.queryByTestId("lead-input-1")).toBeNull()
    expect(
      document.querySelector('[data-keepalive-pathname="/leads/1"]'),
    ).toBeNull()
  })

  it("marks restored tabs until they are visited, then clears the flag", async () => {
    const first = render(<Harness />)
    await screen.findByTestId("dashboard")
    currentPathname = "/leads/1"
    first.rerender(<Harness />)
    await screen.findByTestId("lead-input-1")
    first.unmount()

    currentPathname = "/dashboard"
    const second = render(<Harness />)
    await screen.findByTestId("dashboard")

    const restoredTab = document.querySelector('[data-restored="true"]')
    expect(restoredTab?.textContent).toContain("Lead #1")

    // Visiting it mounts the page fresh and clears the flag.
    currentPathname = "/leads/1"
    second.rerender(<Harness />)
    await screen.findByTestId("lead-input-1")

    expect(screen.getByTestId("lead-input-1")).toHaveValue("")
    expect(document.querySelector('[data-restored="true"]')).toBeNull()
  })

  it("restores groups and their collapsed state", async () => {
    const first = render(<Harness />)
    await screen.findByTestId("dashboard")
    currentPathname = "/leads/1"
    first.rerender(<Harness />)
    await screen.findByTestId("lead-input-1")

    fireEvent.click(screen.getByTestId("make-group"))
    first.rerender(<Harness />)
    currentPathname = "/dashboard"
    first.rerender(<Harness />)
    fireEvent.click(screen.getByLabelText("Collapse Pipeline"))
    first.rerender(<Harness />)
    first.unmount()

    render(<Harness />)
    await screen.findByTestId("dashboard")

    expect(screen.getByLabelText("Expand Pipeline")).toBeInTheDocument()
    expect(
      document.querySelector(".live-tabs-group")?.getAttribute("data-collapsed"),
    ).toBe("true")
    expect(document.querySelector(".live-tabs-group-count")?.textContent).toBe("1")
  })

  it("starts clean when nothing was saved", async () => {
    render(<Harness />)
    await screen.findByTestId("dashboard")
    expect(tabTitles()).toEqual(["Dashboard"])
  })
})
