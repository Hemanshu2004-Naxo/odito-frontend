import { Pill, StatusMark } from "../parts"
import { formatDateTime, intentLabel } from "../format"

const yesNo = (v) => (v == null ? "—" : v ? "Yes" : "No")

/**
 * The same question across runs. Rows are matched on the question's stable id, and each row keeps the question-set version and the
 * wording that was actually asked. When the wording differs from the newest row's, the row says so, because a changed question is
 * not the same measurement. Failed or skipped rows are shown as such, never as "not mentioned".
 *
 * `items`: evidence DTOs newest first (GET .../questions/:id/history).
 */
export default function QuestionHistoryTable({ items }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">This question has no stored results yet.</p>
  const newest = items[0].question
  const reworded = items.some((i) => i.question !== newest)
  const versions = new Set(items.map((i) => i.questionSetVersion))
  return (
    <div>
      {reworded ? (
        <p role="note" className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          The wording of this question changed between versions, so older results may not be directly comparable with the latest.
        </p>
      ) : versions.size > 1 ? (
        <p className="mb-2 text-xs text-muted-foreground">Same wording across question sets {[...versions].sort((a, b) => a - b).map((v) => `v${v}`).join(", ")}.</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Run</th>
              <th className="pb-2 pr-3 font-medium">Questions</th>
              <th className="pb-2 pr-3 font-medium">Result</th>
              <th className="pb-2 pr-3 font-medium">Mentioned</th>
              <th className="pb-2 pr-3 font-medium">Recommended</th>
              <th className="pb-2 text-right font-medium">Your pages cited</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const answered = i.status === "succeeded"
              return (
                <tr key={`${i.runId}-${i.questionId}`} className="border-t border-border/50 align-top">
                  <td className="py-2 pr-3">{formatDateTime(i.completedAt || i.startedAt)}</td>
                  <td className="py-2 pr-3">
                    v{i.questionSetVersion}
                    {i.question !== newest ? <div className="mt-0.5"><Pill tone="warn">Different wording</Pill></div> : null}
                  </td>
                  <td className="py-2 pr-3"><StatusMark status={i.status} /></td>
                  <td className="py-2 pr-3">{answered ? yesNo(i.analysis?.brandMentioned) : "—"}</td>
                  <td className="py-2 pr-3">{answered ? yesNo(i.analysis?.recommended) : "—"}</td>
                  <td className="py-2 text-right tabular-nums">{answered ? i.firstPartyPages.length : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{intentLabel(items[0].intent)} · a dash means no answer was collected for that run, which is not the same as "not mentioned".</p>
    </div>
  )
}
