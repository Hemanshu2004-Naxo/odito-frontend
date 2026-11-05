"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Info, X } from "lucide-react"
import { ANCHOR_TYPES } from "@/lib/anchors/anchorConfig"
import { useProject } from "@/contexts/ProjectContext"
import { useAnchors } from "@/hooks/useAnchors"
import { useToastQueue } from "@/hooks/useToastQueue"
import ToastStack from "@/components/shared/ToastStack"
import { ErrorNote } from "@/components/dashboard/shared/parts"
import { domainFromUrl, formatExact } from "../domain-overview/format"
import AnchorSettingsDialog from "./AnchorSettingsDialog"
import AnchorsHeader from "./AnchorsHeader"
import { AnchorCloud, AnchorDetail, AnchorMix, SpamBanner } from "./AnchorSections"
import { buildCloud, buildMixAdvice, buildMixRows, buildSpamSummary, isSpamRow } from "./anchorMix"
import { anchorsCsvFileName, buildAnchorsCsv, downloadCsv } from "./exportCsv"
import { SETTINGS_BANNER } from "./constants"

const COLORS = Object.fromEntries(Object.values(ANCHOR_TYPES).map((t) => [t.key, t.color]))
const CLOUD_STEP = 14

/**
 * Anchors for the selected project: the anchor texts other sites link with, sorted into types (branded, keyword match, partial match,
 * naked URL, generic, empty, phrases) from the project's brand terms and target keywords.
 *
 * Everything on the page comes from ONE cached profile call (the top 1,000 anchors by linking sites) and is recalculated in the browser
 * when the brand terms or keywords change: the mix against typical ranges, the spammy-anchor banner, the cloud and the detail panel.
 */
export default function AnchorsDashboard() {
  const { activeProject } = useProject()
  const projectId = activeProject?._id
  if (!projectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Anchors</h1>
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">Select a project to see its anchors.</div>
      </div>
    )
  }
  // Keyed by project: nothing about the previous project's filters, chosen anchor or settings dialog carries over.
  return <ProjectAnchors key={projectId} projectId={projectId} project={activeProject} />
}

const bannerKey = (projectId) => `odito:anchors:settings-banner:${projectId}`
const readDismissed = (projectId) => { try { return window.localStorage.getItem(bannerKey(projectId)) === "1" } catch { return false } }

function ProjectAnchors({ projectId, project }) {
  const projectDomain = domainFromUrl(project?.main_url)
  const an = useAnchors(projectId, projectDomain, { withTable: false })
  const { profile, settings } = an
  const domain = an.target ?? projectDomain
  const { toasts, notify, dismiss } = useToastQueue()
  const [refreshClicked, setRefreshClicked] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(() => readDismissed(projectId))
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState(null) // a type key, "spam", or null
  const [limit, setLimit] = useState(CLOUD_STEP)
  const [selectedId, setSelectedId] = useState(null)
  const cloudRef = useRef(null)

  // "No brand terms or target keywords": until the project has some of each, the types cannot be accurate.
  const needsSettings = settings.status !== "loading" && (!settings.saved || settings.settings.targetKeywords.length === 0)
  const showBanner = needsSettings && !bannerDismissed
  const dismissBanner = () => {
    setBannerDismissed(true)
    try { window.localStorage.setItem(bannerKey(projectId), "1") } catch { /* the banner just comes back next time */ }
  }
  useEffect(() => { setBannerDismissed(readDismissed(projectId)) }, [projectId])

  const refreshNote = refreshClicked && !an.isFetching && an.refreshThrottled ? "This data was refreshed less than a minute ago, so it was not requested again." : null

  const mixRows = useMemo(
    () => buildMixRows(profile.summary, { domain, brandTerms: settings.settings.brandTerms ?? [], targetKeywords: settings.settings.targetKeywords ?? [] }),
    [profile.summary, domain, settings.settings],
  )
  const spam = useMemo(() => buildSpamSummary(profile.rows), [profile.rows])
  const advice = buildMixAdvice(mixRows, { brand: settings.settings.brandTerms?.[0] ?? null, spam })
  const cloud = useMemo(() => buildCloud(profile.rows, { query, type: typeFilter, limit }), [profile.rows, query, typeFilter, limit])

  // The panel shows the anchor that was clicked; until then the biggest spammy one (the one to act on), else the biggest of all.
  const fallback = useMemo(() => {
    const sorted = [...profile.rows].sort((a, b) => (b.referringDomains ?? -1) - (a.referringDomains ?? -1))
    return sorted.find(isSpamRow) ?? sorted[0] ?? null
  }, [profile.rows])
  const selected = profile.rows.find((r) => r.id === selectedId) ?? fallback

  const chooseType = (t) => {
    setTypeFilter((cur) => (cur === t ? null : t))
    setLimit(CLOUD_STEP)
    cloudRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
  }

  const exportAll = () => {
    downloadCsv(anchorsCsvFileName(domain, "all"), buildAnchorsCsv(profile.rows))
    notify(`Exported ${formatExact(profile.rows.length)} anchors.`, "success")
  }

  const noDomain = profile.status === "error" && profile.error?.code === "INVALID_TARGET"

  return (
    <div className="space-y-5">
      <AnchorsHeader
        domain={domain}
        updatedAt={an.updatedAt}
        total={profile.status === "success" ? (profile.total ?? profile.rows.length) : null}
        onRefresh={() => { setRefreshClicked(true); an.refresh() }}
        busy={an.isFetching}
        refreshing={refreshClicked && an.isFetching}
        refreshNote={refreshNote}
        exportDisabled={profile.status !== "success" || !profile.rows.length}
        onExport={exportAll}
        onSettings={() => setSettingsOpen(true)}
      />

      {noDomain ? (
        <ErrorNote>This project&apos;s website URL does not have a public domain name, so its anchors cannot be loaded. Update the project URL in Settings.</ErrorNote>
      ) : (
        <>
          {showBanner ? (
            <div className="flex items-start gap-3 rounded-xl border border-sky-300/60 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100" role="status" data-testid="an-settings-banner">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="flex-1">
                {SETTINGS_BANNER}{" "}
                <button type="button" onClick={() => setSettingsOpen(true)} className="font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Anchor settings</button>
              </p>
              <button type="button" onClick={dismissBanner} aria-label="Dismiss" className="grid size-6 shrink-0 place-items-center rounded hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-sky-500/20" data-testid="an-banner-dismiss">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}

          <AnchorMix profile={profile} rows={mixRows} advice={advice} typeFilter={typeFilter} onType={chooseType} />
          <SpamBanner spam={spam} onShow={() => chooseType("spam")} />

          <div ref={cloudRef} className="grid scroll-mt-4 items-start gap-4 @min-[1100px]/main:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <AnchorCloud
              profile={profile}
              cloud={cloud}
              query={query}
              onQuery={(q) => { setQuery(q); setLimit(CLOUD_STEP) }}
              typeFilter={typeFilter}
              onClearType={() => setTypeFilter(null)}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              onMore={() => setLimit((l) => l + CLOUD_STEP * 2)}
              colors={COLORS}
            />
            {profile.status === "success" ? <AnchorDetail row={selected} status="live" colors={COLORS} /> : null}
          </div>

          <p className="text-xs text-muted-foreground">Data from the DataForSEO Backlinks API (backlinks/anchors), live links. Typical ranges are a general guide for natural link profiles.</p>

          <AnchorSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            api={settings}
            profileRows={profile.rows}
            targetDomain={projectDomain}
            onSaved={() => notify("Anchor settings saved. The anchor types were updated.", "success")}
          />
        </>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
