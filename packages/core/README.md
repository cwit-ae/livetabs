# @livetabs/core

Router-agnostic core for [livetabs](https://github.com/livetabs/livetabs) —
browser-style workspace tabs with kept-alive pages.

This package has **no router dependency**. It provides:

- `createWorkspaceTabsStore` — the open-tabs store (Zustand).
- `createTabRegistry` — a path → `{ title, iconKey }` resolver.
- `TabStrip`, `Tab`, `TabClose` — headless, unstyled tab primitives.
- `WorkspaceProvider`, `WorkspaceTabBar`, `useSetTabTitle`, `useAutoOpenTab` —
  driven by a `RouterAdapter` you supply.
- The `RouterAdapter` interface itself (`useAdapter`, `RouterAdapterProvider`).

You normally don't install this directly — use a router adapter package such as
[`@livetabs/tanstack-router`](https://www.npmjs.com/package/@livetabs/tanstack-router)
(or the [`livetabs`](https://www.npmjs.com/package/livetabs) umbrella), which
re-exports everything here plus a keep-alive engine. Reach for `@livetabs/core`
only when building a new router adapter or using the headless primitives alone.

```
npm i @livetabs/core
```

> Peers: `react`, `react-dom`, `zustand`.

See the [main README](https://github.com/livetabs/livetabs#readme) for usage.

## License

MIT
