# livetabs

**Browser-style workspace tabs with kept-alive pages.** Open pages in tabs and
switch between them without losing scroll, form input, filters, or in-flight
queries — each page's React subtree stays mounted off-screen.

This is the monorepo. Most users just want the published package:

```
npm i livetabs        # core + TanStack Router adapter, batteries included
```

See **[packages/livetabs/README.md](./packages/livetabs/README.md)** for usage.

## Packages

| Package | Status | What |
| --- | --- | --- |
| [`@livetabs/core`](./packages/core) | ✅ | Router-agnostic: store, registry, headless tab primitives, the `RouterAdapter` seam. No router dep. |
| [`@livetabs/tanstack-router`](./packages/tanstack-router) | ✅ | TanStack Router adapter + the keep-alive engine. |
| [`livetabs`](./packages/livetabs) | ✅ | Umbrella — `npm i livetabs` = core + TanStack adapter. |
| [`@livetabs/react-router`](./packages/react-router) | 🚧 planned | React Router adapter + keep-alive. |
| [`@livetabs/next`](./packages/next) | 🚧 planned | Next.js: tabs everywhere; keep-alive on Pages Router. |

## Architecture

The core is **router-agnostic**. Everything router-specific lives behind a
small `RouterAdapter` (`useLocation` / `useNavigate` / `Link` /
`useKeptPathname` / optional `useDestroyPage`). Adapter packages implement it
and ship the matching keep-alive engine; the store, registry, primitives, and
`<WorkspaceTabBar>` are reused unchanged. Adding a router = one new package, no
changes to `@livetabs/core`.

```
@livetabs/core  ◄── @livetabs/tanstack-router ◄── livetabs (umbrella)
                ◄── @livetabs/react-router      (planned)
                ◄── @livetabs/next              (planned)
```

## Develop

```
npm install          # installs all workspaces
npm run build        # builds core → tanstack-router → livetabs (in order)
npm run typecheck    # tsc across all packages
```

Versioning is via [changesets](./.changeset); all packages are **fixed** to one
version so adapters never drift from the core they target.

## Credits

The keep-alive engine is adapted from
[`tanstack-router-keepalive`](https://github.com/hemengke1997/tanstack-router-keepalive)
(MIT). See the file headers and `LICENSE`.

## License

MIT
