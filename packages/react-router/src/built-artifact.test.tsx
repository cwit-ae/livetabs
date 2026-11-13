import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import { useState } from "react"
import {
  RouterProvider,
  createMemoryRouter,
  useLoaderData,
  useParams,
} from "react-router"

// Deliberately the BUILT package, not the source — this file imports through
// the same `exports` map a consumer would.
//
// `@live-tabs/core` is external here, so the keep-alive event bus lives in
// core's module and has to be the very same instance on both sides of the
// package boundary: `<OffScreen>` (core) emits, `useActiveEffect` (this
// package) listens. Likewise `react-router` must stay external, or the frozen
// contexts would be a second copy the app's hooks never read.
import {
  WorkspaceProvider,
  KeepAliveOutlet,
  WorkspaceTabBar,
  createTabRegistry,
  useActiveEffect,
  useWorkspaceGroups,
} from "@live-tabs/react-router"

const activeLog: string[] = []

function LeadDetail() {
  const { id = "?" } = useParams()
  const data = useLoaderData() as { name: string }
  const [text, setText] = useState("")

  useActiveEffect(() => {
    activeLog.push(`show:${id}`)
    return () => activeLog.push(`hide:${id}`)
  }, [id])

  return (
    <>
      <span data-testid={`lead-name-${id}`}>{data.name}</span>
      <input
        data-testid={`lead-input-${id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </>
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
  return createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <WorkspaceProvider options={{ pinnedPath: "/" }} registry={registry}>
            <WorkspaceTabBar />
            <GroupControls />
            <KeepAliveOutlet />
          </WorkspaceProvider>
        ),
        children: [
          { index: true, element: <div data-testid="home">home</div> },
          {
            path: "leads/:id",
            handle: { keepAlive: true },
            loader: ({ params }) => ({ name: `Lead ${params.id} Inc` }),
            element: <LeadDetail />,
          },
        ],
      },
    ],
    { initialEntries: ["/"] },
  )
}

async function goto(router: ReturnType<typeof makeRouter>, to: string) {
  await act(async () => {
    await router.navigate(to)
  })
}

const keptWrapper = (pathname: string) =>
  document.querySelector(`[data-keepalive-pathname="${pathname}"]`)

beforeEach(() => {
  activeLog.length = 0
})

async function boot() {
  const router = makeRouter()
  render(<RouterProvider router={router} />)
  await screen.findByTestId("home")
  return router
}

describe("@live-tabs/react-router (built artifact)", () => {
  it("keeps pages alive with their state and their own loader data", async () => {
    const router = await boot()

    await goto(router, "/leads/1")
    fireEvent.change(screen.getByTestId("lead-input-1"), {
      target: { value: "half-typed note" },
    })
    await goto(router, "/leads/2")

    expect(keptWrapper("/leads/1")).toHaveAttribute("data-keepalive-mode", "hidden")
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")
    expect(screen.getByTestId("lead-name-1")).toHaveTextContent("Lead 1 Inc")
  })

  it("delivers keep-alive events across the package boundary", async () => {
    const router = await boot()

    await goto(router, "/leads/1")
    expect(activeLog).toContain("show:1")

    activeLog.length = 0
    await goto(router, "/leads/2")
    expect(activeLog).toContain("hide:1")
    expect(activeLog).toContain("show:2")
    expect(activeLog).not.toContain("show:1")
  })

  it("ships the group API in the built package", async () => {
    const router = await boot()
    await goto(router, "/leads/1")

    await act(async () => {
      fireEvent.click(screen.getByTestId("make-group"))
    })

    expect(screen.getByTestId("make-group")).toHaveAttribute("data-group-count", "1")
    expect(document.querySelector(".live-tabs-group")).not.toBeNull()
  })
})
