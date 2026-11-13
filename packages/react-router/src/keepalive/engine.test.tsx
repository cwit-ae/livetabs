import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import { memo, useEffect, useRef, useState } from "react"
import {
  MemoryRouter,
  Outlet,
  Route,
  RouterProvider,
  Routes,
  createMemoryRouter,
  useLoaderData,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router"
import type { RouteObject } from "react-router"

import { createTabRegistry, useSetTabTitle, WorkspaceTabBar } from "@live-tabs/core"

import { WorkspaceProvider } from "../provider"
import { KeepAliveOutlet } from "./keep-alive-outlet"
import type { KeepAliveOutletProps } from "./keep-alive-outlet"
import { useFrozenLocation, useKeptPathname } from "./frozen-location"
import { useActiveEffect } from "./hooks"

/**
 * Runtime coverage for the React Router keep-alive engine as an app uses it:
 * a real router, real navigations, real kept subtrees.
 */

const mounts: Record<string, number> = {}
const renders: Record<string, number> = {}
const activeLog: string[] = []
const seen: Record<string, string> = {}

function LeadDetail() {
  const { id = "?" } = useParams()
  const location = useLocation()
  const [search] = useSearchParams()
  const data = useLoaderData() as { name: string } | undefined
  const [text, setText] = useState("")

  renders[id] = (renders[id] ?? 0) + 1
  seen[id] = `${location.pathname}${location.search}|${data?.name ?? "-"}|${search.get("tab") ?? "-"}`

  useEffect(() => {
    mounts[id] = (mounts[id] ?? 0) + 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useActiveEffect(() => {
    activeLog.push(`show:${id}`)
    return () => activeLog.push(`hide:${id}`)
  }, [id])

  return (
    <div>
      <span data-testid={`lead-${id}`}>{data?.name ?? `lead ${id}`}</span>
      <input
        data-testid={`lead-input-${id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  )
}

function Settings() {
  const { section = "general" } = useParams()
  const mountId = useRef(Math.random())
  useEffect(() => {
    mounts[`settings`] = (mounts.settings ?? 0) + 1
  }, [])
  return (
    <div data-testid="settings" data-section={section} data-mount={mountId.current}>
      settings
    </div>
  )
}

const registry = createTabRegistry({
  staticRoutes: { "/": { title: "Home" } },
  dynamicPatterns: [{ match: /^\/leads\/[^/]+$/, noun: "Lead" }],
})

function Layout(props: KeepAliveOutletProps) {
  return (
    <WorkspaceProvider options={{ pinnedPath: "/" }} registry={registry}>
      <WorkspaceTabBar />
      <main data-testid="main">
        <KeepAliveOutlet {...props} />
      </main>
    </WorkspaceProvider>
  )
}

let loaderDelay = 0
const leadLoader = async ({ params }: { params: Record<string, string | undefined> }) => {
  if (loaderDelay) await new Promise((r) => setTimeout(r, loaderDelay))
  return { name: `Lead ${params.id} Inc` }
}

function makeRoutes(layoutProps: KeepAliveOutletProps = {}, extra: RouteObject[] = []): RouteObject[] {
  return [
    {
      path: "/",
      element: <Layout {...layoutProps} />,
      children: [
        { index: true, element: <div data-testid="home">home</div> },
        {
          path: "leads/:id",
          handle: { keepAlive: true },
          loader: leadLoader,
          element: <LeadDetail />,
        },
        { path: "settings/:section?", element: <Settings /> },
        ...extra,
      ],
    },
  ]
}

function makeRouter(initial = "/", layoutProps?: KeepAliveOutletProps, extra?: RouteObject[]) {
  return createMemoryRouter(makeRoutes(layoutProps, extra), {
    initialEntries: [initial],
  })
}

type AnyRouter = ReturnType<typeof makeRouter>

async function goto(router: AnyRouter, to: string) {
  await act(async () => {
    await router.navigate(to)
  })
}

const keptWrapper = (pathname: string) =>
  document.querySelector(`[data-keepalive-pathname="${pathname}"]`)

const tabTitles = () =>
  Array.from(document.querySelectorAll('[role="tab"]')).map((el) =>
    el.textContent?.replace(/✕|×/g, "").trim(),
  )

beforeEach(() => {
  for (const o of [mounts, renders, seen]) for (const k of Object.keys(o)) delete o[k]
  activeLog.length = 0
  loaderDelay = 0
})

async function boot(initial = "/", layoutProps?: KeepAliveOutletProps, extra?: RouteObject[]) {
  const router = makeRouter(initial, layoutProps, extra)
  render(<RouterProvider router={router} />)
  await act(async () => {})
  return router
}

describe("React Router keep-alive engine", () => {
  it("keeps a visited route alive with its state across navigations", async () => {
    const router = await boot()
    await screen.findByTestId("home")

    await goto(router, "/leads/1")
    fireEvent.change(screen.getByTestId("lead-input-1"), {
      target: { value: "half-typed note" },
    })

    await goto(router, "/leads/2")
    expect(keptWrapper("/leads/1")).toHaveAttribute("data-keepalive-mode", "hidden")
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")

    await goto(router, "/")
    await goto(router, "/leads/1")
    expect(keptWrapper("/leads/1")).toHaveAttribute("data-keepalive-mode", "visible")
    expect(screen.getByTestId("lead-input-1")).toHaveValue("half-typed note")
    expect(mounts["1"]).toBe(1)
  })

  it("mounts a kept page exactly once, in the same commit as the navigation", async () => {
    const router = await boot()
    await goto(router, "/leads/1")

    // No deferred registration: visible immediately, and never remounted when
    // the registry catches up.
    expect(screen.getByTestId("lead-1")).toBeVisible()
    expect(keptWrapper("/leads/1")).toHaveAttribute("data-keepalive-mode", "visible")
    expect(mounts["1"]).toBe(1)
  })

  it("hidden pages keep reading their own URL, params and loader data", async () => {
    const router = await boot()
    await goto(router, "/leads/1?tab=notes")
    await goto(router, "/leads/2?tab=emails")

    // Same route, different params: without freezing, lead 1 would re-render
    // with lead 2's loader data and URL.
    expect(seen["1"]).toBe("/leads/1?tab=notes|Lead 1 Inc|notes")
    expect(seen["2"]).toBe("/leads/2?tab=emails|Lead 2 Inc|emails")
    expect(screen.getByTestId("lead-1")).toHaveTextContent("Lead 1 Inc")

    // Leaving the route entirely drops its loader data from the live router;
    // the hidden pages must still have theirs.
    await goto(router, "/settings")
    expect(screen.getByTestId("lead-1")).toHaveTextContent("Lead 1 Inc")
    expect(screen.getByTestId("lead-2")).toHaveTextContent("Lead 2 Inc")
  })

  it("hidden pages stay on their own URL as the live router moves on", async () => {
    const router = await boot()
    await goto(router, "/leads/1?tab=notes")
    await goto(router, "/leads/2")
    const before = renders["1"]!

    await goto(router, "/leads/3")
    await goto(router, "/settings/a")
    await goto(router, "/settings/b")

    // React 19 still re-runs router-hook consumers under a changed provider
    // even when a nearer provider shadows it — but every such run reads the
    // frozen values, never the live URL.
    expect(renders["1"]).toBeGreaterThanOrEqual(before)
    expect(seen["1"]).toBe("/leads/1?tab=notes|Lead 1 Inc|notes")
  })

  it("does not re-render a hidden page's subtree below its router hooks", async () => {
    const childRenders: string[] = []
    const Child = memo(function Child({ id }: { id: string }) {
      childRenders.push(id)
      return null
    })
    function Page() {
      const { id = "" } = useParams()
      useLocation()
      return <Child id={id} />
    }
    const router = await boot("/", {}, [
      { path: "memo/:id", handle: { keepAlive: true }, element: <Page /> },
    ])
    await goto(router, "/memo/1")
    await goto(router, "/memo/2")
    await goto(router, "/settings/a")
    await goto(router, "/")

    expect(childRenders.filter((id) => id === "1")).toEqual(["1"])
  })

  it("updates a kept page in place when only its search changes", async () => {
    const router = await boot()
    await goto(router, "/leads/1?tab=notes")
    fireEvent.change(screen.getByTestId("lead-input-1"), { target: { value: "keep me" } })

    await goto(router, "/leads/1?tab=emails")
    expect(seen["1"]).toBe("/leads/1?tab=emails|Lead 1 Inc|emails")
    expect(screen.getByTestId("lead-input-1")).toHaveValue("keep me")
    expect(mounts["1"]).toBe(1)

    // The snapshot follows: hidden, it remembers the latest search.
    await goto(router, "/")
    expect(seen["1"]).toBe("/leads/1?tab=emails|Lead 1 Inc|emails")
  })

  it("runs useActiveEffect only for the subtree being shown or hidden", async () => {
    const router = await boot()
    await goto(router, "/leads/1")
    expect(activeLog).toContain("show:1")

    activeLog.length = 0
    await goto(router, "/leads/2")
    expect(activeLog).toContain("hide:1")
    expect(activeLog).toContain("show:2")
    expect(activeLog).not.toContain("show:1")
  })

  it("renders routes without keepAlive exactly like <Outlet />", async () => {
    const router = await boot()
    await goto(router, "/settings/a")
    const first = screen.getByTestId("settings")

    expect(keptWrapper("/settings/a")).toBeNull()
    // Direct child of the layout's <main>, no wrapper.
    expect(first.parentElement).toBe(screen.getByTestId("main"))

    // A param change on the same route reuses the element, as React Router does.
    await goto(router, "/settings/b")
    expect(screen.getByTestId("settings")).toHaveAttribute("data-section", "b")
    expect(screen.getByTestId("settings")).toBe(first)
    expect(mounts.settings).toBe(1)

    // And it is not cached once left.
    await goto(router, "/")
    expect(screen.queryByTestId("settings")).toBeNull()
  })

  it("opens tabs in the bar as routes are visited, with search and hash", async () => {
    const router = await boot()
    await goto(router, "/leads/1?tab=notes#top")
    await goto(router, "/leads/2")

    expect(tabTitles()).toEqual(["Home", "Lead #1", "Lead #2"])
    const tab1 = screen.getByRole("tab", { name: /Lead #1/ })
    const link = tab1.tagName === "A" ? tab1 : tab1.querySelector("a")
    expect(link?.getAttribute("href")).toBe("/leads/1?tab=notes#top")
  })

  it("closing a hidden tab destroys its kept subtree", async () => {
    const router = await boot()
    await goto(router, "/leads/1")
    await goto(router, "/leads/2")
    expect(keptWrapper("/leads/1")).not.toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Close Lead #1"))
    })

    expect(keptWrapper("/leads/1")).toBeNull()
    expect(tabTitles()).toEqual(["Home", "Lead #2"])
  })

  it("closing the active tab does not resurrect it while the next page loads", async () => {
    const router = await boot()
    await goto(router, "/leads/1")
    await goto(router, "/leads/2")

    // The fallback tab (lead 1) has a slow loader, so the router sits in a
    // "loading" state — re-rendering lead 2 — before the URL changes.
    loaderDelay = 30
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Close Lead #2"))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })

    expect(router.state.location.pathname).toBe("/leads/1")
    expect(keptWrapper("/leads/2")).toBeNull()
    expect(screen.queryByTestId("lead-2")).toBeNull()
  })

  it("remounts a closed tab fresh when it is visited again", async () => {
    const router = await boot()
    await goto(router, "/leads/1")
    fireEvent.change(screen.getByTestId("lead-input-1"), { target: { value: "x" } })
    await goto(router, "/")
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Close Lead #1"))
    })

    await goto(router, "/leads/1")
    expect(screen.getByTestId("lead-input-1")).toHaveValue("")
    expect(mounts["1"]).toBe(2)

    // ...and it is kept again from then on.
    await goto(router, "/")
    expect(keptWrapper("/leads/1")).toHaveAttribute("data-keepalive-mode", "hidden")
  })

  it("useSetTabTitle in a hidden page renames its own tab, not the active one", async () => {
    function Titled() {
      const { id } = useParams()
      const [title, setTitle] = useState<string | null>(null)
      useSetTabTitle(title)
      return (
        <button data-testid={`title-${id}`} onClick={() => setTitle(`Account ${id}`)}>
          t
        </button>
      )
    }
    const router = await boot("/", {}, [
      { path: "accounts/:id", handle: { keepAlive: true }, element: <Titled /> },
    ])
    await goto(router, "/accounts/7")
    await goto(router, "/accounts/8")

    await act(async () => {
      fireEvent.click(screen.getByTestId("title-7"))
    })
    // Tab 8 keeps its registry fallback; only tab 7 is renamed.
    expect(tabTitles()).toEqual(["Home", "Account 7", "8"])
  })

  it("exposes the frozen location for adapter-agnostic code", async () => {
    function Probe() {
      const frozen = useFrozenLocation()
      const kept = useKeptPathname()
      return <span data-testid="probe">{`${kept}|${frozen?.params.id}|${String(frozen?.search.q)}`}</span>
    }
    const router = await boot("/", {}, [
      { path: "probe/:id", handle: { keepAlive: true }, element: <Probe /> },
    ])
    await goto(router, "/probe/5?q=x")
    await goto(router, "/")
    expect(screen.getByTestId("probe")).toHaveTextContent("/probe/5|5|x")
  })
})

describe("opting in", () => {
  it("lets the deepest route that sets handle.keepAlive decide", async () => {
    function Page({ name }: { name: string }) {
      useEffect(() => {
        mounts[name] = (mounts[name] ?? 0) + 1
      }, [name])
      return <div data-testid={name}>{name}</div>
    }
    const router = await boot("/", {}, [
      {
        path: "reports",
        handle: { keepAlive: true },
        element: <Outlet />,
        children: [
          { path: "sales", element: <Page name="sales" /> },
          { path: "live", handle: { keepAlive: false }, element: <Page name="live" /> },
        ],
      },
    ])

    await goto(router, "/reports/sales")
    await goto(router, "/reports/live")
    await goto(router, "/")

    expect(keptWrapper("/reports/sales")).not.toBeNull()
    expect(keptWrapper("/reports/live")).toBeNull()
    expect(screen.queryByTestId("live")).toBeNull()
  })

  it("ignores keepAlive on routes above the outlet", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          handle: { keepAlive: true },
          element: <Layout />,
          children: [
            { index: true, element: <div data-testid="home">home</div> },
            { path: "settings/:section?", element: <Settings /> },
          ],
        },
      ],
      { initialEntries: ["/settings"] },
    )
    render(<RouterProvider router={router} />)
    await act(async () => {})
    await goto(router as AnyRouter, "/")
    expect(keptWrapper("/settings")).toBeNull()
    expect(screen.queryByTestId("settings")).toBeNull()
  })

  it("include keeps pages whose routes carry no handle", async () => {
    const router = await boot("/", { include: (p) => p.startsWith("/settings") })
    await goto(router, "/settings/a")
    await goto(router, "/")
    expect(keptWrapper("/settings/a")).toHaveAttribute("data-keepalive-mode", "hidden")
  })

  it("forwards outlet context, like <Outlet context>", async () => {
    function Ctx() {
      return <span data-testid="ctx">{useOutletContext<string>()}</span>
    }
    const router = await boot("/", { context: "from-layout" }, [
      { path: "ctx", handle: { keepAlive: true }, element: <Ctx /> },
    ])
    await goto(router, "/ctx")
    expect(screen.getByTestId("ctx")).toHaveTextContent("from-layout")
  })
})

describe("declarative <Routes>", () => {
  function Nav() {
    const navigate = useNavigate()
    return (
      <>
        <button data-testid="go-1" onClick={() => navigate("/leads/1")} />
        <button data-testid="go-2" onClick={() => navigate("/leads/2")} />
      </>
    )
  }

  function Lead() {
    const { id } = useParams()
    const { pathname } = useLocation()
    const [text, setText] = useState("")
    return (
      <input
        data-testid={`d-${id}`}
        data-pathname={pathname}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    )
  }

  it("keeps routes flagged with the handle prop alive", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Nav />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<div>home</div>} />
            <Route path="leads/:id" handle={{ keepAlive: true }} element={<Lead />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    await act(async () => fireEvent.click(screen.getByTestId("go-1")))
    fireEvent.change(screen.getByTestId("d-1"), { target: { value: "typed" } })
    await act(async () => fireEvent.click(screen.getByTestId("go-2")))

    expect(screen.getByTestId("d-1")).toHaveValue("typed")
    expect(screen.getByTestId("d-1")).toHaveAttribute("data-pathname", "/leads/1")
    expect(keptWrapper("/leads/1")).toHaveAttribute("data-keepalive-mode", "hidden")
  })
})

describe("idle eviction", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("releases hidden pages after idleMs, never the active one", async () => {
    const router = await boot("/", { idleMs: 60_000 })
    await goto(router, "/leads/1")
    await goto(router, "/leads/2")

    await act(async () => {
      vi.advanceTimersByTime(2 * 60_000)
    })

    expect(keptWrapper("/leads/1")).toBeNull()
    expect(keptWrapper("/leads/2")).toHaveAttribute("data-keepalive-mode", "visible")
    // The tab stays in the bar.
    expect(tabTitles()).toEqual(["Home", "Lead #1", "Lead #2"])
  })
})
