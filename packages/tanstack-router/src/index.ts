// @livetabs/tanstack-router — everything from @livetabs/core, plus the
// TanStack Router adapter, the keep-alive engine, and a pre-wired provider.

// Re-export the router-agnostic core. The named exports below intentionally
// shadow core's `WorkspaceProvider` with the TanStack-bound one.
export * from "@livetabs/core"

// Keep-alive engine (also installs the `staticData.keepAlive` type augmentation).
export * from "./keepalive"

// TanStack-bound provider (adapter + keep-alive baked in) — overrides the
// core `WorkspaceProvider`/`WorkspaceProviderProps` above.
export { WorkspaceProvider } from "./provider"
export type { WorkspaceProviderProps } from "./provider"

export { tanstackRouterAdapter } from "./adapter"
