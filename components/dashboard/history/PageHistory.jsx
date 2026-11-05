"use client"

import { usePathname } from "next/navigation"
import { useProject } from "@/contexts/ProjectContext"
import { ProjectPageHistory } from "./ProjectPageHistory"
import { historyRouteFor } from "./routes"

/**
 * "History & data freshness" for the SEO page being viewed: how fresh each dataset of the page is, and what changed between stored scans.
 * Collapsed by default and loads nothing until opened. Every request it makes reads MongoDB; none can reach the provider.
 */
export default function PageHistory() {
  const pathname = usePathname()
  const route = historyRouteFor(pathname)
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!route || !projectId) return null
  return <ProjectPageHistory key={`${projectId}:${route.page}`} projectId={projectId} route={route} />
}
