import * as ReactRouter from "react-router"
import type { Context } from "react"

/**
 * The React Router contexts a kept page reads its URL and route data from.
 *
 * A hidden page stays mounted, so without intervention it would keep
 * consuming these as the live router moves on: `useLocation()` would report
 * another tab's URL, and `useLoaderData()` would return `undefined` (the route
 * is no longer matched) or, worse, the data of a *different* page that shares
 * its route — `/leads/2`'s lead rendered inside `/leads/1`'s tab.
 *
 * So each kept page gets these contexts re-provided with the values it last
 * saw while it was the active page. Its plain React Router hooks then answer
 * for its own URL, with no adapter-specific hook needed.
 *
 * Read through a namespace import on purpose: React Router 8 split the data
 * router state across several contexts (`DataRouterDataContext`,
 * `DataRouterNavigationContext`); 7 has only `DataRouterStateContext`. A
 * named import of a context that one major lacks would fail to link, while a
 * namespace lookup just yields `undefined` and the entry is skipped.
 *
 * `RouteContext` is deliberately absent: the cached outlet element carries its
 * own `RouteContext` providers (match chain, params, route id), so
 * `useParams()` is already correct inside it.
 */
const candidates = [
  "UNSAFE_LocationContext",
  "UNSAFE_DataRouterStateContext",
  "UNSAFE_DataRouterDataContext",
  "UNSAFE_DataRouterNavigationContext",
] as const

const exportsByName = ReactRouter as unknown as Record<
  string,
  Context<unknown> | undefined
>

/**
 * Module-constant, so components can call `useContext` over it in a loop
 * without ever changing hook order.
 */
export const FROZEN_CONTEXTS: readonly Context<unknown>[] = candidates
  .map((name) => exportsByName[name])
  .filter((ctx): ctx is Context<unknown> => ctx != null)

/** `UNSAFE_LocationContext` — required; present in every supported version. */
export const LocationContext = exportsByName.UNSAFE_LocationContext!

/** `UNSAFE_DataRouterStateContext` — `null` value outside a data router. */
export const DataRouterStateContext = exportsByName.UNSAFE_DataRouterStateContext!

/** `UNSAFE_RouteContext` — the match chain at the current outlet depth. */
export const RouteContext = exportsByName.UNSAFE_RouteContext!
