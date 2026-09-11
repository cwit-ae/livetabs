// Router-agnostic keep-alive engine. Adapters supply the router-bound pieces
// (location freezing, the alive-routes registry) and reuse everything here.

export { TinyEmitter } from "./event"
export type { ActivityMode } from "./types"
export { default as OffScreen } from "./off-screen"
export type { OffScreenProps } from "./off-screen"
export { default as CachedRoute } from "./cached-route"
export type { CachedRouteProps } from "./cached-route"
export {
  getKeepAliveEmitter,
  useEventListener,
  useUpdate,
  createActiveHooks,
} from "./hooks"
export type { KeepAliveEvents } from "./hooks"
