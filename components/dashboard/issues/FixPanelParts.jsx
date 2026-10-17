"use client"

import { AlertTriangle } from "lucide-react"
import { verifyLabel } from "./organizationFix"

// Shared building blocks of the typed WordPress fix panels (Organization schema, Organization sameAs): the same dark card
// language, the same status chips, the same error box and the same saved-vs-rendered verification rows.

export const LABEL = "text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
export const CARD = "rounded-xl border border-border bg-card/60 p-4"
export const BODY = "text-[12.5px] leading-[1.65] text-foreground/80"
export const BTN = "rounded-lg border border-border bg-muted px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
export const PRIMARY = "w-full rounded-xl border-none bg-gradient-to-r from-[#7730ed] to-[#00dfff] py-3 text-[13px] font-bold text-white shadow-[0_0_20px_rgba(119,48,237,0.2)] transition-all disabled:cursor-not-allowed disabled:opacity-50"

export const TONES = {
  ok: "text-[#00f5a0] bg-[rgba(0,245,160,0.08)] border-[rgba(0,245,160,0.18)]",
  info: "text-[#00dfff] bg-[rgba(0,223,255,0.08)] border-[rgba(0,223,255,0.18)]",
  warn: "text-[#ffb703] bg-[rgba(255,183,3,0.08)] border-[rgba(255,183,3,0.25)]",
  bad: "text-[#ff6080] bg-[rgba(255,56,96,0.08)] border-[rgba(255,56,96,0.22)]",
  muted: "text-muted-foreground bg-muted border-border",
}

export function Chip({ tone = "muted", children, ...rest }) {
  return <span {...rest} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONES[tone]}`}>{children}</span>
}

export function ErrorBox({ info, onRefresh, onRetry, onCheck, checking }) {
  if (!info) return null
  return (
    <div role="alert" data-testid="fix-error" className={`rounded-lg border p-3 text-[12px] leading-relaxed ${TONES[info.tone] || TONES.bad}`}>
      <div className="mb-1 flex items-center gap-1.5 font-bold"><AlertTriangle size={13} /> {info.title}</div>
      <p>{info.message}</p>
      {info.updatePlugin && <p className="mt-1.5">Download the current Odito SEO Bridge from the WordPress integration settings and upload it on your site.</p>}
      <div className="mt-2 flex gap-2">
        {info.refreshPreview && <button type="button" className={BTN} onClick={onRefresh}>Review refreshed preview</button>}
        {info.retry && onRetry && <button type="button" className={BTN} onClick={onRetry}>Try again</button>}
        {info.checkStatus && onCheck && <button type="button" className={BTN} disabled={checking} onClick={onCheck}>{checking ? "Checking…" : "Check status"}</button>}
      </div>
    </div>
  )
}

export function VerificationRow({ testId, title, status, code, reasons, extra }) {
  const tone = status === "verified" ? "ok" : status === "failed" ? "bad" : status === "unverifiable" ? "warn" : "muted"
  return (
    <li data-testid={testId} className="flex flex-col gap-1 rounded-lg border border-border bg-background/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-foreground">{title}</span>
        <Chip tone={tone}>{verifyLabel(status, code)}</Chip>
      </div>
      {extra && <span className="text-[11px] text-muted-foreground">{extra}</span>}
      {(reasons || []).map((r, i) => <span key={i} className="text-[11px] text-muted-foreground">{r}</span>)}
    </li>
  )
}
