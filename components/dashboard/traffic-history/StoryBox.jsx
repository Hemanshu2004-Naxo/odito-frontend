"use client"

import { Sparkles } from "lucide-react"

/** The plain-language summary under the cards: buildTrafficStory()'s parts, with the key figures in bold. Nothing to say -> nothing drawn. */
export default function StoryBox({ parts }) {
  if (!parts?.length) return null
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-sky-200/70 bg-sky-50/80 px-4 py-3.5 dark:border-sky-500/20 dark:bg-sky-500/[0.07]" data-testid="th-story">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white" aria-hidden>
        <Sparkles className="size-4" />
      </span>
      <p className="text-sm leading-relaxed text-foreground/85">
        {parts.map((p, i) => (p.strong ? <strong key={i} className="font-semibold text-foreground">{p.text}</strong> : <span key={i}>{p.text}</span>))}
      </p>
    </div>
  )
}
