import { createContext, createElement, useContext } from "react"
import type { ReactNode } from "react"
import { useLocation } from "@tanstack/react-router"

/**
 * URL snapshot handed to a kept-alive subtree so its URL-derived reads stay
 * stable while the user navigates elsewhere. Without this, hidden subtrees
 * re-render against the live URL and inner state keyed on params/search gets
 * wiped.
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

export function useFrozenLocation(): FrozenLocation | null {
  return useContext(FrozenLocationContext)
}

/**
 * The pathname for the *current subtree*. Inside a kept-alive (hidden)
 * subtree this returns the frozen pathname captured at registration, so the
 * subtree only ever acts on its own page — even while the live URL points
 * elsewhere. Outside keep-alive it returns the live pathname.
 *
 * Use this (not `useLocation`) anywhere a kept subtree needs "which page am
 * I?" — e.g. `useSetTabTitle`.
 */
export function useKeptPathname(): string {
  const frozen = useFrozenLocation()
  const live = useLocation({
    select: (l) => (frozen ? null : l.pathname),
  }) as string | null
  return frozen?.pathname ?? live ?? ""
}
