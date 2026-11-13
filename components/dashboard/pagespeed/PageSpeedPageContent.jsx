"use client"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useProject } from "@/contexts/ProjectContext"
import { useQueryClient } from "@tanstack/react-query"
import { usePageSpeedData, usePageSpeedStatus, usePageSpeedRescan } from '@/hooks/useDashboardQueries'
import { PageSpeedSkeleton } from "@/components/skeletons/pagespeed"
import DeviceTabs from "@/components/dashboard/pagespeed/DeviceTabs"
import PerformanceRing from "@/components/dashboard/pagespeed/PerformanceRing"
import CoreMetricsExplained from "@/components/dashboard/pagespeed/CoreMetricsExplained"
import ScoreBreakdown from "@/components/dashboard/pagespeed/ScoreBreakdown"
import ScoreSummary from "@/components/dashboard/pagespeed/ScoreSummary"
import FieldDataCard from "@/components/dashboard/pagespeed/FieldDataCard"
import PageWeightCard from "@/components/dashboard/pagespeed/PageWeightCard"
import FixPlan from "@/components/dashboard/pagespeed/FixPlan"
import { buildScoreBreakdown, buildFieldSummary, describeLab } from "@/lib/pagespeed/metrics"
import { buildActionPlan, buildPageWeight } from "@/lib/pagespeed/actionPlan"

// Get performance score color
const getScoreColor = (score) => {
  if (score >= 90) return { color: '#10ffa0', color2: '#00e5ff', status: 'good' }
  if (score >= 50) return { color: '#ffbb33', color2: '#ff8c1a', status: 'needs_improvement' }
  return { color: '#ff4560', color2: '#ff1744', status: 'poor' }
}


// ---------------------------------------------------------------------------
// Shared button style helpers
// ---------------------------------------------------------------------------
const btnBase = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', border: 'none', borderRadius: 6,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'opacity .15s',
}
const btnPrimary  = { ...btnBase, background: 'var(--primary)', color: '#fff' }
const btnDisabled = { ...btnBase, background: 'var(--surface2)', color: 'var(--text3)', cursor: 'not-allowed', opacity: .6 }
const btnDanger   = { ...btnBase, background: 'rgba(255,69,96,.12)', color: 'var(--red)', border: '1px solid rgba(255,69,96,.25)' }

