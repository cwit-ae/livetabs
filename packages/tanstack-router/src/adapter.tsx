import { useCallback } from "react"
import {
  Link as TanstackLink,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"

import type { RouterAdapter, RouterLinkProps } from "@live-tabs/core"

import { useKeptPathname } from "./keepalive/frozen-location"
import { useKeepAlive } from "./keepalive/hooks"

function AdapterLink({ to, children, ...rest }: RouterLinkProps) {
  return (
    // TanStack's `to` wants a literal route id; the tab href is a freeform
    // string (it came from the live URL), so defer the typing.
    <TanstackLink to={to as never} {...rest}>
      {children as never}
    </TanstackLink>
  )
}

/**
 * `RouterAdapter` backed by TanStack Router. Wires location, navigation, the
 * `<Link>`, the frozen (keep-alive-aware) pathname, and subtree teardown.
 */
export const tanstackRouterAdapter: RouterAdapter = {
  useLocation() {
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const href = useRouterState({ select: (s) => s.location.href })
    return { pathname, href }
  },
  useNavigate() {
    const navigate = useNavigate()
    return useCallback(
      (to: string) => {
        void navigate({ to: to as never })
      },
      [navigate],
    )
  },
  useKeptPathname() {
    return useKeptPathname()
  },
  Link: AdapterLink,
  useDestroyPage() {
    const { destroy } = useKeepAlive()
    return useCallback((pathname: string) => destroy(pathname), [destroy])
  },
}
