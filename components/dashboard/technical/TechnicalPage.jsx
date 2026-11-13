"use client"

import { useState } from 'react'
import { useProject } from '@/contexts/ProjectContext'
import CheckList from "@/components/dashboard/technical/CheckList"
import TechCheckDetailView from "@/components/dashboard/technical/TechCheckDetailView"
import PageDetailView from "@/app/onpage/components/PageDetailView"
import { TechnicalChecksSummarySkeleton, TechnicalChecksTableSkeleton } from "@/components/skeletons/technicalchecks"
import { AlertTriangle } from 'lucide-react'
import { useTechnicalChecks, usePageIssues } from '@/hooks/useDashboardQueries'

export default function TechnicalPage() {
  const { activeProject } = useProject()
  const [selectedCheck, setSelectedCheck] = useState(null)
  const [selectedUrl, setSelectedUrl] = useState(null)

  // Use React Query for cached data fetching
  const { data: technicalResponse, isLoading: technicalLoading, error: technicalError } = useTechnicalChecks(activeProject?._id)
  const { data: pageIssuesData, isLoading: pageDetailsLoading, error: pageDetailsError } = usePageIssues(activeProject?._id, selectedUrl)

  // Extract data from API response
  const technicalData = technicalResponse?.data || technicalResponse

  // Process page data when URL is selected
  const pageData = pageIssuesData?.data ? (() => {
    const issuesData = pageIssuesData.data
    const pageIssues = issuesData.issues || []
    const pData = issuesData.page_data || {}
    const pageMetadata = issuesData.page_metadata || {}
    
    return {
      url: selectedUrl,
      name: pData.title ? pData.title.split(' | ')[0] : derivePageNameFromUrl(selectedUrl),
      title: pData.title || deriveTitleFromUrl(selectedUrl),
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

  const handleUrlSelect = (url) => {
    setSelectedUrl(url)
  }

  const handlePageDetailBack = () => {
    setSelectedUrl(null)
  }

  // Helper functions to derive values from URL when API doesn't provide them
  const derivePageNameFromUrl = (url) => {
    if (url === '/' || url === '') return 'Home'
    const segments = url.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1]
    return lastSegment ? lastSegment.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ') : 'Page'
  }

  const deriveTitleFromUrl = (url) => {
    const name = derivePageNameFromUrl(url)
    return name
  }

  if (technicalLoading) {
    return (
      <div>
        <TechnicalChecksSummarySkeleton />
        <TechnicalChecksTableSkeleton />
      </div>
    )
  }

  if (!activeProject) {
    return (
      <div className="glass-card">
        <div className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-3">No Project Selected</h3>
          <p className="text-muted-foreground mb-4">
            Please select a project to view technical checks.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Main Content */}
      {selectedUrl ? (
        <PageDetailView 
          url={selectedUrl}
          pageData={pageData}
          loading={pageDetailsLoading}
          error={pageDetailsError}
          onBack={handlePageDetailBack}
        />
      ) : selectedCheck ? (
        <TechCheckDetailView 
          check={selectedCheck} 
          onBack={() => setSelectedCheck(null)}
          onOpenUrl={handleUrlSelect}
        />
      ) : (
        <CheckList
          onSelectCheck={setSelectedCheck}
          technicalData={technicalData}
          error={technicalError}
        />
      )}
    </div>
  )
}
