import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import { useEffect, useLayoutEffect, useState } from "react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from "@tanstack/react-router"

import { createTabRegistry, WorkspaceTabBar } from "@live-tabs/core"

import { WorkspaceProvider } from "../provider"
import { KeepAliveOutlet } from "./keep-alive-outlet"
import { useFrozenLocation } from "./frozen-location"
import { useActiveEffect, useKeepAlive } from "./hooks"

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

/**
 * Inspects the DOM after every commit that changes the route, logging a frame
 * where the router has settled on a URL but its page is not on screen.
 */
const blankFrames: string[] = []
const pageTestIds: Record<string, string> = {
  "/": "home",
  "/settings": "settings",
}
function FrameProbe() {
  const snapshot = useRouterState({
    select: (s) =>
      `${s.location.pathname}|${s.isLoading}|${s.matches.map((m) => m.id).join(",")}`,
  })
  useLayoutEffect(() => {
    const [pathname, isLoading] = snapshot.split("|") as [string, string]
    if (isLoading === "true") return
    const lead = /^\/leads\/(.+)$/.exec(pathname)?.[1]
    const testId = lead ? `lead-${lead}` : pageTestIds[pathname]
    if (testId && !document.querySelector(`[data-testid="${testId}"]`)) {
      blankFrames.push(pathname)
    }
  }, [snapshot])
  return null
}

/** Exposes `useKeepAlive()` to the test body. */
let keepAliveApi: ReturnType<typeof useKeepAlive> | null = null
function KeepAliveHandle() {
  keepAliveApi = useKeepAlive()
  return null
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
        <KeepAliveOutlet>
          <FrameProbe />
          <KeepAliveHandle />
        </KeepAliveOutlet>
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
  blankFrames.length = 0
  keepAliveApi = null
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

  it("renders the current page from the first frame, with no blank frame", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    // Navigate without flushing the registration: the page must already be
    // on screen when the navigation commits.
    await act(async () => {
      await router.navigate({ to: "/leads/1" })
    })
    expect(screen.getByTestId("lead-1")).toBeInTheDocument()

    await act(async () => {
      await router.navigate({ to: "/settings" })
    })
    expect(screen.getByTestId("settings")).toBeInTheDocument()

    await goto(router, "/leads/2")
    await goto(router, "/")

    expect(blankFrames).toEqual([])
  })

  it("mounts a kept page exactly once, from its first visit on", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    expect(mounts["1"]).toBe(1)

    await goto(router, "/settings")
    await goto(router, "/leads/2")
    await goto(router, "/leads/1")
    await goto(router, "/")
    await goto(router, "/leads/1")

    // Every mount is a kept, frozen instance — never a stray `<Outlet />`
    // copy of a kept page (which would mount as "?").
    expect(mounts).toEqual({ "1": 1, "2": 1 })
  })

  it("closing the active tab tears its page down", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    await goto(router, "/leads/2")

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Close Lead #2"))
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(router.state.location.pathname).not.toBe("/leads/2")
    expect(keptWrapper("/leads/2")).toBeNull()
    expect(tabTitles()).toEqual(["Home", "Lead #1"])
  })

  it("does not resurrect a page destroyed while still on screen", async () => {
    const router = makeRouter()
    render(<RouterProvider router={router} />)
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    await goto(router, "/leads/2")

    // Destroy first, then re-render with fresh matches before the URL moves —
    // the window that closing the active tab opens.
    await act(async () => {
      keepAliveApi!.destroy("/leads/2")
    })
    await act(async () => {
      await router.invalidate()
    })
    // The page stays on screen until the user actually leaves it.
    expect(screen.getByTestId("lead-2")).toBeInTheDocument()

    await goto(router, "/leads/1")
    expect(keptWrapper("/leads/2")).toBeNull()

    // A fresh visit brings it back, newly mounted.
    await goto(router, "/leads/2")
    expect(keptWrapper("/leads/2")).toHaveAttribute(
      "data-keepalive-mode",
      "visible",
    )
    expect(mounts["2"]).toBe(2)
  })
})
