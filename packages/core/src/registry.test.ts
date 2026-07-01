import { describe, it, expect } from "vitest"

import { createTabRegistry } from "./registry"

describe("createTabRegistry", () => {
  const reg = createTabRegistry({
    staticRoutes: { "/dash": { title: "Dash", iconKey: "home" } },
    dynamicPatterns: [
      { match: /^\/dash\/customers\/[^/]+$/, iconKey: "customer", noun: "Customer" },
      { match: /^\/dash\/policies\/[^/]+\/edit$/, iconKey: "policy", noun: "Policy" },
    ],
  })

  it("resolves a static route exactly", () => {
    expect(reg.resolve("/dash")).toEqual({ title: "Dash", iconKey: "home" })
  })

  it("resolves a dynamic route to `Noun #id`", () => {
    expect(reg.resolve("/dash/customers/42")).toEqual({
      title: "Customer #42",
      iconKey: "customer",
    })
  })

  it("uses the id segment, not the trailing `edit`", () => {
    expect(reg.resolve("/dash/policies/7/edit")).toEqual({
      title: "Policy #7",
      iconKey: "policy",
    })
  })

  it("prefers a static match over a pattern", () => {
    const r = createTabRegistry({
      staticRoutes: { "/x/1": { title: "Exact" } },
      dynamicPatterns: [{ match: /^\/x\/[^/]+$/, noun: "Thing" }],
    })
    expect(r.resolve("/x/1").title).toBe("Exact")
  })

  it("falls back to a humanized last segment", () => {
    expect(reg.resolve("/dash/some-thing")).toEqual({ title: "Some Thing" })
  })

  it("supports a custom fallback", () => {
    const r = createTabRegistry({ fallback: () => ({ title: "X", iconKey: "y" }) })
    expect(r.resolve("/whatever")).toEqual({ title: "X", iconKey: "y" })
  })

  it("supports a custom title function on a pattern", () => {
    const r = createTabRegistry({
      dynamicPatterns: [
        { match: /^\/u\/\w+$/, title: (p) => `User ${p.split("/").pop()}` },
      ],
    })
    expect(r.resolve("/u/bob").title).toBe("User bob")
  })
})
