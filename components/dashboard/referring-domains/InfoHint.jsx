"use client"

import { useId } from "react"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * A small "i" button that explains a metric. The text is available three ways: the hover/focus tooltip, an accessible
 * description (aria-describedby) for screen readers, and — via the same string — wherever the caller also prints it.
 */
export default function InfoHint({ label, text }) {
  const id = useId()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          aria-describedby={id}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="size-3.5" aria-hidden />
          <span id={id} className="sr-only">{text}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{text}</TooltipContent>
    </Tooltip>
  )
}
