/**
 * Resolved tab metadata for a pathname: what the tab should say + which icon
 * key to render. Detail pages can override the title later via
 * `useSetTabTitle` once their data lands.
 */
export type TabMeta = { title: string; iconKey?: string }

/** Exact path → meta (first-level pages). */
export type StaticTabRoutes = Record<string, TabMeta>

/**
 * Pattern for dynamic routes (`/customers/$id`). The default title is
 * ``${noun} #${lastSegment}``; pass `title` for full control.
 */
export type DynamicTabPattern = {
  match: RegExp
  iconKey?: string
  /** Noun used to build the default ``${noun} #${id}`` title. */
  noun?: string
  /** Full control: derive the title from the pathname yourself. */
  title?: (pathname: string) => string
}

export type TabRegistryOptions = {
  staticRoutes?: StaticTabRoutes
  dynamicPatterns?: DynamicTabPattern[]
  /** Fallback when nothing matches. Defaults to a humanized last segment. */
  fallback?: (pathname: string) => TabMeta
}

export type TabRegistry = {
  resolve: (pathname: string) => TabMeta
}

function humanize(segment: string): string {
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function lastSegment(pathname: string): string {
  return pathname.split("/").filter(Boolean).pop() ?? ""
}

function defaultFallback(pathname: string): TabMeta {
  const seg = lastSegment(pathname) || "Page"
  return { title: humanize(seg) }
}

/**
 * Build a path → tab-meta resolver. Static routes win over patterns; patterns
 * are tried in order. Unknown paths fall back to a humanized last segment.
 *
 * ```ts
 * const registry = createTabRegistry({
 *   staticRoutes: { "/dashboard": { title: "Dashboard", iconKey: "home" } },
 *   dynamicPatterns: [
 *     { match: /^\/dashboard\/customers\/[^/]+$/, iconKey: "customer", noun: "Customer" },
 *   ],
 * })
 * registry.resolve("/dashboard/customers/42") // → { title: "Customer #42", iconKey: "customer" }
 * ```
 */
export function createTabRegistry(options: TabRegistryOptions = {}): TabRegistry {
  const staticRoutes = options.staticRoutes ?? {}
  const dynamicPatterns = options.dynamicPatterns ?? []
  const fallback = options.fallback ?? defaultFallback

  return {
    resolve(pathname) {
      const exact = staticRoutes[pathname]
      if (exact) return exact

      for (const pat of dynamicPatterns) {
        if (!pat.match.test(pathname)) continue
        if (pat.title) return { title: pat.title(pathname), iconKey: pat.iconKey }
        const segments = pathname.split("/").filter(Boolean)
        // For `/foo/$id/edit` use the $id segment, not "edit".
        const tail = segments[segments.length - 1]
        const id =
          tail === "edit" ? segments[segments.length - 2] : tail
        return {
          title: `${pat.noun ?? humanize(lastSegment(pathname))} #${id}`,
          iconKey: pat.iconKey,
        }
      }

      return fallback(pathname)
    },
  }
}
