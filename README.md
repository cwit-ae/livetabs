# live-tabs

**Browser-style workspace tabs with kept-alive pages.** Open pages in tabs and
switch between them without losing scroll, form input, filters, or in-flight
queries — each page's React subtree stays mounted off-screen.

This is the monorepo. Most users just want the published package:

```
npm i live-tabs        # core + TanStack Router adapter, batteries included
```

See **[packages/live-tabs/README.md](./packages/live-tabs/README.md)** for usage.

## Packages

| Package | Status | What |
| --- | --- | --- |
| [`@live-tabs/core`](./packages/core) | ✅ | Router-agnostic: store, registry, headless tab primitives, the `RouterAdapter` seam. No router dep. |
| [`@live-tabs/tanstack-router`](./packages/tanstack-router) | ✅ | TanStack Router adapter + the keep-alive engine. |
| [`live-tabs`](./packages/live-tabs) | ✅ | Umbrella — `npm i live-tabs` = core + TanStack adapter. |
| [`@live-tabs/react-router`](./packages/react-router) | 🚧 planned | React Router adapter + keep-alive. |
| [`@live-tabs/next`](./packages/next) | 🚧 planned | Next.js: tabs everywhere; keep-alive on Pages Router. |

## Architecture

The core is **router-agnostic**. Everything router-specific lives behind a
small `RouterAdapter` (`useLocation` / `useNavigate` / `Link` /
`useKeptPathname` / optional `useDestroyPage`). Adapter packages implement it
and ship the matching keep-alive engine; the store, registry, primitives, and
`<WorkspaceTabBar>` are reused unchanged. Adding a router = one new package, no
changes to `@live-tabs/core`.

```
@live-tabs/core  ◄── @live-tabs/tanstack-router ◄── live-tabs (umbrella)
                ◄── @live-tabs/react-router      (planned)
                ◄── @live-tabs/next              (planned)
```

## Develop

```
npm install          # installs all workspaces
npm run build        # builds core → tanstack-router → live-tabs (in order)
npm run typecheck    # tsc across all packages
npm test             # run the test suite (Vitest)
npm run lint:pkg     # validate package publish-health (publint)
```

Versioning is via [changesets](./.changeset); all packages are **fixed** to one
version so adapters never drift from the core they target.

**Releasing?** See **[PUBLISHING.md](./PUBLISHING.md)** — first-time setup,
adding changesets (patch/minor/major), and the automated release flow via npm
Trusted Publishing.

## Credits

The keep-alive engine is adapted from
[`tanstack-router-keepalive`](https://github.com/hemengke1997/tanstack-router-keepalive)
(MIT). See the file headers and `LICENSE`.

## License

MIT
