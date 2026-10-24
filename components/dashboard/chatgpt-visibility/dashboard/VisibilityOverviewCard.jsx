import { num, rateWithSample } from "../format"

function Metric({ label, value, basis, help, onClick, actionLabel }) {
  const body = (
    <>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground tabular-nums">{basis}</div>
      {help ? <div className="mt-1 text-xs text-muted-foreground">{help}</div> : null}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={actionLabel} className="min-w-0 rounded-lg p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </button>
  ) : <div className="min-w-0 p-2">{body}</div>
}

/**
 * The primary card. Every percentage shares ONE denominator - eligible answers: answered discovery questions (questions that do not name
 * the business). Brand diagnostic questions and failed / skipped questions are never in it. Each figure states its sample, and shows
 * "—" when there is nothing to compute from rather than a misleading 0%.
 *
 * `onDrill(filter)` opens the answers behind a metric (filter for the questions table).
 */
export default function VisibilityOverviewCard({ overview, onDrill }) {
  const n = overview.eligibleAnswers
  const vis = rateWithSample(overview.visibility.rate, overview.visibility.answers, n)
  const rec = rateWithSample(overview.recommendation.rate, overview.recommendation.answers, n)
  const cite = rateWithSample(overview.websiteCitation.rate, overview.websiteCitation.answers, n)
  const comp = overview.competitors
  const top = comp.mentioned?.[0]
  return (
    <section aria-label="ChatGPT Visibility" className="rounded-xl border border-border/60 bg-card p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <Metric label="Visibility" value={vis.value} basis={vis.basis}
          help="Answers that mention your business" onClick={onDrill ? () => onDrill({ mentioned: "true" }) : undefined} actionLabel="Show answers that mention your business" />
        <Metric label="Recommended" value={rec.value} basis={rec.basis}
          help="Estimated from the wording" onClick={onDrill ? () => onDrill({ recommended: "true" }) : undefined} actionLabel="Show answers that recommend your business" />
        <Metric label="Website cited" value={cite.value} basis={cite.basis}
          help="Answers linking to your website" onClick={onDrill ? () => onDrill({ cited: "true" }) : undefined} actionLabel="Show answers that cite your website" />
        <Metric label="Unique cited pages" value={num(overview.uniqueCitedPages)}
          basis={overview.citationOccurrences != null ? `${overview.citationOccurrences} ${overview.citationOccurrences === 1 ? "citation" : "citations"} in total` : "Not available"}
          help="Distinct pages of your site" />
        <Metric label="Competitors"
          value={comp.configured ? (top ? `${Math.round((top.rate ?? 0) * 100)}%` : "0%") : "—"}
          basis={comp.configured ? (top ? `${top.name}: ${top.answers} of ${n} eligible answers` : "No tracked competitor was mentioned") : "No competitors tracked yet"}
          help={comp.configured ? "Top tracked competitor" : "Add competitors in your business profile"} />
      </div>
      <p className="mt-3 px-2 text-xs text-muted-foreground">
        Eligible answers: {n} answered {n === 1 ? "question" : "questions"} that do not name your business. Questions that failed or were not sent are left out, not counted as “not visible”. A sample of ChatGPT answers, not every answer every user sees.
      </p>
    </section>
  )
}
