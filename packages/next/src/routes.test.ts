import { describe, it, expect } from "vitest"
import type { ComponentType } from "react"

import { createWorkspaceRoutes } from "./routes"

const Dashboard = (() => null) as ComponentType
const LeadDetail = (() => null) as ComponentType

function make() {
  return createWorkspaceRoutes({
    staticRoutes: {
      "/dashboard": { title: "Dashboard", iconKey: "home", component: Dashboard },
    },
    dynamicPatterns: [
      {
        match: /^\/leads\/(?<id>[^/]+)$/,
        noun: "Lead",
        iconKey: "lead",
        component: LeadDetail,
      },
    ],
  })
}

describe("createWorkspaceRoutes", () => {
  it("resolves a static route's component", () => {
    expect(make().resolveComponent("/dashboard")).toBe(Dashboard)
  })

  it("resolves a dynamic route's component", () => {
    expect(make().resolveComponent("/leads/42")).toBe(LeadDetail)
  })

  it("returns null for unregistered paths so they fall through to Next", () => {
    expect(make().resolveComponent("/admin/billing")).toBeNull()
  })

  it("exposes named capture groups as params", () => {
    expect(make().resolveParams("/leads/42")).toEqual({ id: "42" })
  })

  it("returns empty params for static and unmatched paths", () => {
    const routes = make()
    expect(routes.resolveParams("/dashboard")).toEqual({})
    expect(routes.resolveParams("/nope")).toEqual({})
  })

  it("still derives tab titles through the core registry", () => {
    const routes = make()
    expect(routes.registry.resolve("/dashboard")).toEqual({
      title: "Dashboard",
      iconKey: "home",
    })
    expect(routes.registry.resolve("/leads/42")).toEqual({
      title: "Lead #42",
      iconKey: "lead",
    })
  })

  it("is not confused by a /g regex carrying lastIndex state", () => {
    const routes = createWorkspaceRoutes({
      dynamicPatterns: [
        { match: /^\/leads\/(?<id>[^/]+)$/g, noun: "Lead", component: LeadDetail },
      ],
    })
    expect(routes.resolveParams("/leads/7")).toEqual({ id: "7" })
    expect(routes.resolveParams("/leads/7")).toEqual({ id: "7" })
  })
})
