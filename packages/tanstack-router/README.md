# @livetabs/tanstack-router

[TanStack Router](https://tanstack.com/router) adapter for
[livetabs](https://github.com/livetabs/livetabs) — browser-style workspace tabs
whose pages stay **alive** (scroll, form input, query state preserved) across
switches.

Re-exports everything from [`@livetabs/core`](https://www.npmjs.com/package/@livetabs/core),
plus:

- The keep-alive engine: `KeepAliveProvider`, `KeepAliveOutlet`, `useKeepAlive`,
  `useActiveEffect`.
- A pre-wired `WorkspaceProvider` (TanStack adapter + keep-alive baked in).
- `tanstackRouterAdapter` (the `RouterAdapter` implementation).

```
npm i @livetabs/tanstack-router
```

> Peers: `@tanstack/react-router` (>=1.150), `react`, `react-dom`, `zustand`.

The [`livetabs`](https://www.npmjs.com/package/livetabs) umbrella is the same
thing under a shorter name — `npm i livetabs`. See the
[main README](https://github.com/livetabs/livetabs#readme) for the full guide.

## License

MIT
