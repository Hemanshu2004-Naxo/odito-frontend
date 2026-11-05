import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** The Domain Overview's card: title + one-line description, an optional control on the right, the body, and an optional footer link. */
export default function OverviewCard({ title, description, action, footer, children, className, testId, titleId }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)} aria-labelledby={titleId} data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="flex-1 px-5 pb-4 pt-3">{children}</div>
      {footer ? <div className="px-5 pb-4">{footer}</div> : null}
    </section>
  )
}

/** "All 101 keywords →" */
export function FooterLink({ href, children, testId }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-indigo-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-indigo-400" data-testid={testId}>
      {children} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  )
}

/** A short explanatory sentence under a table or chart. */
export function Note({ children, tone, className, testId }) {
  if (!children) return null
  return <p className={cn("text-xs leading-relaxed", tone === "bad" ? "text-red-600 dark:text-red-400" : "text-muted-foreground", className)} data-testid={testId}>{children}</p>
}
