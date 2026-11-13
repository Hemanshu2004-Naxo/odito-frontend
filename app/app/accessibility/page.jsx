"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useProject } from "@/contexts/ProjectContext"
import OnPageIssuesView from "@/components/dashboard/issues/OnPageIssuesView"
import IssueDetailView from "@/components/dashboard/issues/IssueDetailView"
import PageDetailView from "@/app/onpage/components/PageDetailView"
import { useAccessibilityIssues, usePageIssues } from '@/hooks/useDashboardQueries'

// Nothing on this screen is written for the user automatically, so every issue is "You".
const NO_AUTO_FIX = new Set()

function AccessibilityContent() {
  const { activeProject } = useProject()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedUrl, setSelectedUrl] = useState(null)

  const { data: accessibilityResponse, isLoading: loading } = useAccessibilityIssues(activeProject?._id)
  const { data: pageIssuesData, isLoading: pageLoading, error: pageError } = usePageIssues(activeProject?._id, selectedUrl)

  const issues = useMemo(() => accessibilityResponse?.issues || [], [accessibilityResponse])
  const summary = accessibilityResponse?.summary || null

  if (loading) {
    return (
      <div className="space-y-4 skeleton-fade-in">
        <div className="w-48 h-8 skeleton-base skeleton-shimmer rounded" />
        <div className="rounded-xl border p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full h-12 skeleton-base skeleton-shimmer rounded" />
          ))}
        </div>
      </div>
    )
  }

  const pageData = pageIssuesData?.data ? (() => {
    const issuesData = pageIssuesData.data
    const pageIssues = issuesData.issues || []
    const pData = issuesData.page_data || {}
    const pageMetadata = issuesData.page_metadata || {}

    return {
      url: selectedUrl,
      name: pData.title ? pData.title.split(' | ')[0] : derivePageNameFromUrl(selectedUrl),
      title: pData.title || derivePageNameFromUrl(selectedUrl),
      description: pData.meta_description || pageMetadata.meta_description || 'No meta description available',
      statusCode: pData.status_code || pageMetadata.http_status_code || 200,
      wordCount: pData.word_count || 0,
      loadTime: pData.response_time ? `${Math.round(pData.response_time)}ms` : '0s',
      issues: {
        crit: pageIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length,
        warn: pageIssues.filter(i => i.severity === 'warning' || i.severity === 'medium').length,
        low: pageIssues.filter(i => i.severity === 'low').length,
        pass: pageIssues.filter(i => i.severity === 'pass' || i.severity === 'info').length,
      },
      issues_list: pageIssues
    }
  })() : null

  const issueCode  = searchParams.get('issue')
  const urlParam   = searchParams.get('url')
  const modeParam  = searchParams.get('mode')
  const selectedIssue = issueCode ? issues.find(issue => issue.issue_code === issueCode) : null
  const selected = selectedIssue ? issues.findIndex(issue => issue.issue_code === issueCode) : null

  const handleIssueSelect = (index) => {
    const issue = issues[index]
    if (selected === index) {
      router.push('/app/accessibility')
    } else {
      router.push(`/app/accessibility?issue=${issue.issue_code}`)
    }
  }

  const derivePageNameFromUrl = (url) => {
    if (url === '/' || url === '') return 'Home'
    const segments = url.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1]
    return lastSegment ? lastSegment.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ') : 'Page'
  }

  return (
    <div className="space-y-6">
      {selectedUrl ? (
        <PageDetailView
          url={selectedUrl}
          pageData={pageData}
          loading={pageLoading}
          error={pageError}
          onBack={() => setSelectedUrl(null)}
        />
      ) : selectedIssue ? (
        <IssueDetailView
          issue={selectedIssue}
          onBack={() => router.push('/app/accessibility')}
          onOpenUrl={(url) => setSelectedUrl(url)}
          issueTypeName="Accessibility Issues"
          initialSelUrl={urlParam || null}
          initialMode={modeParam || 'ai'}
        />
      ) : (
        <OnPageIssuesView
          issues={issues}
          summary={summary}
          projectId={activeProject?._id}
          autoFixIds={NO_AUTO_FIX}
          title="Accessibility issues"
          crumb="Accessibility"
          emptyMessage="No accessibility issues found. Your site looks great!"
          onOpenIssue={(code, url) =>
            router.push(`/app/accessibility?issue=${encodeURIComponent(code)}${url ? `&url=${encodeURIComponent(url)}` : ""}`)
          }
        />
      )}
    </div>
  )
}

export default function AccessibilityPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4 skeleton-fade-in">
        <div className="w-48 h-8 skeleton-base skeleton-shimmer rounded" />
        <div className="rounded-xl border p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full h-12 skeleton-base skeleton-shimmer rounded" />
          ))}
        </div>
      </div>
    }>
      <AccessibilityContent />
    </Suspense>
  )
}
