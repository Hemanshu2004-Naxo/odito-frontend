"use client"

import { useProject } from "@/contexts/ProjectContext"
import RecrawlCard from "@/components/settings/RecrawlCard"
import WeeklyRecheckCard from "@/components/settings/WeeklyRecheckCard"
import DangerZoneCard from "@/components/settings/DangerZoneCard"
import SettingsTabs from "@/components/settings/SettingsTabs"
import BusinessInformationSection from "@/components/settings/business/BusinessInformationSection"

export default function SettingsPageContent() {
  const { activeProject } = useProject()

  return (
    <div className="space-y-6">
      <SettingsTabs />

      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Project Settings</h1>
        <p className="text-muted-foreground">
          {activeProject?.project_name || activeProject?.name || "Manage recrawls and rechecks for this project"}
        </p>
      </div>

      {!activeProject ? (
        <div className="rounded-xl border p-8 text-center space-y-2">
          <p className="text-muted-foreground">Select a project to manage its settings.</p>
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <div className="space-y-3">
            <h2 className="text-foreground text-lg font-semibold">Business Information</h2>
            <BusinessInformationSection key={activeProject._id} projectId={activeProject._id} />
          </div>
          {/* Keyed by project so a previous project's recrawl error/progress state never leaks into the next one. */}
          <RecrawlCard key={activeProject._id} project={activeProject} />
          <WeeklyRecheckCard project={activeProject} />
          <DangerZoneCard project={activeProject} />
        </div>
      )}
    </div>
  )
}
