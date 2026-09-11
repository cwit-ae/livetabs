# Changelog

Per-package changelogs live alongside each package:

- [`@live-tabs/core`](./packages/core/CHANGELOG.md)
- [`@live-tabs/tanstack-router`](./packages/tanstack-router/CHANGELOG.md)
- [`@live-tabs/next`](./packages/next/CHANGELOG.md)
- [`live-tabs`](./packages/live-tabs/CHANGELOG.md)

All packages are in one **fixed version group**, so they release together and
an adapter never drifts from the core it targets.

## Unreleased

**`@live-tabs/next` — a Next.js App Router adapter.** Client-side workspace
tabs with kept-alive pages, without taking over the Next router. Next keeps
owning navigation and the URL; live-tabs owns what the workspace area renders.
Paths you don't register keep rendering through Next untouched.

**Tab groups** in `@live-tabs/core`, inherited by every adapter. Create,
rename, recolour, collapse, expand, delete, and move tabs between groups.
Collapsing hides a group's tabs from the bar without unmounting their pages.

**Opt-in session persistence.** A `persist` prop restores the tab strip across
reloads — titles, order, groups, collapsed state. Page state is never restored,
because a kept-alive React subtree cannot be serialised; restored tabs are
flagged `restored` until visited so the difference is visible rather than
implied.

**The keep-alive engine was split.** Its router-agnostic half moved from
`@live-tabs/tanstack-router` into `@live-tabs/core` so both adapters share one
implementation. `@live-tabs/tanstack-router`'s public API is unchanged — same
17 exports, same names, same signatures.

**Idle eviction for inactive tabs.** Hidden tabs can now be released after an
idle timeout, so a long-lived workspace does not grow without bound. The tab
stays in the bar; only its subtree is freed, and revisiting remounts it fresh.
Off by default — silently discarding state is the opposite of what this library
is for, so it has to be asked for.

### Compatibility

No export was removed or renamed from any published package. The tab store
behaves identically to 0.1.0 for every pre-existing operation, checked by a
differential harness that runs the published build and the new build through
the same scenarios and diffs the results.

See each package's changelog for detail.
