"use client"

import { useState } from "react"
import { faviconUrl } from "./format"

/** The site's favicon, decorative. If it cannot be loaded the first letter takes its place. (Its own file: tables import it without pulling in any data hook.) */
export function Favicon({ domain }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span className="grid size-5 shrink-0 place-items-center rounded bg-muted text-[10px] font-semibold uppercase" aria-hidden>{domain.charAt(0)}</span>
  }
  // eslint-disable-next-line @next/next/no-img-element -- a 16px third-party icon: next/image would add a proxy hop for nothing
  return <img src={faviconUrl(domain)} alt="" width={16} height={16} loading="lazy" referrerPolicy="no-referrer" className="size-4 shrink-0 rounded-sm" onError={() => setFailed(true)} />
}

export default Favicon
