import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import type { ComponentType } from "react"

/**
 * Audit: live-tabs must be an *add-on* to the Next App Router, not a
 * replacement for it.
 *
 * Next keeps owning navigation, history and the URL. live-tabs only observes
 * the pathname and, in exactly one case (closing the tab you are looking at),
 * asks Next to navigate. Anything beyond that — rewriting history, intercepting
 * routes, forcing refreshes — would make it a router of its own.
 */

let currentPathname = "/dashboard"

const router = {
  push: vi.fn((to: string) => {
    currentPathname = to
  }),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => router,
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
import { WorkspaceTabBar } from "@live-tabs/core"

const Page = (id: string) => () => <div data-testid={id}>{id}</div>

const routes = createWorkspaceRoutes({
  staticRoutes: {
    "/dashboard": { title: "Dashboard", component: Page("dashboard") as ComponentType },
  },
  dynamicPatterns: [
    {
      match: /^\/leads\/(?<id>[^/]+)$/,
      noun: "Lead",
      component: Page("lead") as ComponentType,
    },
  ],
})

function Harness() {
  return (
    <WorkspaceProvider
      routes={routes}
      options={{ pinnedPath: "/dashboard", pinnedTab: { title: "Dashboard" } }}
    >
      <WorkspaceTabBar />
      <WorkspaceOutlet>
        <div data-testid="next-page">next renders this</div>
      </WorkspaceOutlet>
    </WorkspaceProvider>
  )
}

const otherRouterCalls = () =>
  (["replace", "back", "forward", "refresh"] as const).filter(
    (m) => router[m].mock.calls.length > 0,
  )

let pushState: ReturnType<typeof vi.spyOn>
let replaceState: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  for (const m of Object.values(router)) m.mockClear()
  currentPathname = "/dashboard"
  pushState = vi.spyOn(window.history, "pushState")
  replaceState = vi.spyOn(window.history, "replaceState")
})

afterEach(() => {
  pushState.mockRestore()
  replaceState.mockRestore()
})

describe("Next router non-interference", () => {
  it("never navigates on mount — rendering the workspace changes nothing", async () => {
    render(<Harness />)
    await screen.findByTestId("dashboard")

    expect(router.push).not.toHaveBeenCalled()
    expect(otherRouterCalls()).toEqual([])
  })

  it("never navigates when the app navigates — it only observes", async () => {
    const view = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    view.rerender(<Harness />)
    await screen.findByTestId("lead")

    // A tab opened, but live-tabs did not drive the navigation.
    expect(router.push).not.toHaveBeenCalled()
    expect(otherRouterCalls()).toEqual([])
  })

  it("never rewrites history directly", async () => {
    const view = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    view.rerender(<Harness />)
    await screen.findByTestId("lead")

    expect(pushState).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
  })

  it("uses exactly one router method, push, and only to leave a closed tab", async () => {
    const view = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    view.rerender(<Harness />)
    await screen.findByTestId("lead")

    fireEvent.click(screen.getByLabelText("Close Lead #1"))
    view.rerender(<Harness />)

    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith("/dashboard")
    expect(otherRouterCalls()).toEqual([])
    expect(pushState).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
  })

  it("closing a background tab does not navigate at all", async () => {
    const view = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    view.rerender(<Harness />)
    await screen.findByTestId("lead")

    // Back to the dashboard, then close the *other* tab.
    currentPathname = "/dashboard"
    view.rerender(<Harness />)
    router.push.mockClear()

    fireEvent.click(screen.getByLabelText("Close Lead #1"))
    view.rerender(<Harness />)

    expect(router.push).not.toHaveBeenCalled()
    expect(currentPathname).toBe("/dashboard")
  })

  it("leaves unregistered paths entirely to Next", async () => {
    const view = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/admin/billing"
    view.rerender(<Harness />)

    // Next's own children render, and nothing was cached or redirected.
    expect(screen.getByTestId("next-page")).toBeInTheDocument()
    expect(
      document.querySelector('[data-keepalive-pathname="/admin/billing"]'),
    ).toBeNull()
    expect(router.push).not.toHaveBeenCalled()
    expect(otherRouterCalls()).toEqual([])
  })

  it("renders tab links as ordinary next/link anchors", async () => {
    const view = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    view.rerender(<Harness />)
    await screen.findByTestId("lead")

    // Navigation happens through Next's own Link, so prefetch, middleware and
    // history behaviour stay Next's to decide.
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
    expect(tabs.length).toBeGreaterThan(0)
    expect(tabs.every((el) => el.tagName === "A")).toBe(true)
    expect(tabs.map((el) => el.getAttribute("href"))).toContain("/leads/1")
  })
})