function RescanButton({ onClick, disabled, label = 'Rescan', icon = '↺' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={disabled ? btnDisabled : btnPrimary}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// State 1 — No data
// ---------------------------------------------------------------------------
function NoDataState({ onRescan, isRescanning }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No PageSpeed results found</div>
      <div style={{ color: 'var(--text3)', marginBottom: 28, fontSize: 14 }}>
        The PageSpeed analysis has not been completed yet.
      </div>
      <RescanButton
        onClick={onRescan}
        disabled={isRescanning}
        label={isRescanning ? 'Starting scan…' : 'Run PageSpeed Scan'}
        icon="⚡"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// State 2 — Failed
// ---------------------------------------------------------------------------
function FailedState({ statusData, onRescan, isRescanning }) {
  const ts = statusData?.last_run_at
    ? new Date(statusData.last_run_at).toLocaleString()
    : null

  const errorMsg = statusData?.last_error
    || statusData?.mobile_error
    || statusData?.desktop_error
    || 'Unknown error'

  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--red)' }}>
        PageSpeed scan failed
      </div>
      <div style={{
        background: 'rgba(255,69,96,.08)', border: '1px solid rgba(255,69,96,.2)',
        borderRadius: 8, padding: '12px 20px', margin: '16px auto', maxWidth: 480,
        fontSize: 13, color: 'var(--red)', textAlign: 'left', wordBreak: 'break-word',
      }}>
        {errorMsg}
      </div>
      {ts && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>
          Last attempted: {ts}
        </div>
      )}
      <RescanButton
        onClick={onRescan}
        disabled={isRescanning}
        label={isRescanning ? 'Starting…' : 'Retry Scan'}
        icon="↺"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// State 3 — Running
// ---------------------------------------------------------------------------
function RunningState() {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>
        <span style={{
          display: 'inline-block',
          animation: 'spin 1.2s linear infinite',
        }}>⚡</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        PageSpeed scan in progress…
      </div>
      <div style={{ color: 'var(--text3)', marginBottom: 28, fontSize: 14 }}>
        Fetching mobile and desktop metrics from Google PageSpeed Insights.
      </div>
      <div style={{
        width: 200, height: 4, background: 'var(--surface2)',
        borderRadius: 4, margin: '0 auto', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: '40%', borderRadius: 4,
          background: 'var(--primary)',
          animation: 'psProgress 1.8s ease-in-out infinite alternate',
        }} />
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes psProgress { from { margin-left: 0 } to { margin-left: 60% } }
      `}</style>
      <button style={btnDisabled} disabled>Rescan</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function PageSpeedPageContent() {
  const [device, setDevice] = useState("mobile")
  // Desktop and Mobile are independent results - if the device we default to
  // (mobile) has no data but the other one does, auto-select the one that
  // actually has data ONCE on first load, so a partial_success scan doesn't
  // strand the user on a dead-end "no data" message for the missing device.
  // Guarded so it never fights a manual tab click after that.
  const autoSelectedRef = useRef(false)
  const queryClient = useQueryClient()
  const { activeProjectId, isLoading: projectLoading } = useProject()

  const { data: pagespeedResponse, isLoading: dataLoading } = usePageSpeedData(activeProjectId)
  const { data: statusResponse, isLoading: statusLoading } = usePageSpeedStatus(activeProjectId, { enabled: !!activeProjectId })
  const rescanMutation = usePageSpeedRescan(activeProjectId)

  const pagespeedData = pagespeedResponse?.data || pagespeedResponse
  const statusData    = statusResponse?.data

  useEffect(() => {
    if (autoSelectedRef.current || !pagespeedData) return
    autoSelectedRef.current = true
    if (device === 'mobile' && !pagespeedData.mobile && pagespeedData.desktop) {
      setDevice('desktop')
    }
  }, [pagespeedData, device])

  // ── WebSocket: listen for real-time pagespeed events ──────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !activeProjectId) return
    const socket = window.__socket
    if (!socket) return

    const onCompleted = () => {
      queryClient.invalidateQueries({ queryKey: ['pagespeed', activeProjectId] })
      queryClient.invalidateQueries({ queryKey: ['pagespeed', activeProjectId, 'status'] })
      queryClient.refetchQueries({ queryKey: ['pagespeed', activeProjectId] })
    }
    const onFailed = () => {
      queryClient.invalidateQueries({ queryKey: ['pagespeed', activeProjectId, 'status'] })
    }

    socket.on('pagespeed:completed', onCompleted)
    socket.on('pagespeed:failed',    onFailed)
    return () => {
      socket.off('pagespeed:completed', onCompleted)
      socket.off('pagespeed:failed',    onFailed)
    }
  }, [activeProjectId, queryClient])

  // ── Explainer data for the selected device (pure, from the stored scan) ──
  const deviceData = pagespeedData?.[device] || null
  const explained = useMemo(() => {
    if (!deviceData) return null
    return {
      breakdown: buildScoreBreakdown(deviceData),
      field: buildFieldSummary(deviceData),
      plan: buildActionPlan(deviceData, { domain: pagespeedData?.domain }),
      weight: buildPageWeight(deviceData),
    }
  }, [deviceData, pagespeedData?.domain])

  // Which fix-plan items are expanded; reset when switching device.
  const [openIds, setOpenIds] = useState(() => new Set())
  useEffect(() => { setOpenIds(new Set()) }, [device])
  const toggleItem = useCallback((id) => {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])
  const jumpToItem = useCallback((id) => {
    setOpenIds(prev => new Set(prev).add(id))
    requestAnimationFrame(() => {
      const el = document.getElementById(`psx-item-${id}`)
      if (!el) return
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      el.querySelector('button')?.focus({ preventScroll: true })
    })
  }, [])

  // ── Derive UI state ────────────────────────────────────────────────────────
  const loading       = dataLoading || projectLoading || statusLoading
  const isRunning     = statusData?.is_running === true || statusData?.scan_status === 'running'
  const hasFailed     = !isRunning && statusData?.scan_status === 'failed'
  const hasData       = !!(pagespeedData?.mobile || pagespeedData?.desktop)
  const isRescanning  = rescanMutation.isPending

  const handleRescan = () => {
    if (isRescanning || isRunning) return
    rescanMutation.mutate()
  }

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!activeProjectId) return null
  if (loading) return <PageSpeedSkeleton />

  // State 3 — Running (show over stale data so user sees progress)
  if (isRunning) return <RunningState />

  // State 2 — Failed AND no previous data to display
  if (hasFailed && !hasData) {
    return <FailedState statusData={statusData} onRescan={handleRescan} isRescanning={isRescanning} />
  }

  // State 1 — No data at all
  if (!hasData) {
    return <NoDataState onRescan={handleRescan} isRescanning={isRescanning} />
  }

  // ── State 4 — Completed (show data) ───────────────────────────────────────
  // currentDeviceData can be null for the CURRENTLY SELECTED tab even though
  // hasData is true overall (e.g. partial_success: desktop completed, mobile
  // failed). That must only affect this device's content panel below - never
  // hide the header/tabs/rescan button or the OTHER device's valid data.
  const currentDeviceData = pagespeedData[device]

  const deviceStatusField = device === 'mobile' ? statusData?.mobile_status : statusData?.desktop_status
  const deviceErrorField  = device === 'mobile' ? statusData?.mobile_error  : statusData?.desktop_error
  const deviceUnavailableMessage = deviceStatusField === 'failed'
    ? `${device === 'mobile' ? 'Mobile' : 'Desktop'} scan failed${deviceErrorField ? `: ${deviceErrorField}` : ''}`
    : `No ${device} data available`

  const score       = currentDeviceData ? Math.round(currentDeviceData.performance_score || 0) : 0
  const scoreColors = getScoreColor(score)
  const deviceLabel = device === 'mobile' ? 'mobile' : 'desktop'
  const { breakdown, field, plan, weight } = explained || {}

  // Partial-success warning banner (one device failed but we still have data)
  const isPartial = statusData?.scan_status === 'partial_success'
  const testedAt = pagespeedData?.tested_at ? new Date(pagespeedData.tested_at).toLocaleDateString() : null

  return (
    <div>
      {/* Header row with device tabs + rescan button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div className="section-head" style={{ margin: 0 }}>
          <div className="section-title">PageSpeed Insights</div>
          <div className="section-tag">CORE WEB VITALS</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DeviceTabs active={device} onChange={setDevice} />
          <RescanButton onClick={handleRescan} disabled={isRescanning || isRunning} />
        </div>
      </div>

      {/* Partial-success warning */}
      {isPartial && (
        <div style={{
          background: 'rgba(255,187,51,.08)', border: '1px solid rgba(255,187,51,.25)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 20,
          fontSize: 13, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ⚠️ Partial results — {statusData.mobile_status === 'failed' ? 'mobile' : 'desktop'} scan failed.
          {statusData.mobile_error || statusData.desktop_error
            ? ` (${statusData.mobile_error || statusData.desktop_error})`
            : ''
          }
        </div>
      )}

      {currentDeviceData && plan && !plan.full && (
        <div className="psx-notice" role="status">
          <span>
            This result is from an older scan. Rescan to get Google’s full list of findings
            (render-blocking files, images, caching, third-party scripts, the hero element) and real-visitor data.
          </span>
          <RescanButton onClick={handleRescan} disabled={isRescanning || isRunning} label={isRescanning ? 'Starting…' : 'Rescan now'} />
        </div>
      )}

      {!currentDeviceData ? (
        <div style={{ textAlign: 'center', padding: '64px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{deviceStatusField === 'failed' ? '❌' : '📊'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: deviceStatusField === 'failed' ? 'var(--red)' : 'var(--text3)' }}>
            {deviceUnavailableMessage}
          </div>
        </div>
      ) : (
      <>
      <div className="two-col">
        <div>
          <div className="score-card" style={{ marginBottom: 16, "--grad": scoreColors.status === 'good' ? "linear-gradient(90deg,#10ffa0,#00e5ff)" : scoreColors.status === 'needs_improvement' ? "linear-gradient(90deg,#ffbb33,#ff8c1a)" : "linear-gradient(90deg,#ff4560,#ff1744)" }}>
            <div className="score-label">Performance Score</div>
            <div style={{ position: "relative", width: 120, height: 120 }}>
              <PerformanceRing score={score} color={scoreColors.color} color2={scoreColors.color2} label={device} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, color: scoreColors.status === 'good' ? "var(--green)" : scoreColors.status === 'needs_improvement' ? "var(--orange)" : "var(--red)" }}>{score}</div>
              </div>
            </div>
            <div className="score-sub">{device === "mobile" ? "📱 Mobile" : "🖥 Desktop"}{testedAt ? ` · tested ${testedAt}` : ''}</div>
          </div>
          <ScoreSummary score={score} device={deviceLabel} breakdown={breakdown} field={field} plan={plan} />
        </div>
        <CoreMetricsExplained device={currentDeviceData} breakdown={breakdown} plan={plan} onJump={jumpToItem} />
      </div>

      <div style={{ marginTop: 24 }}>
        <ScoreBreakdown breakdown={breakdown} score={score} deviceLabel={deviceLabel} />
        <FieldDataCard field={field} labText={describeLab(currentDeviceData, device)} />
      </div>

      <FixPlan plan={plan} openIds={openIds} onToggle={toggleItem} />

      {weight && <div style={{ marginTop: 24 }}><PageWeightCard weight={weight} /></div>}

      {/* Lighthouse Scores */}
      <div className="section-head" style={{ marginTop: 32 }}>
        <div className="section-title">Lighthouse Scores</div>
      </div>
      <p className="psx-sub" style={{ marginTop: -6 }}>
        Accessibility, Best Practices and SEO are scored separately and do not change the performance score above.
      </p>
      <div className="cat-grid">
        {[
          { key: 'performance',   icon: '⚡', label: 'Performance',   value: Math.round(currentDeviceData.performance  || currentDeviceData.performance_score || 0) },
          { key: 'accessibility', icon: '♿', label: 'Accessibility',  value: Math.round(currentDeviceData.accessibility || 0) },
          { key: 'best_practices',icon: '✅', label: 'Best Practices', value: Math.round(currentDeviceData.best_practices || 0) },
          { key: 'seo',           icon: '🔍', label: 'SEO',            value: Math.round(currentDeviceData.seo || 0) },
        ].map(cat => {
          const s = cat.value
          const color = s >= 90 ? 'var(--green)' : s >= 50 ? 'var(--amber)' : 'var(--red)'
          return (
            <div key={cat.key} className="cat-card">
              <div style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", fontSize: 18, background: `${color}14`, flexShrink: 0 }}>{cat.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{cat.label}</div>
                <div className="prog-bar"><div className="prog-fill" style={{ width: `${s}%`, background: color }} /></div>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color }}>{s}</div>
            </div>
          )
        })}
      </div>

      {/* Passed Audits — real Lighthouse checks that scored >= 90 */}
      <div className="section-head" style={{ marginTop: 20 }}>
        <div className="section-title">Passed Audits</div>
        <div className="section-tag" style={{ background: "rgba(0,245,160,.08)", color: "var(--green)", borderColor: "rgba(0,245,160,.16)" }}>
          {plan?.passed.length || 0} PASSING
        </div>
      </div>
      <div className="pass-grid">
        {plan?.passed.length > 0 ? (
          plan.passed.map(audit => (
            <div key={audit.id} className="pass-item">
              <span style={{ color: "var(--green)" }}>✔</span>
              {audit.title}
            </div>
          ))
        ) : (
          <div className="pass-item" style={{ color: "var(--t3)" }}>
            No performance checks passed yet — see the fix plan above.
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}
