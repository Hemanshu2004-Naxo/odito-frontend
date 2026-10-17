"use client"

import { Fragment, useState } from "react"
import { useAuditIqServiceState, useSubmitAuditIqRequest } from "@/hooks/useAuditIqRequests"

/**
 * The AuditIQ tab of the issue detail page ("Let AuditIQ Fix It").
 *
 * Layout, gradients, cards, icons and badges are the original static tab's; what is new is that
 * every action does something real and tells the truth about the result:
 *
 *   Express Fix / Technical Audit + Fix / Request Expert Fix
 *       -> POST /auditiq/service-requests (stored; staff are emailed). The status shown is the one the
 *          server returns: "submitted" is shown as "awaiting review", never as done.
 *   Monthly Maintenance -> no such service exists yet, so it says so (nothing is enrolled or charged).
 *   Book a Strategy Call -> opens the operator-configured booking URL, or says booking is not configured.
 *
 * The parent keeps this mounted (hidden) once opened, so a half-written note survives switching tabs.
 */

const STATUS_LABEL = {
  submitted: "Requested — awaiting review",
  in_review: "In review",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}
const STATUS_COLOR = {
  submitted: "var(--cy)",
  in_review: "var(--vi)",
  in_progress: "var(--vi)",
  completed: "var(--gr)",
  cancelled: "var(--t3)",
}

const OPTIONS = [
  {
    type: "express_fix",
    icon: "⚡",
    title: "Express Fix",
    desc: "Request a fix for all affected pages",
    tag: "Most Popular",
    tc: "var(--cy)",
    bg: "var(--color-brand-cyan-surface)",
    noteLabel: "Notes for the team (optional)",
    notePlaceholder: "Anything the team should know — access, priorities, pages to skip…",
  },
  {
    type: "technical_audit_fix",
    icon: "🔍",
    title: "Technical Audit + Fix",
    desc: "Full review then implement fixes with docs",
    tag: "Comprehensive",
    tc: "var(--vi)",
    bg: "var(--color-brand-violet-surface)",
    noteLabel: "Notes for the team (optional)",
    notePlaceholder: "Anything the team should know — access, priorities, pages to skip…",
  },
  {
    type: "maintenance",
    icon: "♾",
    title: "Monthly Maintenance",
    desc: "Ongoing fixes + monitoring + alerts",
    tag: "Best Value",
    tc: "var(--gr)",
    bg: "var(--color-status-success-surface)",
  },
]

const EXPERT = {
  type: "expert_fix",
  title: "Request Expert Fix",
  noteLabel: "What do you need help with?",
  notePlaceholder: "Describe the problem and what you'd like the expert to do…",
}

const MESSAGE_MIN = 10
const MESSAGE_MAX = 2000

const formatDate = (value) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null
}

const noticeStyle = (kind) => ({
  fontSize: 11,
  lineHeight: 1.5,
  padding: "8px 10px",
  borderRadius: 8,
  marginBottom: 9,
  color: kind === "error" ? "#ff3860" : kind === "success" ? "var(--gr)" : "var(--t2)",
  background: kind === "error" ? "rgba(255,56,96,0.08)" : kind === "success" ? "var(--color-status-success-surface)" : "var(--s2)",
  border: `1px solid ${kind === "error" ? "rgba(255,56,96,0.28)" : kind === "success" ? "var(--color-status-success-border)" : "var(--b)"}`,
})

function Notice({ notice }) {
  if (!notice) return null
  return (
    <div role={notice.kind === "error" ? "alert" : "status"} style={noticeStyle(notice.kind)}>
      {notice.text}
      {notice.href && (
        <>
          {" "}
          <a href={notice.href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--cy)", fontWeight: 600 }}>
            Open booking page
          </a>
        </>
      )}
    </div>
  )
}

