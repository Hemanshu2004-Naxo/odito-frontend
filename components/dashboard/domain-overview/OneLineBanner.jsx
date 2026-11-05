"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Skel } from "./SectionState"

/**
 * "In one line": the page's headline — which way Google traffic is going and the single biggest fix — with a button to that fix.
 * `line` is buildOneLine(); while its sources load a skeleton stands in, and with nothing to say the banner is not drawn.
 */
export default function OneLineBanner({ line, loading }) {
  if (!line && !loading) return null
  return (
    <section
      aria-label="In one line"
      className="flex flex-col gap-4 rounded-2xl bg-[#0d1a3a] px-5 py-4 text-white shadow-sm @min-[800px]/main:flex-row @min-[800px]/main:items-center dark:bg-[#111c3d] dark:ring-1 dark:ring-white/10"
      data-testid="do-one-line"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/90 text-[#0d1a3a]" aria-hidden>
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">In one line</p>
        {line ? (
          <p className="mt-0.5 text-[15px] leading-snug text-white/95" data-testid="do-one-line-text">{line.text}</p>
        ) : (
          <div className="mt-1.5 space-y-1.5"><Skel className="h-4 w-full bg-white/15" /><Skel className="h-4 w-2/3 bg-white/15" /></div>
        )}
      </div>
      {line?.cta ? (
        <Link
          href={line.cta.href}
          className="inline-flex shrink-0 items-center justify-center self-start rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#0d1a3a] transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white @min-[800px]/main:self-center"
          data-testid="do-one-line-cta"
        >
          {line.cta.label}
        </Link>
      ) : null}
    </section>
  )
}
