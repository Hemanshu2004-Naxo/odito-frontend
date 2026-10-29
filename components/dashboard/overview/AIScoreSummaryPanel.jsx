
"use client";

import { memo } from "react";
import { Sparkles } from "lucide-react";

const SCORE_CARDS = [
  {
    key: "aiso",
    label: "AISO SCORE",
    color: "text-purple-500",
  },
  {
    key: "aeo",
    label: "AEO SCORE",
    color: "text-cyan-500",
  },
  {
    key: "geo",
    label: "GEO SCORE",
    color: "text-emerald-500",
  },
];

function AIScoreSummaryPanel({ scores = {}, loading = false }) {
  return (
    <section className="flex h-full min-w-0 flex-col gap-4">
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-purple-500" />

        <h2 className="text-lg font-semibold text-foreground">
          AI Summary
        </h2>

        <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-600 dark:text-purple-300">
          AI SCORES
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 items-stretch gap-3 sm:grid-cols-3">
        {SCORE_CARDS.map((card) => {
          const rawValue = scores?.[card.key];

          const score =
            rawValue !== null &&
            rawValue !== undefined &&
            rawValue !== "" &&
            Number.isFinite(Number(rawValue))
              ? Number(rawValue)
              : null;

          return (
            <article
              key={card.key}
              className="flex min-h-[135px] min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-colors"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>

              <div className="mt-3 flex items-baseline gap-1">
                <span
                  className={`text-3xl font-bold tracking-tight ${card.color}`}
                >
                  {loading ? "—" : score ?? "—"}
                </span>

                <span className="text-sm text-muted-foreground">
                  /100
                </span>
              </div>

              {!loading && score === null && (
                <p className="mt-auto pt-2 text-xs text-muted-foreground">
                  Score unavailable
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default memo(AIScoreSummaryPanel);
