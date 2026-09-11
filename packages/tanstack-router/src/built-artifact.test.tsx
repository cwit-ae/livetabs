import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import { useState } from "react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"

// Deliberately the BUILT package, not the source — this file imports through
// the same `exports` map a consumer would.
//
// It guards the seam that source tests cannot see: `@live-tabs/core` is
// *external* here, so the keep-alive event bus lives in core's module and has
// to be the very same instance on both sides of the package boundary.
// `<OffScreen>` (core) emits; `useActiveEffect` (this package) listens. If the
// build ever inlined core, or resolved it twice, there would be two emitters
// and background tabs would silently stop reacting.
import {
  WorkspaceProvider,
  KeepAliveOutlet,
  WorkspaceTabBar,
  createTabRegistry,
  useActiveEffect,
  useFrozenLocation,
  useWorkspaceGroups,
} from "@live-tabs/tanstack-router"

const activeLog: string[] = []

function LeadDetail() {
  const id = (useFrozenLocation()?.params.id as string) ?? "?"
  const [text, setText] = useState("")

  useActiveEffect(() => {
    activeLog.push(`show:${id}`)
    return () => activeLog.push(`hide:${id}`)
  }, [id])

  return (
    <input
      data-testid={`lead-input-${id}`}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  )
}

function GroupControls() {
  const { createGroup, groups } = useWorkspaceGroups()
  return (
    <button
      data-testid="make-group"
      data-group-count={groups.length}
      onClick={() => createGroup({ title: "Pipeline", pathnames: ["/leads/1"] })}
    >
      group
    </button>
  )
}

const registry = createTabRegistry({
  staticRoutes: { "/": { title: "Home" } },
  dynamicPatterns: [{ match: /^\/leads\/[^/]+$/, noun: "Lead" }],
})

function makeRouter() {
  const rootRoute = createRootRoute({
    component: () => (
      <WorkspaceProvider options={{ pinnedPath: "/" }} registry={registry}>
        <WorkspaceTabBar />
        <GroupControls />
        <KeepAliveOutlet />
      </WorkspaceProvider>
    ),
  })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div data-testid="home">home</div>,
  })

  const leadRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/leads/$id",
    staticData: { keepAlive: true },
    component: LeadDetail,
  })

  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute, leadRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
}

async function goto(router: ReturnType<typeof makeRouter>, to: string) {
  await act(async () => {
    await router.navigate({ to })
  })
  await act(async () => {
    await Promise.resolve()
  })
}

const keptWrapper = (pathname: string) =>
  document.querySelector(`[data-keepalive-pathname="${pathname}"]`)

beforeEach(() => {
  activeLog.length = 0
})

describe("@live-tabs/tanstack-router (built artifact)", () => {
  it("keeps pages alive with their state", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    fireEvent.change(await screen.findByTestId("lead-input-1"), {
      target: { value: "half-typed note" },
    })

    await goto(router, "/leads/2")
    await screen.findByTestId("lead-input-2")

    expect(keptWrapper("/leads/1")).toHaveAttribute("data-keepalive-mode", "hidden")
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")
  })

  it("delivers keep-alive events across the package boundary", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    // `<OffScreen>` lives in core, `useActiveEffect` here. If the two resolved
    // different copies of the emitter module, this log would stay empty.
    expect(activeLog).toContain("show:1")

    activeLog.length = 0
    await goto(router, "/leads/2")
    expect(activeLog).toContain("hide:1")
    expect(activeLog).toContain("show:2")
    expect(activeLog).not.toContain("show:1")
  })

  it("ships the group API in the built package", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")
    await goto(router, "/leads/1")

    await act(async () => {
      fireEvent.click(screen.getByTestId("make-group"))
    })

    expect(screen.getByTestId("make-group")).toHaveAttribute("data-group-count", "1")
    expect(document.querySelector(".live-tabs-group")).not.toBeNull()
    expect(screen.getByLabelText("Collapse Pipeline")).toBeInTheDocument()
  })
})
