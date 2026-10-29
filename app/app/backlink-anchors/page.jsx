"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  Globe2,
  Info,
  Link2,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";

const PAGE_SIZE = 10;
const API_LIMIT = 100;

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("en-US")
    : String(value);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function getDomain(value) {
  if (!value) return "";
  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return String(value)
      .replace(/^https?:\/\//i, "")
      .split("/")[0];
  }
}

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
  ).replace(/\/+$/, "");
}

function getAuthToken() {
  if (typeof window === "undefined") return "";
  for (const key of [
    "token",
    "accessToken",
    "access_token",
    "authToken",
    "jwt",
  ]) {
    const value = window.localStorage.getItem(key);
    if (value) return value.replace(/^Bearer\s+/i, "").trim();
  }
  return "";
}

function Panel({ children, className = "" }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-border bg-card text-card-foreground shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

function MetricCard({ label, value, note, icon: Icon, tone = "cyan" }) {
  const tones = {
    cyan: "bg-cyan-500/10 text-cyan-500",
    violet: "bg-violet-500/10 text-violet-500",
    amber: "bg-amber-500/10 text-amber-500",
  };
  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-3 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${tones[tone] || tones.cyan}`}>
          <Icon size={19} />
        </span>
      </div>
    </Panel>
  );
}

function Badge({ children, tone = "neutral" }) {
  const styles = {
    neutral: "border-border bg-muted/50 text-muted-foreground",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    violet:
      "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    amber:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    red: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
    green:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone] || styles.neutral}`}
    >
      {children}
    </span>
  );
}

function classifyAnchor(text, domain) {
  const anchor = String(text || "")
    .trim()
    .toLowerCase();
  if (!anchor) return "Unknown";
  const cleanDomain = String(domain || "")
    .toLowerCase()
    .replace(/^www\./, "");
  const normalizedAnchor = anchor
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
  if (
    /^(https?:\/\/|www\.)/.test(anchor) ||
    normalizedAnchor === cleanDomain ||
    normalizedAnchor === cleanDomain.replace(/^www\./, "")
  )
    return "Branded / URL";
  if (
    [
      "click here",
      "here",
      "visit website",
      "visit company website",
      "read more",
      "learn more",
      "website",
      "this site",
    ].includes(anchor)
  )
    return "Generic";
  if (
    cleanDomain &&
    (anchor.includes(cleanDomain) || anchor.includes(cleanDomain.split(".")[0]))
  ) {
    if (anchor.split(/\s+/).length <= 3) return "Branded / URL";
  }
  if (
    anchor.split(/\s+/).length >= 3 ||
    /\b(seo|backlinks?|services?|agency|best|cheap|buy|professional|quality|ranking|marketing)\b/i.test(
      anchor,
    )
  )
    return "Keyword-rich";
  return "Other";
}

function getAnchorText(item) {
  return (
    item?.anchor ??
    item?.anchor_text ??
    item?.text ??
    item?.title ??
    "(empty anchor)"
  );
}

function getBacklinks(item) {
  return item?.backlinks ?? item?.backlinks_count ?? item?.links ?? 0;
}

function getDomains(item) {
  return (
    item?.referring_domains ?? item?.domains ?? item?.referringDomains ?? 0
  );
}

function getSpamScore(item) {
  return (
    item?.backlinks_spam_score ?? item?.spam_score ?? item?.spamScore ?? null
  );
}

function normalizeItems(payload) {
  const candidates = [
    payload?.data?.items,
    payload?.data?.anchors?.items,
    payload?.items,
    payload?.result?.items,
    payload?.data?.result?.items,
  ];
  const items = candidates.find(Array.isArray) || [];
  return items.map((item, index) => ({
    ...item,
    __key: String(item?._id ?? item?.id ?? `${getAnchorText(item)}-${index}`),
  }));
}

function getFetchedAt(payload) {
  return (
    payload?.data?.fetched_at ??
    payload?.data?.fetchedAt ??
    payload?.fetched_at ??
    payload?.fetchedAt ??
    null
  );
}

function scoreTone(score) {
  if (score === null || score === undefined || score === "") return "neutral";
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return "neutral";
  if (numeric >= 60) return "red";
  if (numeric >= 40) return "amber";
  return "green";
}

