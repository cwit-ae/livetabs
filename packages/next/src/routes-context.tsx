import { createContext, createElement, useContext } from "react"
import type { ReactNode } from "react"

import type { WorkspaceRoutes } from "./routes"

const WorkspaceRoutesContext = createContext<WorkspaceRoutes | null>(null)

export function WorkspaceRoutesProvider({
  value,
  children,
}: {
  value: WorkspaceRoutes
  children: ReactNode
}) {
  return createElement(WorkspaceRoutesContext.Provider, { value }, children)
}

/** The route table declared via `createWorkspaceRoutes`. */
export function useWorkspaceRoutes(): WorkspaceRoutes {
  const value = useContext(WorkspaceRoutesContext)
  if (!value) {
    throw new Error(
      "live-tabs: <WorkspaceOutlet> must be rendered inside <WorkspaceProvider routes={...}>",
    )
  }
  return value
}