function RequestStatus({ request }) {
  if (!request) return null
  const date = formatDate(request.createdAt)
  return (
    <div
      data-testid={`auditiq-status-${request.requestType}`}
      role="status"
      style={{ ...noticeStyle("info"), display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
    >
      <span style={{ fontWeight: 700, color: STATUS_COLOR[request.status] || "var(--t2)" }}>
        {STATUS_LABEL[request.status] || request.status}
      </span>
      {date && <span style={{ color: "var(--t3)" }}>· Requested {date}</span>}
    </div>
  )
}

function RequestForm({ option, issueTitle, projectName, affectedPageCount, pageUrl, required, value, onChange, onSubmit, onCancel, submitting, error }) {
  const trimmedLength = value.trim().length
  return (
    <form
      data-testid={`auditiq-form-${option.type}`}
      noValidate
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      style={{ background: "var(--s2)", border: "1px solid var(--b)", borderRadius: 11, padding: "12px 14px", marginBottom: 9 }}
    >
      <div style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.6, marginBottom: 10 }}>
        <div>Issue: <strong style={{ color: "var(--t)" }}>{issueTitle}</strong></div>
        {projectName && <div>Project: <strong style={{ color: "var(--t)" }}>{projectName}</strong></div>}
        <div>Affected pages (as shown here): <strong style={{ color: "var(--t)" }}>{affectedPageCount}</strong></div>
        {pageUrl && <div style={{ wordBreak: "break-all" }}>Selected page: <strong style={{ color: "var(--t)" }}>{pageUrl}</strong></div>}
      </div>
      <label htmlFor={`auditiq-note-${option.type}`} style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--t2)", marginBottom: 5 }}>
        {option.noteLabel}
      </label>
      <textarea
        id={`auditiq-note-${option.type}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MESSAGE_MAX}
        rows={3}
        disabled={submitting}
        placeholder={option.notePlaceholder}
        aria-required={required}
        aria-invalid={!!error}
        style={{
          width: "100%", boxSizing: "border-box", resize: "vertical", padding: "8px 10px", fontSize: 12,
          borderRadius: 8, border: "1px solid var(--b)", background: "var(--s)", color: "var(--t)", fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--t3)", marginTop: 4, marginBottom: 8 }}>
        <span>{required ? `At least ${MESSAGE_MIN} characters` : "Optional"}</span>
        <span>{trimmedLength}/{MESSAGE_MAX}</span>
      </div>
      {error && (
        <div role="alert" style={{ ...noticeStyle("error"), marginBottom: 8 }}>{error}</div>
      )}
      <div style={{ fontSize: 10.5, color: "var(--t3)", lineHeight: 1.5, marginBottom: 10 }}>
        This sends a request to the Odito team. Nothing on your website is changed and you are not charged by submitting it.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{ flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--b)", background: "var(--s)", color: "var(--t2)", cursor: submitting ? "not-allowed" : "pointer" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          style={{
            flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", color: "#fff",
            background: "linear-gradient(135deg,#7730ed,#00dfff)", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  )
}

export default function AuditIqHelpPanel({
  projectId,
  projectName,
  issue,
  issueId,
  issueCategory,
  affectedPageCount,
  selUrl,
  hidden = false,
  onBackToAi,
}) {
  const issueTitle = issue.title || issue.issue || issueId
  const pages = Number.isInteger(affectedPageCount) ? affectedPageCount : 0

  const serviceState = useAuditIqServiceState(projectId, issueId)
  const { submit, pendingType } = useSubmitAuditIqRequest({
    projectId,
    issueKey: issueId,
    issueTitle,
    issueCategory,
    affectedPageCount: pages,
    pageUrl: selUrl,
  })

  const [openForm, setOpenForm] = useState(null)       // request type whose form is open
  const [drafts, setDrafts] = useState({})              // type -> note text (survives closing the form)
  const [formError, setFormError] = useState({})        // type -> validation/submit error shown in the form
  const [notices, setNotices] = useState({})            // action -> { kind, text, href? }

  const requests = serviceState.data?.requests || {}
  const services = serviceState.data?.services || {}
  const noProject = !projectId || !issueId

  const setNotice = (key, notice) => setNotices((prev) => ({ ...prev, [key]: notice }))
  const clearNotice = (key) => setNotices((prev) => (prev[key] ? { ...prev, [key]: null } : prev))

  const startRequest = (type) => {
    if (noProject) return
    const existing = requests[type]
    clearNotice(type)
    setFormError((prev) => ({ ...prev, [type]: null }))
    if (existing?.isOpen) {
      // Already requested: show where it stands instead of offering to send it again.
      setOpenForm(null)
      setNotice(type, { kind: "info", text: "You already have an open request for this issue. Its current status is shown below." })
      return
    }
    setOpenForm((current) => (current === type ? null : type))
  }

  const handleSubmit = async (type) => {
    const message = (drafts[type] || "").trim()
    if (type === "expert_fix" && message.length < MESSAGE_MIN) {
      setFormError((prev) => ({ ...prev, [type]: `Please describe the help you need (at least ${MESSAGE_MIN} characters).` }))
      return
    }
    setFormError((prev) => ({ ...prev, [type]: null }))
    const outcome = await submit(type, { message })
    if (outcome.inFlight) return
    if (outcome.ok) {
      setOpenForm(null)
      setDrafts((prev) => ({ ...prev, [type]: "" }))
      setNotice(type, { kind: "success", text: "Request submitted. It has not been started yet — its status is shown below and will update as the team works on it." })
    } else if (outcome.duplicate) {
      setOpenForm(null)
      setNotice(type, { kind: "info", text: outcome.message || "You already have an open request for this issue." })
    } else {
      setFormError((prev) => ({ ...prev, [type]: outcome.message || "Could not submit your request. Please try again." }))
    }
  }

  const showMaintenance = () => {
    setOpenForm(null)
    if (serviceState.isError) {
      setNotice("maintenance", { kind: "error", text: "Couldn't check whether Monthly Maintenance is available. Please try again." })
      serviceState.refetch()
      return
    }
    // Only ever "unavailable" today: no maintenance plan, price or subscription exists to enroll in.
    setNotice("maintenance", {
      kind: "info",
      text: "Monthly Maintenance isn't available yet, so there is nothing to enroll in. You have not been subscribed or charged.",
    })
  }

  const bookStrategyCall = () => {
    if (serviceState.isLoading) {
      setNotice("strategy", { kind: "info", text: "Checking booking availability…" })
      return
    }
    if (serviceState.isError) {
      setNotice("strategy", { kind: "error", text: "Couldn't check booking availability. Please try again." })
      serviceState.refetch()
      return
    }
    const call = services.strategyCall
    if (call?.available && call.url) {
      window.open(call.url, "_blank", "noopener,noreferrer")
      setNotice("strategy", { kind: "info", text: "Booking page opened in a new tab. Your call is only booked once you complete it there.", href: call.url })
      return
    }
    setNotice("strategy", { kind: "info", text: "Strategy call booking isn't set up yet, so no call can be scheduled from here." })
  }

  const expertRequest = requests[EXPERT.type]
  const expertBlocked = !!expertRequest?.isOpen
  const expertSubmitting = pendingType === EXPERT.type

  const primaryButtonStyle = {
    width: "100%",
    padding: 10,
    borderRadius: 9,
    fontSize: "12.5px",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontFamily: "/dashboard",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 7,
    background: "linear-gradient(135deg,#7730ed,#00dfff)",
    color: "#fff",
    boxShadow: "0 0 18px rgba(0,223,255,0.16)",
  }

  return (
    <div style={hidden ? { display: "none" } : undefined} data-testid="auditiq-panel">
      {/* Centered Header Section */}
      <div style={{ textAlign: "center", padding: "16px 0 18px" }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "linear-gradient(135deg,#7730ed,#00dfff)",
          display: "grid",
          placeItems: "center",
          fontSize: 24,
          margin: "0 auto 12px",
        }}>
          🤝
        </div>
        <div style={{ fontFamily: "/dashboard", fontSize: 17, fontWeight: 800, marginBottom: 6 }}>
          Let AuditIQ Fix It
        </div>
        <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
          Ask our team to help resolve <strong style={{ color: "var(--t)" }}>{issueTitle}</strong> across all {pages} affected pages.
        </div>
      </div>

      {serviceState.isError && (
        <div role="alert" style={{ ...noticeStyle("error"), display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>Couldn&apos;t load the status of your existing requests.</span>
          <button
            type="button"
            onClick={() => serviceState.refetch()}
            style={{ background: "none", border: "none", color: "var(--cy)", fontWeight: 600, fontSize: 11, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Service Options */}
      {OPTIONS.map((option) => {
        const isMaintenance = option.type === "maintenance"
        const request = isMaintenance ? null : requests[option.type]
        const submitting = pendingType === option.type
        const activate = () => (isMaintenance ? showMaintenance() : startRequest(option.type))
        return (
          <Fragment key={option.type}>
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isMaintenance ? undefined : openForm === option.type}
              aria-disabled={submitting || noProject}
              onClick={() => { if (!submitting) activate() }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !submitting) { e.preventDefault(); activate() }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 14px",
                marginBottom: 9,
                background: "var(--s)",
                border: "1px solid var(--b)",
                borderRadius: 11,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border2)"
                e.currentTarget.style.transform = "translateX(2px)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--b)"
                e.currentTarget.style.transform = "translateX(0)"
              }}
            >
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                fontSize: 20,
                background: option.bg,
                flexShrink: 0,
              }}>{option.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{option.title}</div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>{option.desc}</div>
              </div>
              <span style={{
                borderRadius: 20,
                padding: "2px 9px",
                fontSize: "9.5px",
                fontWeight: 600,
                color: option.tc,
                background: "var(--color-brand-cyan-surface)",
                border: "1px solid var(--color-brand-cyan-border)",
              }}>{option.tag}</span>
            </div>

            <Notice notice={notices[option.type]} />
            {!isMaintenance && <RequestStatus request={request} />}
            {!isMaintenance && openForm === option.type && (
              <RequestForm
                option={option}
                issueTitle={issueTitle}
                projectName={projectName}
                affectedPageCount={pages}
                pageUrl={selUrl}
                required={false}
                value={drafts[option.type] || ""}
                onChange={(text) => setDrafts((prev) => ({ ...prev, [option.type]: text }))}
                onSubmit={() => handleSubmit(option.type)}
                onCancel={() => setOpenForm(null)}
                submitting={submitting}
                error={formError[option.type]}
              />
            )}
          </Fragment>
        )
      })}

      <button
        type="button"
        aria-expanded={openForm === EXPERT.type}
        disabled={expertSubmitting || noProject}
        onClick={() => startRequest(EXPERT.type)}
        style={{ ...primaryButtonStyle, opacity: expertSubmitting || noProject ? 0.6 : 1 }}
      >
        🚀 Request Expert Fix
      </button>
      <Notice notice={notices[EXPERT.type]} />
      <RequestStatus request={expertRequest} />
      {openForm === EXPERT.type && !expertBlocked && (
        <RequestForm
          option={EXPERT}
          issueTitle={issueTitle}
          projectName={projectName}
          affectedPageCount={pages}
          pageUrl={selUrl}
          required
          value={drafts[EXPERT.type] || ""}
          onChange={(text) => setDrafts((prev) => ({ ...prev, [EXPERT.type]: text }))}
          onSubmit={() => handleSubmit(EXPERT.type)}
          onCancel={() => setOpenForm(null)}
          submitting={expertSubmitting}
          error={formError[EXPERT.type]}
        />
      )}

      <button
        type="button"
        onClick={bookStrategyCall}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 9,
          fontSize: "12.5px",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "/dashboard",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginBottom: 7,
          background: "linear-gradient(135deg, var(--color-brand-violet-surface), rgba(157,78,221,0.2))",
          color: "var(--vi)",
          border: "1px solid var(--color-brand-violet-border)",
        }}
      >
        📅 Book a Strategy Call
      </button>
      <Notice notice={notices.strategy} />

      <button
        type="button"
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 9,
          fontSize: "12.5px",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "/dashboard",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          background: "var(--s2)",
          color: "var(--t2)",
          border: "1px solid var(--b)",
        }}
        onClick={onBackToAi}
      >
        ← Back to AI Fix
      </button>

      {/* Info strip — states only what is true: requests go to the team and their status shows here */}
      <div style={{
        background: "var(--color-status-success-surface)",
        border: "1px solid var(--color-status-success-border)",
        borderRadius: 9,
        padding: "10px 12px",
        marginTop: 12,
        fontSize: 11,
        color: "var(--gr)",
        textAlign: "center",
      }}>
        ✓ Requests go to the Odito team — their status is tracked here
      </div>
    </div>
  )
}
