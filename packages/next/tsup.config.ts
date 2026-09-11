import { defineConfig } from "tsup"

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Rollup's treeshake pass hoists away module-level directives (it warns
  // "use client ... was ignored"), which would leave the package unusable
  // from a Server Component. Bundle size is negligible here and consumers
  // treeshake again downstream, so trade it for a correct directive.
  treeshake: false,
  // "use client" must survive bundling — Next reads it from the shipped file.
  banner: { js: '"use client"' },
  external: ["react", "react-dom", "zustand", "next", "@live-tabs/core"],
})
