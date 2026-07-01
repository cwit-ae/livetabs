# @live-tabs/tanstack-router

[TanStack Router](https://tanstack.com/router) adapter for
[live-tabs](https://github.com/live-tabs/live-tabs) — browser-style workspace tabs
whose pages stay **alive** (scroll, form input, query state preserved) across
switches.

Re-exports everything from [`@live-tabs/core`](https://www.npmjs.com/package/@live-tabs/core),
plus:

- The keep-alive engine: `KeepAliveProvider`, `KeepAliveOutlet`, `useKeepAlive`,
  `useActiveEffect`.
- A pre-wired `WorkspaceProvider` (TanStack adapter + keep-alive baked in).
- `tanstackRouterAdapter` (the `RouterAdapter` implementation).

```
npm i @live-tabs/tanstack-router
```

> Peers: `@tanstack/react-router` (>=1.150), `react`, `react-dom`, `zustand`.

The [`live-tabs`](https://www.npmjs.com/package/live-tabs) umbrella is the same
thing under a shorter name — `npm i live-tabs`. See the
[main README](https://github.com/live-tabs/live-tabs#readme) for the full guide.

## License

MIT
