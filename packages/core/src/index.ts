// @live-tabs/core — router-agnostic workspace tabs. Pair with a router
// adapter package (e.g. @live-tabs/tanstack-router) for navigation + keep-alive.

export { createWorkspaceTabsStore } from "./store"
export type {
  WorkspaceTab,
  WorkspaceTabsState,
  WorkspaceTabsOptions,
  WorkspaceTabsStore,
} from "./store"

export { createTabRegistry } from "./registry"
export type {
  TabMeta,
  TabRegistry,
  TabRegistryOptions,
  StaticTabRoutes,
  DynamicTabPattern,
} from "./registry"

// Router seam.
export {
  RouterAdapterProvider,
  useAdapter,
  useNoopDestroyPage,
} from "./adapter"
export type { RouterAdapter, RouterLinkProps } from "./adapter"

// Provider + hooks.
export {
  WorkspaceProvider,
  useWorkspaceContext,
  useWorkspaceTabsStore,
  useWorkspaceTabs,
} from "./provider"
export type { WorkspaceProviderProps } from "./provider"
export { useAutoOpenTab } from "./hooks/use-auto-open-tab"
export { useSetTabTitle } from "./hooks/use-set-tab-title"

// Components (headless primitives + the batteries-included bar).
export { WorkspaceTabBar } from "./components/workspace-tab-bar"
export type {
  WorkspaceTabBarProps,
  WorkspaceTabBarClassNames,
} from "./components/workspace-tab-bar"
export { TabStrip } from "./components/tab-strip"
export type { TabStripProps } from "./components/tab-strip"
export { Tab } from "./components/tab"
export type { TabProps } from "./components/tab"
export { TabClose } from "./components/tab-close"
export type { TabCloseProps } from "./components/tab-close"
