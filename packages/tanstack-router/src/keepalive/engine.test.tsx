import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import { useEffect, useState } from "react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"

import { createTabRegistry, WorkspaceTabBar } from "@live-tabs/core"

import { WorkspaceProvider } from "../provider"
import { KeepAliveOutlet } from "./keep-alive-outlet"
import { useFrozenLocation } from "./frozen-location"
import { useActiveEffect } from "./hooks"

/**
 * Runtime coverage for the keep-alive engine as an app actually uses it:
 * a real TanStack router, real navigations, real kept subtrees. The engine's
 * router-agnostic half lives in `@live-tabs/core` now, so this is what proves
 * that move didn't change behaviour.
 */

const mounts: Record<string, number> = {}
const activeLog: string[] = []

function LeadDetail() {
  const id = (useFrozenLocation()?.params.id as string) ?? "?"
  const [text, setText] = useState("")

  useEffect(() => {
    mounts[id] = (mounts[id] ?? 0) + 1
  }, [id])

  useActiveEffect(() => {
    activeLog.push(`show:${id}`)
    return () => activeLog.push(`hide:${id}`)
  }, [id])

  return (
    <div>
      <span data-testid={`lead-${id}`}>lead {id}</span>
      <input
        data-testid={`lead-input-${id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  )
}

const registry = createTabRegistry({
  staticRoutes: { "/": { title: "Home" } },
  dynamicPatterns: [{ match: /^\/leads\/[^/]+$/, noun: "Lead" }],
})

function makeRouter(initial = "/") {
  const rootRoute = createRootRoute({
    component: () => (
      <WorkspaceProvider options={{ pinnedPath: "/" }} registry={registry}>
        <WorkspaceTabBar />
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

  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => <div data-testid="settings">settings</div>,
  })

  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute, leadRoute, settingsRoute]),
    history: createMemoryHistory({ initialEntries: [initial] }),
  })
}

type AnyRouter = ReturnType<typeof makeRouter>

async function goto(router: AnyRouter, to: string) {
  await act(async () => {
    await router.navigate({ to })
  })
  // Registration is deferred to a microtask, then flushed as state.
  await act(async () => {
    await Promise.resolve()
  })
}

const keptWrapper = (pathname: string) =>
  document.querySelector(`[data-keepalive-pathname="${pathname}"]`)

const tabTitles = () =>
  Array.from(document.querySelectorAll('[role="tab"]')).map((el) =>
    el.textContent?.replace(/✕|×/g, "").trim(),
  )

beforeEach(() => {
  for (const k of Object.keys(mounts)) delete mounts[k]
  activeLog.length = 0
})

describe("TanStack keep-alive engine", () => {
  it("keeps a visited route alive with its state across navigations", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    const input = await screen.findByTestId("lead-input-1")
    fireEvent.change(input, { target: { value: "half-typed note" } })

    await goto(router, "/leads/2")
    await screen.findByTestId("lead-input-2")

    // Lead 1 is hidden but still mounted, still holding its text.
    expect(keptWrapper("/leads/1")).toHaveAttribute(
      "data-keepalive-mode",
      "hidden",
    )
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")

    await goto(router, "/leads/1")
    expect(keptWrapper("/leads/1")).toHaveAttribute(
      "data-keepalive-mode",
      "visible",
    )
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")
    expect(mounts["1"]).toBe(1)
  })

  it("freezes each kept subtree's params to its own URL", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    await goto(router, "/leads/2")

    // Both subtrees are mounted; each still renders its own id.
    expect(screen.getByTestId("lead-1")).toHaveTextContent("lead 1")
    expect(screen.getByTestId("lead-2")).toHaveTextContent("lead 2")
  })

  it("runs useActiveEffect only for the subtree being shown or hidden", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    expect(activeLog).toContain("show:1")

    activeLog.length = 0
    await goto(router, "/leads/2")

    // Leaving 1 hides it; arriving at 2 shows it. Crucially, lead 1 must not
    // also receive a "show" — that is the bug a live-pathname read would cause.
    expect(activeLog).toContain("hide:1")
    expect(activeLog).toContain("show:2")
    expect(activeLog).not.toContain("show:1")
  })

  it("renders non-keepAlive routes through Outlet without caching them", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/settings")
    await screen.findByTestId("settings")

    expect(keptWrapper("/settings")).toBeNull()
  })

  it("opens tabs in the bar as routes are visited", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    await goto(router, "/leads/2")

    expect(tabTitles()).toEqual(["Home", "Lead #1", "Lead #2"])
  })

  it("closing a tab destroys its kept subtree", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    await goto(router, "/leads/2")
    expect(keptWrapper("/leads/1")).not.toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Close Lead #1"))
    })

    expect(keptWrapper("/leads/1")).toBeNull()
    expect(tabTitles()).toEqual(["Home", "Lead #2"])
  })
})
