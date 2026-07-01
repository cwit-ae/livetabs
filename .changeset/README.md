# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

Add a changeset when you make a user-facing change:

```
npm run changeset
```

All `@live-tabs/*` packages and `live-tabs` are **fixed** to one version (see
`config.json`), so an adapter never drifts from the core it targets. Release:

```
npm run version-packages   # bumps versions + writes CHANGELOGs
npm run release            # builds + publishes
```
