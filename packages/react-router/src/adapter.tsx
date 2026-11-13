import { useCallback, useContext } from "react"
import type { ReactNode } from "react"
import { Link, useNavigate } from "react-router"
import type { Location } from "react-router"

import type { RouterAdapter, RouterLinkProps } from "@live-tabs/core"

import { useKeptPathname } from "./keepalive/frozen-location"
import { useKeepAliveContext } from "./keepalive/keep-alive-context"
import { LocationContext } from "./keepalive/router-contexts"

function AdapterLink({ to, children, ...rest }: RouterLinkProps) {
  return (
    <Link to={to} {...(rest as Record<string, never>)}>
      {children as ReactNode}
    </Link>
  )
}

/**
 * `RouterAdapter` backed by React Router (7+), in data, declarative and
 * framework mode alike. Reads the location, navigates on tab click, renders
 * React Router's `<Link>`, and frees a kept page when its tab closes.
 *
 * A tab's `href` keeps the search *and* hash, so returning to a tab restores
 * exactly where you were. Paths are basename-relative, as `<Link>` expects.
 */
export const reactRouterAdapter: RouterAdapter = {
  useLocation() {
    const { location } = useContext(LocationContext) as { location: Location }
    const { pathname, search, hash } = location
    return { pathname, href: `${pathname}${search}${hash}` }
  },
  useNavigate() {
    const navigate = useNavigate()
    return useCallback(
      (to: string) => {
        // Data routers return a promise; a failed navigation surfaces through
        // the router's own error handling, not here.
        void navigate(to)
      },
      [navigate],
    )
  },
  useKeptPathname() {
    return useKeptPathname()
  },
  Link: AdapterLink,
  useDestroyPage() {
    const { deleteAliveRoutes } = useKeepAliveContext()
    return useCallback(
      (pathname: string) => deleteAliveRoutes([pathname]),
      [deleteAliveRoutes],
    )
  },
}
