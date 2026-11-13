import { createContext, createElement, useContext } from "react"
import type { ReactNode } from "react"
import { useLocation } from "react-router"

/**
 * URL snapshot of a kept-alive page, matching the shape the other live-tabs
 * adapters expose.
 *
 * With React Router you rarely need it: inside a kept page the router's own
 * `useLocation()`, `useParams()`, `useSearchParams()` and `useLoaderData()`
 * already answer for that page's URL, because the adapter re-provides the
 * router contexts per page. It is here for code shared across adapters, and to
 * answer "am I inside a kept page?" (`useFrozenLocation() !== null`).
 */
export type FrozenLocation = {
  pathname: string
  search: Record<string, unknown>
  params: Record<string, string | undefined>
}

const FrozenLocationContext = createContext<FrozenLocation | null>(null)

export function FrozenLocationProvider({
  value,
  children,
}: {
  value: FrozenLocation | null
  children: ReactNode
}) {
  return createElement(FrozenLocationContext.Provider, { value }, children)
}

/** The kept page's URL snapshot, or `null` outside a kept page. */
export function useFrozenLocation(): FrozenLocation | null {
  return useContext(FrozenLocationContext)
}

/**
 * The pathname of the page *this* subtree belongs to: its own URL inside a
 * kept page — even while hidden and the live URL is elsewhere — and the live
 * pathname outside one.
 *
 * Equivalent to `useLocation().pathname` here, since the location context is
 * frozen per kept page; provided for parity with the other adapters.
 */
export function useKeptPathname(): string {
  return useLocation().pathname
}

/** The params of this subtree's route. Same as `useParams()` inside a kept page. */
export function useKeptParams(): Record<string, string | undefined> {
  return useFrozenLocation()?.params ?? {}
}

/** This subtree's search params as a plain object. */
export function useKeptSearch(): Record<string, unknown> {
  return useFrozenLocation()?.search ?? {}
}
