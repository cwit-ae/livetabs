// @live-tabs/react-router — everything from @live-tabs/core, plus the React
// Router adapter, the keep-alive engine, and a pre-wired provider.

// Re-export the router-agnostic core. The named exports below intentionally
// shadow core's `WorkspaceProvider` with the React Router-bound one.
export * from "@live-tabs/core"

// Keep-alive engine + the outlet that renders kept pages.
export * from "./keepalive"

// React Router-bound provider (adapter + keep-alive baked in) — overrides the
// core `WorkspaceProvider`/`WorkspaceProviderProps` above.
export { WorkspaceProvider } from "./provider"
export type { WorkspaceProviderProps } from "./provider"

export { reactRouterAdapter } from "./adapter"
