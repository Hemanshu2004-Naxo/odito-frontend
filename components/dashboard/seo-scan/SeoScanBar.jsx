"use client"

import { usePathname } from "next/navigation"
import { useProject } from "@/contexts/ProjectContext"
import { historyRouteFor } from "../history/routes"
import { DataStatusLine } from "./DataStatusLine"

/**
 * Mounted once in the app layout. On each of the nine SEO pages it keeps the page's data collected and fresh by itself (opening the page
 * asks the server what is missing or stale; a worker collects it) and shows the status line. Renders nothing outside those pages.
 */
export default function SeoScanBar() {
  const pathname = usePathname()
  const page = historyRouteFor(pathname)?.page ?? null
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!page || !projectId) return null
  return <DataStatusLine key={`${projectId}:${page}`} projectId={projectId} page={page} />
}
