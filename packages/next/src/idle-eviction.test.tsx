import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
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
import { WorkspaceTabBar } from "@live-tabs/core"

const FIVE_MINUTES = 5 * 60_000
const mounts: Record<string, number> = {}

function LeadPage() {
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
      component: LeadPage as ComponentType,
    },
  ],
})

function Harness({
  idleMs = 0,
  keep,
}: {
  idleMs?: number
  keep?: (pathname: string) => boolean
}) {
  return (
    <WorkspaceProvider
      routes={routes}
      options={{ pinnedPath: "/dashboard", pinnedTab: { title: "Dashboard" } }}
    >
      <WorkspaceTabBar />
      <WorkspaceOutlet idleMs={idleMs} idleOptions={keep ? { keep } : undefined}>
        <div data-testid="next-page">next page</div>
      </WorkspaceOutlet>
    </WorkspaceProvider>
  )
}

const keptWrapper = (pathname: string) =>
  document.querySelector(`[data-keepalive-pathname="${pathname}"]`)

const tabTitles = () =>
  Array.from(document.querySelectorAll('[role="tab"]')).map((el) =>
    el.textContent?.replace(/✕|×/g, "").trim(),
  )

async function settle() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  for (const k of Object.keys(mounts)) delete mounts[k]
  push.mockClear()
  currentPathname = "/dashboard"
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("idle eviction (memory footprint of inactive tabs)", () => {
  it("releases a tab's subtree after it has been hidden past the idle window", async () => {
    const view = render(<Harness idleMs={FIVE_MINUTES} />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)
    const input = await screen.findByTestId("lead-input-1")
    fireEvent.change(input, { target: { value: "half-typed note" } })

    currentPathname = "/leads/2"
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)
    await screen.findByTestId("lead-input-2")
    expect(keptWrapper("/leads/1")).not.toBeNull()

    // Idle past the window.
    await act(async () => {
      vi.advanceTimersByTime(FIVE_MINUTES + 60_000)
    })
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)

    // The subtree is gone — that is the memory being handed back.
    expect(keptWrapper("/leads/1")).toBeNull()
    expect(screen.queryByTestId("lead-input-1")).toBeNull()
  })

  it("keeps the evicted tab in the bar and remounts it fresh on return", async () => {
    const view = render(<Harness idleMs={FIVE_MINUTES} />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)
    fireEvent.change(await screen.findByTestId("lead-input-1"), {
      target: { value: "half-typed note" },
    })

    currentPathname = "/leads/2"
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)
    await screen.findByTestId("lead-input-2")

    await act(async () => {
      vi.advanceTimersByTime(FIVE_MINUTES + 60_000)
    })
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)

    // Evicting frees the page, never the tab.
    expect(tabTitles()).toEqual(["Dashboard", "Lead #1", "Lead #2"])

    currentPathname = "/leads/1"
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)
    await settle()

    // Back, and mounted fresh — exactly like a first visit.
    expect(await screen.findByTestId("lead-input-1")).toHaveValue("")
    expect(mounts["1"]).toBe(2)
  })

  it("never evicts the active tab, however long it sits there", async () => {
    const view = render(<Harness idleMs={FIVE_MINUTES} />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)
    fireEvent.change(await screen.findByTestId("lead-input-1"), {
      target: { value: "still here" },
    })

    await act(async () => {
      vi.advanceTimersByTime(FIVE_MINUTES * 4)
    })
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)

    expect(keptWrapper("/leads/1")).toHaveAttribute("data-keepalive-mode", "visible")
    expect(screen.getByTestId("lead-input-1")).toHaveValue("still here")
    expect(mounts["1"]).toBe(1)
  })

  it("does not evict before the window elapses", async () => {
    const view = render(<Harness idleMs={FIVE_MINUTES} />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)
    await screen.findByTestId("lead-input-1")

    currentPathname = "/leads/2"
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)
    await screen.findByTestId("lead-input-2")

    await act(async () => {
      vi.advanceTimersByTime(FIVE_MINUTES - 60_000)
    })
    view.rerender(<Harness idleMs={FIVE_MINUTES} />)

    expect(keptWrapper("/leads/1")).toHaveAttribute("data-keepalive-mode", "hidden")
  })

  it("is off by default — nothing is ever discarded unless asked for", async () => {
    const view = render(<Harness />)
    await screen.findByTestId("dashboard")

    currentPathname = "/leads/1"
    view.rerender(<Harness />)
    fireEvent.change(await screen.findByTestId("lead-input-1"), {
      target: { value: "kept forever" },
    })

    currentPathname = "/leads/2"
    view.rerender(<Harness />)
    await screen.findByTestId("lead-input-2")

    await act(async () => {
      vi.advanceTimersByTime(FIVE_MINUTES * 10)
    })
    view.rerender(<Harness />)

    expect(keptWrapper("/leads/1")).not.toBeNull()
    expect(screen.getByTestId("lead-input-1")).toHaveValue("kept forever")
    expect(mounts["1"]).toBe(1)
  })

  it("honours `keep` for paths too expensive to rebuild", async () => {
    const keep = (pathname: string) => pathname === "/leads/1"
    const view = render(<Harness idleMs={FIVE_MINUTES} keep={keep} />)
    await screen.findByTestId("dashboard")

    for (const id of ["1", "2"]) {
      currentPathname = `/leads/${id}`
      view.rerender(<Harness idleMs={FIVE_MINUTES} keep={keep} />)
      await screen.findByTestId(`lead-input-${id}`)
    }

    currentPathname = "/dashboard"
    view.rerender(<Harness idleMs={FIVE_MINUTES} keep={keep} />)

    await act(async () => {
      vi.advanceTimersByTime(FIVE_MINUTES + 60_000)
    })
    view.rerender(<Harness idleMs={FIVE_MINUTES} keep={keep} />)

    expect(keptWrapper("/leads/1")).not.toBeNull() // protected
    expect(keptWrapper("/leads/2")).toBeNull() // evicted
  })
})
