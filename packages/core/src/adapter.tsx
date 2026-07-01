import { createContext, useContext } from "react"
import type { ComponentType, ReactNode } from "react"

/** Props the tab bar passes to the adapter's `Link`. Extra props are
 *  forwarded to the underlying anchor. */
export type RouterLinkProps = {
  to: string
  className?: string
  children?: ReactNode
} & Record<string, unknown>

/**
 * The seam between livetabs and a router. A router-specific package (e.g.
 * `@livetabs/tanstack-router`) implements this; the core is otherwise
 * router-agnostic.
 *
 * Every member is a hook or a component, so implementations may call router
 * hooks inside them. The object identity must be stable across renders.
 */
export interface RouterAdapter {
  /** Current location of the active page. */
  useLocation(): { pathname: string; href: string }
  /** Returns an imperative navigate function. */
  useNavigate(): (to: string) => void
  /**
   * Pathname for the *current subtree*. Frozen inside a keep-alive subtree
   * (so a backgrounded page acts on its own URL), else the live pathname.
   * Adapters without keep-alive just return the live pathname.
   */
  useKeptPathname(): string
  /** Link component the tab bar renders for navigation. */
  Link: ComponentType<RouterLinkProps>
  /**
   * Optional. Returns a function that frees a kept-alive page subtree, called
   * when a tab closes. Omit (or return a no-op) when there's no keep-alive.
   */
  useDestroyPage?(): (pathname: string) => void
}

const RouterAdapterContext = createContext<RouterAdapter | null>(null)

export const RouterAdapterProvider = RouterAdapterContext.Provider

export function useAdapter(): RouterAdapter {
  const adapter = useContext(RouterAdapterContext)
  if (!adapter) {
    throw new Error(
      "livetabs: no RouterAdapter in context. Use a router-specific provider " +
        "(e.g. WorkspaceProvider from @livetabs/tanstack-router), or pass " +
        "`adapter` to the core WorkspaceProvider.",
    )
  }
  return adapter
}

/** Default `useDestroyPage` for adapters without keep-alive — a no-op. */
export function useNoopDestroyPage(): (pathname: string) => void {
  return noop
}

function noop() {}
