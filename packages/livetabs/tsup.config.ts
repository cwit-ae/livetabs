import { defineConfig } from "tsup"

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  // Inline the @livetabs/* types too, so the published .d.ts is self-contained.
  dts: { resolve: ["@livetabs/core", "@livetabs/tanstack-router"] },
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Bundle the @livetabs/* internals INTO the umbrella so the published
  // artifact is self-contained (no unpublished scoped deps to resolve). Only
  // the real peers stay external.
  noExternal: ["@livetabs/core", "@livetabs/tanstack-router"],
  external: ["react", "react-dom", "zustand", "@tanstack/react-router"],
})
