# @live-tabs/core

Router-agnostic core for [live-tabs](https://github.com/live-tabs/live-tabs) —
browser-style workspace tabs with kept-alive pages.

This package has **no router dependency**. It provides:

- `createWorkspaceTabsStore` — the open-tabs store (Zustand).
- `createTabRegistry` — a path → `{ title, iconKey }` resolver.
- `TabStrip`, `Tab`, `TabClose` — headless, unstyled tab primitives.
- `WorkspaceProvider`, `WorkspaceTabBar`, `useSetTabTitle`, `useAutoOpenTab` —
  driven by a `RouterAdapter` you supply.
- The `RouterAdapter` interface itself (`useAdapter`, `RouterAdapterProvider`).

You normally don't install this directly — use a router adapter package such as
[`@live-tabs/tanstack-router`](https://www.npmjs.com/package/@live-tabs/tanstack-router)
(or the [`live-tabs`](https://www.npmjs.com/package/live-tabs) umbrella), which
re-exports everything here plus a keep-alive engine. Reach for `@live-tabs/core`
only when building a new router adapter or using the headless primitives alone.

```
npm i @live-tabs/core
```

> Peers: `react`, `react-dom`, `zustand`.

See the [main README](https://github.com/live-tabs/live-tabs#readme) for usage.

## License

MIT
