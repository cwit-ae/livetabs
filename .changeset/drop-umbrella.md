---
"@live-tabs/core": patch
"@live-tabs/tanstack-router": patch
"@live-tabs/next": patch
---

Drop the `live-tabs` umbrella package and correct the docs that pointed at it.

npm refuses the name: it is too similar to `livetabs`, an unrelated package
published in 2024 by a third party. Both spellings are therefore unavailable,
and no retry will change that. The umbrella existed only to offer a shorter
install name, so it has been removed rather than renamed —
`@live-tabs/tanstack-router` is already the batteries-included install, and it
re-exports `@live-tabs/core` in full.

Nothing breaks: `live-tabs` was never published, so no one could depend on it.

This release only corrects documentation. `@live-tabs/core@0.2.0` and
`@live-tabs/tanstack-router@0.2.0` shipped READMEs telling readers to install
`live-tabs`, which can never exist.

Removing the umbrella also retires a real footgun it introduced: it inlined
`@live-tabs/core`, so mixing `live-tabs` with direct `@live-tabs/*` imports
produced two copies of the keep-alive event bus and `useActiveEffect` silently
stopped firing in background tabs. With one way to install, that cannot happen.

Its build-artifact test moves to `@live-tabs/tanstack-router`, where it now
guards the package boundary instead: `@live-tabs/core` is external there, so
`<OffScreen>` and `useActiveEffect` must resolve the same emitter module.

Unrelated to the rename: the test matrix now runs against Next 16. The declared
peer range is unchanged (`next >=14`).
