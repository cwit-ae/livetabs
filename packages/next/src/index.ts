// @live-tabs/next — everything from @live-tabs/core, plus the Next.js App
// Router adapter, the keep-alive engine, and a pre-wired provider.
//
// Client-only by design: the whole package is "use client". Next keeps owning
// navigation and the URL; live-tabs owns what the workspace area renders.

// Re-export the router-agnostic core. The named exports below intentionally
// shadow core's `WorkspaceProvider` with the Next-bound one.
export * from "@live-tabs/core"

// Keep-alive engine + the outlet that renders kept tabs.
export * from "./keepalive"

// Next-bound provider (adapter + keep-alive baked in) — overrides the core
// `WorkspaceProvider`/`WorkspaceProviderProps` above.
export { WorkspaceProvider } from "./provider"
export type { WorkspaceProviderProps } from "./provider"

export { nextRouterAdapter } from "./adapter"

export { createWorkspaceRoutes } from "./routes"
export type {
  WorkspaceRoute,
  WorkspaceRoutes,
  WorkspaceRoutesOptions,
  StaticWorkspaceRoutes,
  DynamicWorkspaceRoute,
} from "./routes"
export { useWorkspaceRoutes } from "./routes-context"
