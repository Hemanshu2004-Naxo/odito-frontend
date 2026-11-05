"use client"

import { usePathname } from "next/navigation"
import { useProject } from "@/contexts/ProjectContext"
import { ProjectScanBar } from "./ProjectScanBar"
import { scopeForPath } from "./scanScope"

/**
 * The page's data is what Odito STORED at its last scan: opening a page never buys anything. This bar says how old that is, shows a scan
 * while it runs (the state lives in the database, so a reload keeps it), and is the one place a scan is started or a failed one retried.
 * Renders nothing outside the SEO data pages.
 */
export default function SeoScanBar() {
  const pathname = usePathname()
  const scope = scopeForPath(pathname)
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!scope || !projectId) return null
  return <ProjectScanBar key={projectId} projectId={projectId} scope={scope} />
}