function DistributionRow({ label, count, total, tone }) {
  const percent = total > 0 ? Math.min(100, (count / total) * 100) : 0;
  const fill =
    tone === "violet"
      ? "bg-violet-500"
      : tone === "amber"
        ? "bg-amber-500"
        : tone === "slate"
          ? "bg-slate-500"
          : "bg-cyan-500";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">
          {formatNumber(count)}{" "}
          <span className="text-xs text-muted-foreground">
            ({percent.toFixed(1)}%)
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${fill}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
      <span className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">
        <Link2 size={22} />
      </span>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export default function BacklinkAnchorsPage() {
  const { activeProject, activeProjectId } = useProject();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fetchedAt, setFetchedAt] = useState(null);
  const [apiCost, setApiCost] = useState(null);
  const [totalCount, setTotalCount] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [sortBy, setSortBy] = useState("backlinks");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const domain = useMemo(
    () =>
      getDomain(
        activeProject?.main_url ||
          activeProject?.url ||
          activeProject?.website ||
          activeProject?.name,
      ),
    [activeProject],
  );

  const loadAnchors = useCallback(
    async ({ force = false, silent = false } = {}) => {
      if (!activeProjectId) {
        setItems([]);
        setLoading(false);
        setError(
          "Select a project from the sidebar to view its backlink anchors.",
        );
        return;
      }
      if (!silent) setLoading(true);
      setError("");
      if (force) setRefreshing(true);
      try {
        const token = getAuthToken();
        if (!token)
          throw new Error("No login token found. Please sign in again.");
        const params = new URLSearchParams({
          limit: String(API_LIMIT),
          offset: "0",
        });
        if (force) params.set("force", "true");
        const response = await fetch(
          `${getApiBase()}/projects/${encodeURIComponent(activeProjectId)}/backlink-anchors?${params.toString()}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false)
          throw new Error(
            payload?.message ||
              payload?.error ||
              `Could not load backlink anchors (HTTP ${response.status}).`,
          );
        const normalized = normalizeItems(payload);
        setItems(normalized);
        setTotalCount(
          payload?.data?.total_count ??
            payload?.data?.total ??
            payload?.total_count ??
            payload?.total ??
            normalized.length,
        );
        setApiCost(
          payload?.data?.api_cost ??
            payload?.data?.cost ??
            payload?.api_cost ??
            payload?.cost ??
            null,
        );
        setFetchedAt(getFetchedAt(payload) || new Date().toISOString());
        setNotice(force ? "Anchor data refreshed." : "Anchor report loaded.");
        setSelected((current) =>
          current
            ? normalized.find((item) => item.__key === current.__key) || null
            : null,
        );
      } catch (err) {
        setError(err?.message || "Could not load backlink anchors.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeProjectId],
  );

  useEffect(() => {
    setItems([]);
    setSelected(null);
    setSearch("");
    setTypeFilter("All types");
    setPage(1);
    loadAnchors();
  }, [activeProjectId, loadAnchors]);

  const classified = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        __anchorText: getAnchorText(item),
        __backlinks: Number(getBacklinks(item)) || 0,
        __domains: Number(getDomains(item)) || 0,
        __spam: getSpamScore(item),
        __type: classifyAnchor(getAnchorText(item), domain),
      })),
    [items, domain],
  );

  const distribution = useMemo(() => {
    const initial = {
      "Keyword-rich": 0,
      "Branded / URL": 0,
      Generic: 0,
      Other: 0,
      Unknown: 0,
    };
    for (const item of classified)
      initial[item.__type] = (initial[item.__type] || 0) + item.__backlinks;
    return initial;
  }, [classified]);

  const filteredItems = useMemo(
    () =>
      classified
        .filter((item) =>
          item.__anchorText.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .filter(
          (item) => typeFilter === "All types" || item.__type === typeFilter,
        )
        .sort((a, b) => {
          if (sortBy === "spam")
            return (Number(b.__spam) || 0) - (Number(a.__spam) || 0);
          if (sortBy === "domains") return b.__domains - a.__domains;
          if (sortBy === "first-seen")
            return (
              new Date(b.first_seen || 0).getTime() -
              new Date(a.first_seen || 0).getTime()
            );
          return b.__backlinks - a.__backlinks;
        }),
    [classified, search, typeFilter, sortBy],
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const visibleItems = filteredItems.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const keywordRichBacklinks = classified
    .filter((item) => item.__type === "Keyword-rich")
    .reduce((sum, item) => sum + item.__backlinks, 0);
  const concernCount = classified.filter(
    (item) =>
      Number(item.__spam) >= 60 ||
      (item.__type === "Keyword-rich" && item.__backlinks >= 100),
  ).length;
  const totalAnchorBacklinks = classified.reduce(
    (sum, item) => sum + item.__backlinks,
    0,
  );

  function exportCsv() {
    if (!filteredItems.length) {
      setNotice(
        "There are no anchor records to export for the current filters.",
      );
      return;
    }
    const columns = [
      ["anchor_text", (item) => item.__anchorText],
      ["anchor_type", (item) => item.__type],
      ["backlinks", (item) => item.__backlinks],
      ["referring_domains", (item) => item.__domains],
      ["spam_score", (item) => item.__spam ?? ""],
      ["rank", (item) => item.rank ?? ""],
      ["broken_backlinks", (item) => item.broken_backlinks ?? ""],
      ["broken_pages", (item) => item.broken_pages ?? ""],
      ["first_seen", (item) => item.first_seen ?? ""],
      ["lost_date", (item) => item.lost_date ?? ""],
    ];
    const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      columns.map(([label]) => quote(label)).join(","),
      ...filteredItems.map((item) =>
        columns.map(([, getValue]) => quote(getValue(item))).join(","),
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "odito-backlink-anchors.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Anchor records exported to CSV.");
  }

  return (
    <main className="min-h-full w-full min-w-0 bg-transparent text-foreground">
      <div className="mx-auto w-full min-w-0 space-y-5 p-4 sm:p-5 lg:p-6">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Projects</span>
              <ChevronRight size={13} />
              <span>SEO Analysis</span>
              <ChevronRight size={13} />
              <span className="font-medium text-primary">Backlink Anchors</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Backlink Anchors
              </h1>
              <Badge tone="cyan">Anchor analysis</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Understand which words other websites use to link to your site,
              how frequently they appear, and which patterns may deserve a
              closer look.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <div className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
                <Globe2 size={16} className="shrink-0 text-primary" />
                <span className="max-w-72 truncate font-medium">
                  {domain || "Select a project"}
                </span>
                {activeProjectId && <Badge>Selected project</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">
                {fetchedAt
                  ? `Last checked: ${new Date(fetchedAt).toLocaleString()}`
                  : "No report fetched yet"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!filteredItems.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => loadAnchors({ force: true })}
              disabled={refreshing || loading || !activeProjectId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh data"}
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">Unable to load anchor data</p>
              <p className="mt-1">{error}</p>
              {activeProjectId && (
                <button
                  type="button"
                  onClick={() => loadAnchors()}
                  className="mt-2 underline underline-offset-2"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}
        {notice && !error && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          >
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notice"
              className="rounded-md p-1 hover:bg-accent"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Anchor records"
            value={loading ? "…" : formatNumber(totalCount ?? items.length)}
            note="Anchor text records returned by DataForSEO"
            icon={Link2}
          />
          <MetricCard
            label="Keyword-rich backlinks"
            value={loading ? "…" : formatNumber(keywordRichBacklinks)}
            note="Estimated from returned anchor text classifications"
            icon={ArrowDownUp}
            tone="violet"
          />
          <MetricCard
            label="Potential concerns"
            value={loading ? "…" : formatNumber(concernCount)}
            note="Heuristic flags for review, not proof of spam"
            icon={ShieldAlert}
            tone="amber"
          />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <Panel className="p-4 sm:p-5 xl:col-span-3">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Anchor distribution</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Backlink counts grouped by inferred anchor type.
                </p>
              </div>
              <Badge>
                {formatNumber(totalAnchorBacklinks)} backlinks across returned
                records
              </Badge>
            </div>
            {loading ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle size={16} className="animate-spin" />
                Loading distribution…
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                title="No anchor records yet"
                description="Refresh the report to retrieve anchor text data for this project."
              />
            ) : (
              <div className="space-y-5">
                <DistributionRow
                  label="Keyword-rich"
                  count={distribution["Keyword-rich"] || 0}
                  total={totalAnchorBacklinks}
                  tone="cyan"
                />
                <DistributionRow
                  label="Branded / URL"
                  count={distribution["Branded / URL"] || 0}
                  total={totalAnchorBacklinks}
                  tone="violet"
                />
                <DistributionRow
                  label="Generic"
                  count={distribution.Generic || 0}
                  total={totalAnchorBacklinks}
                  tone="slate"
                />
                <DistributionRow
                  label="Other / unclassified"
                  count={
                    (distribution.Other || 0) + (distribution.Unknown || 0)
                  }
                  total={totalAnchorBacklinks}
                  tone="amber"
                />
                <p className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  Anchor type is inferred from the text and selected domain.
                  Review classifications before using them for decisions. Counts
                  represent the returned records and may not equal the Summary
                  API's total backlink count.
                </p>
              </div>
            )}
          </Panel>
          <Panel className="p-4 sm:p-5 xl:col-span-2">
            <div className="mb-4">
              <h2 className="text-base font-semibold">Link quality signals</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Prioritize anchors for manual review.
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <ShieldAlert size={18} />
                <span className="text-sm font-medium">
                  Potentially concerning patterns
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold">
                {loading ? "—" : formatNumber(concernCount)}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Anchors flagged by a simple heuristic: high reported spam score
                or many backlinks using keyword-rich text.
              </p>
            </div>
            <div className="mt-3 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-emerald-500" />
                <p className="text-sm font-medium">How to interpret this</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                A high spam score or repeated commercial anchor is a signal to
                investigate, not definitive proof that a link is manipulative.
              </p>
            </div>
            {apiCost !== null && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Last request cost</span>
                <span className="font-medium tabular-nums">
                  ${Number(apiCost).toFixed(5)}
                </span>
              </div>
            )}
          </Panel>
        </section>

        <Panel className="overflow-hidden">
          <div className="border-b border-border p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
              <div>
                <h2 className="text-base font-semibold">Anchor records</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search, classify and open an anchor to inspect its available
                  metrics.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 sm:w-72">
                  <Search
                    size={16}
                    className="absolute left-3 top-3 text-muted-foreground"
                  />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search anchor text…"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
                <div className="relative">
                  <Filter
                    size={15}
                    className="pointer-events-none absolute left-3 top-3 text-muted-foreground"
                  />
                  <select
                    value={typeFilter}
                    onChange={(event) => {
                      setTypeFilter(event.target.value);
                      setPage(1);
                    }}
                    className="w-full appearance-none rounded-xl border border-border bg-background py-2.5 pl-9 pr-8 text-sm outline-none focus:border-primary sm:w-44"
                  >
                    <option>All types</option>
                    <option>Keyword-rich</option>
                    <option>Branded / URL</option>
                    <option>Generic</option>
                    <option>Other</option>
                    <option>Unknown</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-3.5 text-muted-foreground"
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Showing {formatNumber(filteredItems.length)} of{" "}
                {formatNumber(totalCount ?? items.length)} returned records
              </p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Sort by{" "}
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground"
                >
                  <option value="backlinks">Most backlinks</option>
                  <option value="domains">Referring domains</option>
                  <option value="spam">Spam score</option>
                  <option value="first-seen">First seen</option>
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <LoaderCircle size={17} className="animate-spin" />
              Loading anchor records from DataForSEO…
            </div>
          ) : visibleItems.length === 0 ? (
            <EmptyState
              title="No matching anchors"
              description={
                items.length
                  ? "Try changing the search or type filter."
                  : "No anchor records are available for this project yet. Use Refresh data to try again."
              }
            />
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-y border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Anchor text</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Backlinks
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Ref. domains
                    </th>
                    <th className="px-4 py-3 font-medium">Spam score</th>
                    <th className="px-4 py-3 font-medium">First seen</th>
                    <th className="px-4 py-3 font-medium">Lost date</th>
                    <th className="px-5 py-3 text-right font-medium">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleItems.map((item) => {
                    const isSelected = selected?.__key === item.__key;
                    return (
                      <Fragment key={item.__key}>
                        <tr
                          className={`cursor-pointer transition-colors hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}
                          onClick={() => setSelected(isSelected ? null : item)}
                        >
                          <td className="max-w-[340px] px-5 py-4">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
                                <Link2 size={14} />
                              </span>
                              <span className="min-w-0">
                                <span
                                  className="block break-words font-medium"
                                  title={item.__anchorText}
                                >
                                  {item.__anchorText}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  Rank: {formatNumber(item.rank)}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              tone={
                                item.__type === "Keyword-rich"
                                  ? "violet"
                                  : item.__type === "Branded / URL"
                                    ? "cyan"
                                    : item.__type === "Generic"
                                      ? "neutral"
                                      : "amber"
                              }
                            >
                              {item.__type}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-right font-medium tabular-nums">
                            {formatNumber(item.__backlinks)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums">
                            {formatNumber(item.__domains)}
                          </td>
                          <td className="px-4 py-4">
                            {item.__spam == null ? (
                              "—"
                            ) : (
                              <Badge tone={scoreTone(item.__spam)}>
                                {formatNumber(item.__spam)}
                              </Badge>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                            {formatDate(item.first_seen)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                            {formatDate(item.lost_date)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelected(isSelected ? null : item);
                              }}
                              aria-label={`View details for ${item.__anchorText}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                            >
                              {isSelected ? "Close" : "View"}
                              <ChevronRight
                                size={13}
                                className={isSelected ? "rotate-90" : ""}
                              />
                            </button>
                          </td>
                        </tr>
                        {isSelected && (
                          <tr
                            key={`${item.__key}-details`}
                            className="bg-muted/20"
                          >
                            <td colSpan={8} className="p-0">
                              <div className="border-y border-primary/20 p-4 sm:p-5">
                                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Selected anchor
                                    </p>
                                    <h3 className="mt-1 break-words text-base font-semibold">
                                      {item.__anchorText}
                                    </h3>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <Badge
                                        tone={
                                          item.__type === "Keyword-rich"
                                            ? "violet"
                                            : "cyan"
                                        }
                                      >
                                        {item.__type}
                                      </Badge>
                                      {item.__spam != null && (
                                        <Badge tone={scoreTone(item.__spam)}>
                                          Spam score:{" "}
                                          {formatNumber(item.__spam)}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSelected(null)}
                                    className="self-start rounded-lg p-2 text-muted-foreground hover:bg-accent"
                                    aria-label="Close anchor details"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                  {[
                                    ["Backlinks", item.__backlinks],
                                    ["Referring domains", item.__domains],
                                    ["Broken backlinks", item.broken_backlinks],
                                    ["Broken pages", item.broken_pages],
                                  ].map(([label, value]) => (
                                    <div
                                      key={label}
                                      className="rounded-xl border border-border bg-card p-3"
                                    >
                                      <p className="text-xs text-muted-foreground">
                                        {label}
                                      </p>
                                      <p className="mt-2 text-lg font-semibold tabular-nums">
                                        {formatNumber(value)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div className="rounded-xl border border-border bg-card p-4">
                                    <p className="text-xs text-muted-foreground">
                                      First seen
                                    </p>
                                    <p className="mt-1 text-sm font-medium">
                                      {formatDate(item.first_seen)}
                                    </p>
                                    <p className="mt-3 text-xs text-muted-foreground">
                                      Lost date
                                    </p>
                                    <p className="mt-1 text-sm font-medium">
                                      {formatDate(item.lost_date)}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border border-border bg-card p-4">
                                    <p className="text-sm font-medium">
                                      Source URL details
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                      Individual source pages, target URLs and
                                      link attributes require matching records
                                      from your individual Backlinks endpoint.
                                      This anchor endpoint provides aggregate
                                      anchor metrics; no source URLs are
                                      fabricated here.
                                    </p>
                                    <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                                      <Info
                                        size={14}
                                        className="mt-0.5 shrink-0"
                                      />
                                      Use the Backlinks page to search
                                      individual backlink records by this anchor
                                      text.
                                    </div>
                                  </div>
                                </div>
                                {item.referring_links_tld &&
                                  typeof item.referring_links_tld ===
                                    "object" && (
                                    <div className="mt-4 rounded-xl border border-border bg-card p-4">
                                      <h4 className="text-sm font-semibold">
                                        Referring link TLDs
                                      </h4>
                                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {Object.entries(
                                          item.referring_links_tld,
                                        )
                                          .slice(0, 8)
                                          .map(([key, value]) => (
                                            <div
                                              key={key}
                                              className="rounded-lg bg-muted/40 p-2.5"
                                            >
                                              <p className="text-xs text-muted-foreground">
                                                {key}
                                              </p>
                                              <p className="mt-1 font-medium tabular-nums">
                                                {formatNumber(value)}
                                              </p>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredItems.length > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Panel>

        <footer className="flex flex-col justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row">
          <p>Odito · Backlink Anchors</p>
          <p>
            {fetchedAt
              ? `Report fetched ${new Date(fetchedAt).toLocaleString()}`
              : "No report loaded"}
            {apiCost != null
              ? ` · API cost $${Number(apiCost).toFixed(5)}`
              : ""}
          </p>
        </footer>
      </div>
    </main>
  );
}
