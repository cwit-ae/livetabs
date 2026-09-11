export { KeepAliveProvider, useKeepAliveContext } from "./keep-alive-context"
export type { AliveRoutes, KeepAliveContextState } from "./keep-alive-context"
export { KeepAliveOutlet } from "./keep-alive-outlet"
export type { KeepAliveOutletProps } from "./keep-alive-outlet"
export { useKeepAlive, useActiveEffect, useActiveChanged } from "./hooks"
export {
  FrozenLocationProvider,
  useFrozenLocation,
  useKeptPathname,
} from "./frozen-location"
export type { FrozenLocation } from "./frozen-location"
export type { ActivityMode } from "@live-tabs/core"

/**
 * Opt a route into keep-alive:
 *   createFileRoute("/x")({ staticData: { keepAlive: true }, component: X })
 */
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    keepAlive?: boolean
  }
}
