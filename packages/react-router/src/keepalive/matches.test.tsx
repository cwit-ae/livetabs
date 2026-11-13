import { describe, it, expect } from "vitest"
import { createElement } from "react"

import { collectOutletMatches, resolveKeepAlive } from "./matches"
import type { RouteMatchLike } from "./matches"

const m = (id: string, handle?: unknown): RouteMatchLike => ({
  route: { id, handle },
  params: { id },
})

const Rendered = (_: unknown) => null
const Boundary = (_: unknown) => null
const Provider = (_: unknown) => null

describe("collectOutletMatches", () => {
  it("follows routeContext.outlet down to the leaf's chain", () => {
    const leaf = createElement(Rendered, {
      routeContext: { outlet: null, matches: [m("root"), m("a"), m("b")] },
    })
    const mid = createElement(Rendered, {
      routeContext: { outlet: leaf, matches: [m("root"), m("a")] },
    })
    const outlet = createElement(Provider, { value: undefined, children: mid })

    expect(collectOutletMatches(outlet)?.map((x) => x.route.id)).toEqual([
      "root",
      "a",
      "b",
    ])
  })

  it("steps through an error boundary whose own outlet is null", () => {
    const leaf = createElement(Rendered, {
      routeContext: { outlet: null, matches: [m("root"), m("leaf")] },
    })
    const boundary = createElement(Boundary, {
      routeContext: { outlet: null, matches: [m("root"), m("leaf")] },
      children: leaf,
    })
    expect(collectOutletMatches(boundary)?.map((x) => x.route.id)).toEqual([
      "root",
      "leaf",
    ])
  })

  it("returns null for shapes it does not recognise", () => {
    expect(collectOutletMatches(null)).toBeNull()
    expect(collectOutletMatches("text")).toBeNull()
    expect(collectOutletMatches(createElement("div"))).toBeNull()
  })
})

describe("resolveKeepAlive", () => {
  it("lets the deepest route that declares a boolean win", () => {
    const chain = [m("root"), m("reports", { keepAlive: true }), m("live", { keepAlive: false })]
    expect(resolveKeepAlive(chain, 1)).toBe(false)
    expect(resolveKeepAlive(chain.slice(0, 2), 1)).toBe(true)
  })

  it("ignores routes above the outlet depth", () => {
    const chain = [m("root", { keepAlive: true }), m("page")]
    expect(resolveKeepAlive(chain, 1)).toBe(false)
    expect(resolveKeepAlive(chain, 0)).toBe(true)
  })

  it("ignores handles that are not booleans", () => {
    expect(resolveKeepAlive([m("x", { keepAlive: "yes" }), m("y", null)], 0)).toBe(false)
  })
})
