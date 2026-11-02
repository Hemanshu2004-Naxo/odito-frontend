"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import CompetitorsDashboard from "./CompetitorsDashboard"
import YourCompetitorsComparison from "./YourCompetitorsComparison"
import LocalCompetitorsTab from "./LocalCompetitorsTab"
import MyCompetitorsTab from "./MyCompetitorsTab"

/**
 * The Competitors page, three views of the same idea:
 *   SEO competitors    opens on YOUR competitors (only the ones you added) compared with you: who is ahead, who is behind. "Find more
 *                      competitors" opens the original discovery list (every site that ranks for the same searches as you, with Add buttons)
 *   Local competitors  real businesses near yours, from Google (searched only when you press Search)
 *   My competitors     the ones you chose; the same business found in any view is one record
 */
export default function CompetitorsTabs() {
  const [tab, setTab] = useState("seo")
  const [seoView, setSeoView] = useState("yours") // "yours" | "discover"
  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6">
      <TabsList aria-label="Competitor views" className="w-full sm:w-fit">
        <TabsTrigger value="seo" data-testid="cp-tab-seo">SEO competitors</TabsTrigger>
        <TabsTrigger value="local" data-testid="cp-tab-local">Local competitors</TabsTrigger>
        <TabsTrigger value="mine" data-testid="cp-tab-mine">My competitors</TabsTrigger>
      </TabsList>
      <TabsContent value="seo">
        {seoView === "yours" ? (
          <YourCompetitorsComparison onFindMore={() => setSeoView("discover")} onOpenMine={() => setTab("mine")} />
        ) : (
          <div className="space-y-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSeoView("yours")} data-testid="yc-back">&larr; Back to your competitors</Button>
            <CompetitorsDashboard />
          </div>
        )}
      </TabsContent>
      <TabsContent value="local"><LocalCompetitorsTab /></TabsContent>
      <TabsContent value="mine"><MyCompetitorsTab /></TabsContent>
    </Tabs>
  )
}
