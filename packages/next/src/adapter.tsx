import { useCallback } from "react"
import type { ReactNode } from "react"
import NextLink from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type { RouterAdapter, RouterLinkProps } from "@live-tabs/core"

import { useKeptPathname } from "./keepalive/frozen-location"
import { useKeepAlive } from "./keepalive/hooks"

function AdapterLink({ to, children, ...rest }: RouterLinkProps) {
  return (
    <NextLink href={to} {...(rest as Record<string, never>)}>
      {children as ReactNode}
    </NextLink>
  )
}

/**
 * `RouterAdapter` backed by the Next.js App Router.
 *
 * Deliberately read-only with respect to Next: it observes the pathname and
 * pushes on click, and does nothing else. Rendering is the workspace's job,
 * so nothing here depends on route files, layouts, or Server Components.
 */
export const nextRouterAdapter: RouterAdapter = {
  useLocation() {
    const pathname = usePathname() ?? ""
    const searchParams = useSearchParams()
    const query = searchParams?.toString() ?? ""
    return { pathname, href: query ? `${pathname}?${query}` : pathname }
  },
  useNavigate() {
    const router = useRouter()
    return useCallback((to: string) => router.push(to), [router])
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
