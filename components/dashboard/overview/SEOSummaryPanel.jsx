
"use client";

import { memo } from "react";

function SEOSummaryPanel({
  pagesCrawled = 0,
  totalIssues = null,
  totalIssuesState = "loading",
  criticalIssues = 0,
}) {
  const stats = [
    {
      label: "PAGES CRAWLED",
      value: pagesCrawled,
      color: "text-cyan-500",
    },
    {
      label: "TOTAL ISSUES (ALL CATEGORIES)",
      value: totalIssuesState === "error" ? "—" : totalIssues ?? "—",
      color: "text-purple-500",
    },
    {
      label: "CRITICAL",
      value: criticalIssues,
      color: "text-rose-500",
    },
  ];

  return (
    <section className="flex h-full min-w-0 flex-col gap-4">
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          SEO Summary
        </h2>

        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-600 dark:text-cyan-300">
          {totalIssuesState === "live" ? "LIVE" : "SEO"}
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 items-stretch gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="flex min-h-[135px] min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-colors"
          >
            <p className="text-xs font-semibold uppercase leading-5 tracking-wider text-muted-foreground">
              {stat.label}
            </p>

            <div
              className={`mt-2 text-3xl font-bold tracking-tight ${stat.color}`}
            >
              {stat.value}
            </div>

            {stat.label === "TOTAL ISSUES (ALL CATEGORIES)" &&
              totalIssuesState === "stale" && (
                <p className="mt-auto pt-1 text-xs text-muted-foreground">
                  Last known value
                </p>
              )}

            {stat.label === "TOTAL ISSUES (ALL CATEGORIES)" &&
              totalIssuesState === "loading" && (
                <p className="mt-auto pt-1 text-xs text-muted-foreground">
                  Loading issues…
                </p>
              )}

            {stat.label === "TOTAL ISSUES (ALL CATEGORIES)" &&
              totalIssuesState === "error" && (
                <p className="mt-auto pt-1 text-xs text-muted-foreground">
                  Unable to load issues
                </p>
              )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default memo(SEOSummaryPanel);
