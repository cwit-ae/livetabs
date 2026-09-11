import type { ComponentType } from "react"
import { createTabRegistry } from "@live-tabs/core"
import type {
  DynamicTabPattern,
  TabMeta,
  TabRegistry,
  TabRegistryOptions,
} from "@live-tabs/core"

/**
 * A workspace route: tab metadata plus the component to render in the tab.
 *
 * TanStack Router lets the keep-alive engine read a route's component off the
 * router (`router.routesById[id].options.component`). The Next App Router has
 * no readable route table — route files are a build-time convention, not a
 * runtime registry — so the app declares the mapping here instead.
 */
export type WorkspaceRoute = TabMeta & { component: ComponentType }

/** Exact pathname → route. */
export type StaticWorkspaceRoutes = Record<string, WorkspaceRoute>

/**
 * Pattern route for dynamic pages. Use **named capture groups** to expose
 * params to the kept subtree:
 *
 * ```ts
 * { match: /^\/customers\/(?<id>[^/]+)$/, noun: "Customer", component: Customer }
 * ```
 */
export type DynamicWorkspaceRoute = DynamicTabPattern & {
  component: ComponentType
}

export type WorkspaceRoutesOptions = {
  staticRoutes?: StaticWorkspaceRoutes
  dynamicPatterns?: DynamicWorkspaceRoute[]
  /** Fallback tab meta when nothing matches. Unmatched paths are not kept. */
  fallback?: (pathname: string) => TabMeta
}

export type WorkspaceRoutes = {
  /** Titles/icons only — pass to `<WorkspaceProvider registry>`. */
  registry: TabRegistry
  /**
   * The component for a pathname, or `null` when the path isn't registered.
   * Unregistered paths fall through to Next's own rendering, untouched.
   */
  resolveComponent: (pathname: string) => ComponentType | null
  /** Named capture groups from the matching dynamic pattern. */
  resolveParams: (pathname: string) => Record<string, string | undefined>
}

/**
 * Declare which pathnames become kept-alive workspace tabs, and what renders
 * in them. Anything not declared here keeps rendering through Next exactly as
 * it does today — that's what makes adoption non-invasive.
 *
 * ```ts
 * export const routes = createWorkspaceRoutes({
 *   staticRoutes: {
 *     "/dashboard": { title: "Dashboard", iconKey: "home", component: Dashboard },
 *   },
 *   dynamicPatterns: [
 *     { match: /^\/leads\/(?<id>[^/]+)$/, noun: "Lead", component: LeadDetail },
 *   ],
 * })
 * ```
 */
export function createWorkspaceRoutes(
  options: WorkspaceRoutesOptions = {},
): WorkspaceRoutes {
  const staticRoutes = options.staticRoutes ?? {}
  const dynamicPatterns = options.dynamicPatterns ?? []

  // Reuse core's resolver for titles/icons by stripping the components out,
  // so title behaviour stays identical across adapters.
  const registryOptions: TabRegistryOptions = {
    staticRoutes: Object.fromEntries(
      Object.entries(staticRoutes).map(([path, { component: _c, ...meta }]) => [
        path,
        meta,
      ]),
    ),
    dynamicPatterns: dynamicPatterns.map(({ component: _c, ...pattern }) => pattern),
    ...(options.fallback ? { fallback: options.fallback } : {}),
  }

  const registry = createTabRegistry(registryOptions)

  /**
   * A caller's regex may carry the `g`/`y` flag, which makes both `.test()`
   * and `.exec()` advance `lastIndex` between calls — so the same path would
   * match, then not match, then match again. Reset before every use.
   */
  const exec = (re: RegExp, pathname: string) => {
    re.lastIndex = 0
    return re.exec(pathname)
  }

  const findPattern = (pathname: string) =>
    dynamicPatterns.find((p) => exec(p.match, pathname) !== null)

  return {
    registry,

    resolveComponent(pathname) {
      const exact = staticRoutes[pathname]
      if (exact) return exact.component
      return findPattern(pathname)?.component ?? null
    },

    resolveParams(pathname) {
      const pattern = findPattern(pathname)
      if (!pattern) return {}
      // `.exec` (not `String.match`) — with a /g regex the latter drops groups.
      return { ...(exec(pattern.match, pathname)?.groups ?? {}) }
    },
  }
}
