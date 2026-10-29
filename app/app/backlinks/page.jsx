"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe2,
  Link2,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Unlink,
  X,
  Download,
  Network,
  FileSearch,
  Clock3,
} from "lucide-react";

import { useProject } from "@/contexts/ProjectContext";

const TABS = ["Overview", "Backlinks", "Referring Domains", "Pages", "History"];

const TAB_SECTIONS = {
  Overview: "backlinks",

  Backlinks: "backlinks",

  "Referring Domains": "referring-domains",

  Pages: "pages",

  History: "history",
};

const PAGE_SIZE = 10;

function fmt(value) {
  if (value === null || value === undefined || value === "") return "—";

  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? numeric.toLocaleString("en-US")
    : String(value);
}

function dateFmt(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
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

function SectionHeading({ title, description, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>

        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

function MetricCard({ label, value, subtitle, icon: Icon, tone = "cyan" }) {
  const tones = {
    cyan: "bg-cyan-500/10 text-cyan-500 ring-cyan-500/10",

    violet: "bg-violet-500/10 text-violet-500 ring-violet-500/10",

    amber: "bg-amber-500/10 text-amber-500 ring-amber-500/10",

    emerald: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/10",
  };

  return (
    <Panel className="group h-full w-full min-w-0 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>

          <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {fmt(value)}
          </p>
        </div>

        <div className={`rounded-xl p-3 ring-1 ${tones[tone] || tones.cyan}`}>
          <Icon size={19} />
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">{subtitle}</p>
    </Panel>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>

      <p className="mt-1.5 text-lg font-semibold tabular-nums">{fmt(value)}</p>
    </div>
  );
}

function formatBreakdownLabel(key, breakdownType = "generic") {
  const normalized = String(key ?? "").trim();

  // Empty keys in the API breakdown should be shown explicitly, not as a blank row.

  if (!normalized)
    return breakdownType === "country" ? "Unknown country" : "Unknown";

  if (breakdownType === "country") {
    const code = normalized.toUpperCase();

    if (code === "WW") return "Worldwide (WW)";

    // Preserve country codes from DataForSEO instead of guessing their meaning.

    return code;
  }

  return normalized;
}

function BarList({ data, total, limit = 8, breakdownType = "generic" }) {
  const entries = Object.entries(data || {})

    .filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        Number.isFinite(Number(value)),
    )

    .map(([key, value]) => [key, Number(value)])

    .sort((a, b) => b[1] - a[1])

    .slice(0, limit);

  if (!entries.length)
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No breakdown data available yet.
      </div>
    );

  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <div className="space-y-4">
      {entries.map(([key, count]) => {
        const label = formatBreakdownLabel(key, breakdownType);

        const pct =
          total && Number(total) > 0 ? (count / Number(total)) * 100 : null;

        return (
          <div key={`${breakdownType}-${String(key)}`}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span
                className="min-w-0 truncate text-muted-foreground"
                title={label}
              >
                {label}
              </span>

              <span className="shrink-0 font-medium tabular-nums">
                {fmt(count)}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(1, (count / max) * 100)}%` }}
              />
            </div>

            {pct !== null && (
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {pct.toFixed(1)}% of total
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DataTable({ columns, rows, emptyMessage = "No records found." }) {
  if (!rows?.length) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
          <FileSearch size={20} className="text-muted-foreground" />
        </div>

        <p className="mt-3 text-sm font-medium">Nothing to show yet</p>

        <p className="mt-1 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-y border-border bg-muted/35 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="whitespace-nowrap px-4 py-3.5 font-semibold sm:px-5"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-border/80">
          {rows.map((row, index) => (
            <tr
              key={`${row.id ?? row._id ?? [row.source, row.url, row.target, row.anchor, row.type, row.attribute, row.rank].map((value) => String(value ?? "")).join("|")}-${index}`}
              className="transition-colors hover:bg-muted/25"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="max-w-[360px] px-4 py-4 align-middle text-foreground sm:px-5"
                >
                  {column.render ? (
                    column.render(row[column.key], row)
                  ) : (
                    <span
                      className="block truncate"
                      title={String(row[column.key] ?? "—")}
                    >
                      {row[column.key] ?? "—"}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const broken = String(status || "").toLowerCase() === "broken";

  const label = status || "Unknown";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${broken ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${broken ? "bg-destructive" : "bg-emerald-500"}`}
      />

      {label}
    </span>
  );
}

function SectionState({ state, children }) {
  if (!state || state.loading)
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <LoaderCircle size={16} className="animate-spin" />
        Loading backlink data…
      </div>
    );

  if (state.error)
    return (
      <div
        role="alert"
        className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {state.error}
      </div>
    );

  return children;
}

function HistoryChart({ items }) {
  if (!items?.length)
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No saved history snapshots are available yet. Refresh and save reports
        over time to build this chart.
      </div>
    );

  const max = Math.max(...items.map((item) => Number(item.backlinks) || 0), 1);

  return (
    <div className="mt-4">
      <div className="flex h-56 items-end gap-2 border-b border-border px-1 pt-5 sm:gap-3">
        {items.map((item) => {
          const value = Number(item.backlinks) || 0;

          return (
            <div
              key={item.date}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              <div className="relative flex w-full flex-1 items-end justify-center">
                <div
                  className="w-full max-w-12 rounded-t-lg bg-primary/75 transition-colors group-hover:bg-primary"
                  style={{
                    height: `${Math.max(value ? 4 : 0, (value / max) * 88)}%`,
                  }}
                  title={`${fmt(value)} backlinks`}
                />
              </div>

              <span className="max-w-full truncate pb-2 text-[10px] text-muted-foreground sm:text-xs">
                {new Date(item.date).toLocaleDateString("en-US", {
                  month: "short",

                  year: "2-digit",
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BacklinksPage() {
  const { activeProject, activeProjectId } = useProject();

  const [activeTab, setActiveTab] = useState("Overview");

  const [query, setQuery] = useState("");

  const [country, setCountry] = useState("All countries");

  const [linkType, setLinkType] = useState("All types");

  const [page, setPage] = useState(1);

  const [showFilters, setShowFilters] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [lastUpdated, setLastUpdated] = useState(null);

  const [notice, setNotice] = useState("");

  const [apiError, setApiError] = useState("");

  const [liveReport, setLiveReport] = useState(null);

  const [dataSource, setDataSource] = useState("empty");

  const [domainSort, setDomainSort] = useState("links");

  const [details, setDetails] = useState({});

  const currentSummary = liveReport?.summary ?? {};

  const currentBreakdowns = liveReport?.breakdowns ?? {};

  const displayTarget =
    liveReport?.target ||
    activeProject?.main_url ||
    activeProject?.name ||
    "Select a project from the sidebar";

  const getApiBase = useCallback(
    () =>
      (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(
        /\/+$/,
        "",
      ),
    [],
  );

  const fetchWithNetworkError = useCallback(
    async (url, options) => {
      try {
        return await fetch(url, options);
      } catch (error) {
        throw new Error(
          `Cannot connect to the Odito API at ${getApiBase()}. Check that the backend is running, the API URL is correct, and CORS allows http://localhost:3000. Original error: ${error?.message || "Network request failed"}`,
        );
      }
    },
    [getApiBase],
  );

  const getAuthToken = useCallback(() => {
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
  }, []);

  const loadSavedBacklinks = useCallback(
    async (id = activeProjectId) => {
      if (!id) return;

      setApiError("");

      try {
        const token = getAuthToken();

        if (!token) throw new Error("No login token found. Sign in again.");

        const response = await fetchWithNetworkError(
          `${getApiBase()}/projects/${encodeURIComponent(id)}/backlinks`,

          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success)
          throw new Error(
            result.message || "Could not load the saved backlink report.",
          );

        if (result.data) {
          setLiveReport(result.data);

          setDataSource("database");

          setLastUpdated(
            result.data.fetched_at
              ? new Date(result.data.fetched_at).toLocaleString()
              : null,
          );

          setNotice("Saved backlink report loaded.");
        } else {
          setLiveReport(null);

          setDataSource("empty");

          setLastUpdated(null);

          setNotice(
            "No saved backlink report yet. Select Refresh data to fetch live metrics.",
          );
        }
      } catch (error) {
        setApiError(error.message || "Could not load backlink data.");
      }
    },

    [activeProjectId, getApiBase, getAuthToken, fetchWithNetworkError],
  );

  const loadSection = useCallback(
    async (section, force = false) => {
      if (!activeProjectId) return;

      setDetails((prev) => ({ ...prev, [section]: { loading: true } }));

      try {
        const token = getAuthToken();

        if (!token) throw new Error("No login token found. Sign in again.");

        const response = await fetchWithNetworkError(
          `${getApiBase()}/projects/${encodeURIComponent(activeProjectId)}/backlinks/details/${section}${force ? "?force=true" : ""}`,

          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success)
          throw new Error(result.message || "Could not load backlink details.");

        setDetails((prev) => ({
          ...prev,

          [section]: {
            loading: false,

            items: result.data?.items || [],

            total: result.data?.total ?? 0,
          },
        }));
      } catch (error) {
        setDetails((prev) => ({
          ...prev,

          [section]: {
            loading: false,

            error: error.message || "Could not load backlink data.",
          },
        }));
      }
    },

    [activeProjectId, getApiBase, getAuthToken, fetchWithNetworkError],
  );

  useEffect(() => {
    setDetails({});

    setLiveReport(null);

    setDataSource("empty");

    setLastUpdated(null);

    setNotice("");

    setApiError("");

    if (activeProjectId) loadSavedBacklinks(activeProjectId);
  }, [activeProjectId, loadSavedBacklinks]);

  useEffect(() => {
    const section = TAB_SECTIONS[activeTab];

    if (section && activeProjectId && !details[section]) loadSection(section);
  }, [activeTab, activeProjectId, details, loadSection]);

  const refreshLiveBacklinks = useCallback(async () => {
    if (refreshing) return;

    if (!activeProjectId) {
      setApiError("Select a project from the sidebar first.");

      return;
    }

    setRefreshing(true);

    setApiError("");

    setNotice("");

    try {
      const token = getAuthToken();

      if (!token) throw new Error("No login token found. Sign in again.");

      const response = await fetchWithNetworkError(
        `${getApiBase()}/projects/${encodeURIComponent(activeProjectId)}/backlinks/refresh`,

        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${token}`,

            "Content-Type": "application/json",
          },

          body: JSON.stringify({ force: true }),
        },
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success || !result.data)
        throw new Error(result.message || "Live backlink refresh failed.");

      setDetails({});

      setLiveReport(result.data);

      setDataSource(result.source === "dataforseo" ? "dataforseo" : "database");

      setLastUpdated(
        result.data.fetched_at
          ? new Date(result.data.fetched_at).toLocaleString()
          : new Date().toLocaleString(),
      );

      setNotice(
        result.source === "dataforseo"
          ? "Live DataForSEO metrics updated successfully."
          : "Saved backlink report loaded.",
      );

      const section = TAB_SECTIONS[activeTab];

      if (section) await loadSection(section, true);
    } catch (error) {
      setApiError(error.message || "Live backlink refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }, [
    activeProjectId,

    activeTab,

    refreshing,

    getApiBase,

    getAuthToken,

    loadSection,

    fetchWithNetworkError,
  ]);

  const backlinkRows = details.backlinks?.items || [];

  const domainRows = details["referring-domains"]?.items || [];

  const pageRows = details.pages?.items || [];

  const historyRows = details.history?.items || [];

  const countryOptions = useMemo(
    () =>
      [
        ...new Set(backlinkRows.map((item) => item.country).filter(Boolean)),
      ].sort(),

    [backlinkRows],
  );

  const typeOptions = useMemo(
    () =>
      [
        ...new Set(
          backlinkRows

            .map((item) => item.type)

            .filter((item) => item && item !== "—"),
        ),
      ].sort(),

    [backlinkRows],
  );

  const filteredBacklinks = useMemo(
    () =>
      backlinkRows.filter(
        (item) =>
          [item.source, item.url, item.target, item.anchor, item.attribute]

            .join(" ")

            .toLowerCase()

            .includes(query.toLowerCase()) &&
          (country === "All countries" || item.country === country) &&
          (linkType === "All types" || item.type === linkType),
      ),

    [backlinkRows, query, country, linkType],
  );

  const filteredDomains = useMemo(
    () =>
      domainRows

        .filter((item) =>
          (item.domain || "").toLowerCase().includes(query.toLowerCase()),
        )

        .sort((a, b) =>
          domainSort === "rank"
            ? (Number(b.rank) || 0) - (Number(a.rank) || 0)
            : (Number(b.links) || 0) - (Number(a.links) || 0),
        ),

    [domainRows, query, domainSort],
  );

  const totalPages = Math.max(
    1,

    Math.ceil(filteredBacklinks.length / PAGE_SIZE),
  );

  const paginatedBacklinks = filteredBacklinks.slice(
    (page - 1) * PAGE_SIZE,

    page * PAGE_SIZE,
  );

  function switchTab(tab) {
    setActiveTab(tab);

    setQuery("");

    setCountry("All countries");

    setLinkType("All types");

    setPage(1);

    setNotice("");
  }

  function resetFilters() {
    setQuery("");

    setCountry("All countries");

    setLinkType("All types");

    setPage(1);
  }

  function exportCsv() {
    let rows = [];

    let filename = "odito-backlinks.csv";

    if (activeTab === "Backlinks" || activeTab === "Overview")
      rows =
        activeTab === "Overview" ? backlinkRows.slice(0, 5) : filteredBacklinks;
    else if (activeTab === "Referring Domains") {
      rows = filteredDomains;

      filename = "odito-referring-domains.csv";
    } else if (activeTab === "Pages") {
      rows = pageRows;

      filename = "odito-backlink-pages.csv";
    } else {
      rows = Object.entries(currentBreakdowns.referring_links_types || {}).map(
        ([type, count]) => ({ type, count }),
      );

      filename = "odito-backlink-overview.csv";
    }

    if (!rows.length) {
      setNotice("No rows available to export in this section.");

      return;
    }

    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];

    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
      headers.map(escapeCsv).join(","),

      ...rows.map((row) =>
        headers.map((header) => escapeCsv(row[header])).join(","),
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;

    anchor.download = filename;

    anchor.click();

    URL.revokeObjectURL(url);

    setNotice("CSV exported successfully.");
  }

  const sourceLabel =
    dataSource === "dataforseo"
      ? "Live DataForSEO"
      : dataSource === "database"
        ? "Saved report"
        : "Waiting for report";

  const spamScore = currentSummary.backlinks_spam_score;

  return (
    <main className="min-h-full w-full min-w-0 bg-transparent text-foreground">
      <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-5 p-4 sm:p-5 lg:p-6">
        <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Projects</span>

              <ChevronRight size={13} />

              <span>SEO Analysis</span>

              <ChevronRight size={13} />

              <span className="font-semibold text-primary">Backlinks</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Backlinks
              </h1>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${dataSource === "dataforseo" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : dataSource === "database" ? "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400" : "border-border bg-muted/50 text-muted-foreground"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${dataSource === "dataforseo" ? "bg-emerald-500" : dataSource === "database" ? "bg-blue-500" : "bg-muted-foreground"}`}
                />

                {sourceLabel}
              </span>
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Monitor overall backlink health, explore referring domains and
              linked pages, and review link-quality signals from DataForSEO.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2.5 text-sm">
              <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                <Globe2 size={16} className="shrink-0 text-primary" />

                <span className="max-w-64 truncate font-medium">
                  {displayTarget}
                </span>
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 size={13} />

                {lastUpdated
                  ? `Last checked ${lastUpdated}`
                  : "No report fetched yet"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Download size={15} />
              Export CSV
            </button>

            <button
              type="button"
              onClick={refreshLiveBacklinks}
              disabled={refreshing || !activeProjectId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />

              {refreshing ? "Refreshing…" : "Refresh data"}
            </button>
          </div>
        </header>

        {!activeProjectId && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            Select a project from the sidebar to view its backlink report.
          </div>
        )}

        {apiError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <ShieldAlert size={17} className="mt-0.5 shrink-0" />

            <span>{apiError}</span>

            <button
              type="button"
              className="ml-auto rounded p-1 hover:bg-destructive/10"
              onClick={() => setApiError("")}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          >
            <span>{notice}</span>

            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
              className="rounded p-1 hover:bg-accent"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <section
          className="!grid w-full min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          }}
        >
          <MetricCard
            label="Total backlinks"
            value={currentSummary.backlinks}
            subtitle="Links reported for this target"
            icon={Link2}
            tone="cyan"
          />

          <MetricCard
            label="Referring domains"
            value={currentSummary.referring_domains}
            subtitle={`${fmt(currentSummary.referring_main_domains)} main domains`}
            icon={Globe2}
            tone="violet"
          />

          <MetricCard
            label="Backlink spam score"
            value={spamScore}
            subtitle="Third-party signal; investigate patterns before taking action"
            icon={ShieldAlert}
            tone="amber"
          />

          <MetricCard
            label="Broken backlinks"
            value={currentSummary.broken_backlinks}
            subtitle={`${fmt(currentSummary.broken_pages)} broken pages reported`}
            icon={Unlink}
            tone="emerald"
          />
        </section>

        <div className="border-b border-border">
          <nav
            className="flex min-w-max items-center gap-5 overflow-x-auto sm:gap-7"
            aria-label="Backlinks sections"
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchTab(tab)}
                className={`relative whitespace-nowrap pb-3 text-sm font-medium transition-colors ${activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab}

                {activeTab === tab && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === "Overview" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-3">
              <Panel className="p-4 sm:p-5 2xl:col-span-2">
                <SectionHeading
                  title="Backlink profile"
                  description="A snapshot of the website's referring-link footprint."
                />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  <MiniStat
                    label="Main referring domains"
                    value={currentSummary.referring_main_domains}
                  />

                  <MiniStat
                    label="Referring IPs"
                    value={currentSummary.referring_ips}
                  />

                  <MiniStat
                    label="Referring subnets"
                    value={currentSummary.referring_subnets}
                  />

                  <MiniStat
                    label="Referring pages"
                    value={currentSummary.referring_pages}
                  />

                  <MiniStat
                    label="Crawled pages"
                    value={currentSummary.crawled_pages}
                  />
                </div>

                <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-4 text-sm font-semibold">Link types</h3>

                    <BarList
                      data={currentBreakdowns.referring_links_types}
                      total={currentSummary.backlinks}
                    />
                  </div>

                  <div>
                    <h3 className="mb-4 text-sm font-semibold">
                      Link attributes
                    </h3>

                    <BarList
                      data={currentBreakdowns.referring_links_attributes}
                      limit={6}
                    />
                  </div>
                </div>
              </Panel>

              <Panel className="p-4 sm:p-5">
                <SectionHeading
                  title="Quality signals"
                  description="Signals to investigate—not automatic proof of harmful links."
                />

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <ShieldAlert size={17} />

                    <span className="text-sm font-semibold">
                      Backlink spam score
                    </span>
                  </div>

                  <p className="mt-3 text-3xl font-bold">
                    {fmt(spamScore)}

                    <span className="ml-1 text-sm font-medium text-muted-foreground">
                      / 100
                    </span>
                  </p>

                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Review repetitive anchors, unusual referring domains and
                    link patterns before deciding whether action is needed.
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Target spam score"
                    value={
                      liveReport?.info?.target_spam_score ??
                      currentSummary.target_spam_score
                    }
                  />

                  <MiniStat
                    label="Nofollow domains"
                    value={currentSummary.referring_domains_nofollow}
                  />
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
              <Panel className="p-4 sm:p-5">
                <SectionHeading
                  title="Top domain extensions"
                  description="Extensions associated with referring links."
                />

                <BarList
                  data={currentBreakdowns.referring_links_tld}
                  total={currentSummary.backlinks}
                  limit={10}
                />
              </Panel>

              <Panel className="p-4 sm:p-5">
                <SectionHeading
                  title="Referring link countries"
                  description="Country codes reported by DataForSEO."
                />

                <BarList
                  data={currentBreakdowns.referring_links_countries}
                  limit={8}
                  breakdownType="country"
                />
              </Panel>
            </div>
          </div>
        )}

        {activeTab === "Backlinks" && (
          <Panel className="overflow-hidden">
            <div className="p-4 sm:p-5">
              <SectionHeading
                title="Individual backlinks"
                description="Inspect source pages, target URLs, anchor text and link attributes."
                action={
                  <button
                    type="button"
                    onClick={() => setShowFilters((value) => !value)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${showFilters ? "border-primary/40 bg-primary/5 text-primary" : "border-border hover:bg-accent"}`}
                  >
                    <SlidersHorizontal size={15} />
                    Filters
                  </button>
                }
              />

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={16}
                    className="absolute left-3 top-3 text-muted-foreground"
                  />

                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);

                      setPage(1);
                    }}
                    placeholder="Search source, target or anchor…"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>

                {showFilters && (
                  <>
                    <select
                      value={country}
                      onChange={(event) => {
                        setCountry(event.target.value);

                        setPage(1);
                      }}
                      className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                    >
                      <option>All countries</option>

                      {countryOptions.map((code) => (
                        <option key={code}>{code}</option>
                      ))}
                    </select>

                    <select
                      value={linkType}
                      onChange={(event) => {
                        setLinkType(event.target.value);

                        setPage(1);
                      }}
                      className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                    >
                      <option>All types</option>

                      {typeOptions.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={resetFilters}
                      className="rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-accent"
                    >
                      Reset
                    </button>
                  </>
                )}
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {filteredBacklinks.length.toLocaleString()} matching records ·{" "}
                {fmt(details.backlinks?.total ?? currentSummary.backlinks)}{" "}
                total backlinks reported in the summary
              </p>
            </div>

            <SectionState state={details.backlinks}>
              <DataTable
                rows={paginatedBacklinks}
                emptyMessage="No backlink rows match these filters."
                columns={[
                  {
                    key: "source",

                    label: "Referring page",

                    render: (value, row) => (
                      <div className="min-w-44">
                        <p
                          className="max-w-64 truncate font-medium"
                          title={value}
                        >
                          {value || "—"}
                        </p>

                        {row.url && (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Open source <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    ),
                  },

                  {
                    key: "target",

                    label: "Target URL",

                    render: (value) => (
                      <span className="block max-w-56 truncate" title={value}>
                        {value || "—"}
                      </span>
                    ),
                  },

                  { key: "anchor", label: "Anchor text" },

                  { key: "type", label: "Type" },

                  { key: "attribute", label: "Attribute" },

                  { key: "rank", label: "Rank", render: fmt },

                  {
                    key: "status",

                    label: "Status",

                    render: (value) => <StatusBadge status={value} />,
                  },
                ]}
              />
            </SectionState>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                {filteredBacklinks.length ? (page - 1) * PAGE_SIZE + 1 : 0}–
                {Math.min(page * PAGE_SIZE, filteredBacklinks.length)} of{" "}
                {filteredBacklinks.length}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-border p-2 hover:bg-accent disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="min-w-14 text-center text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  className="rounded-lg border border-border p-2 hover:bg-accent disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </Panel>
        )}

        {activeTab === "Referring Domains" && (
          <Panel className="overflow-hidden">
            <div className="p-4 sm:p-5">
              <SectionHeading
                title="Referring domains"
                description="Find the domains sending links to your website."
              />

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniStat
                  label="Referring domains"
                  value={currentSummary.referring_domains}
                />

                <MiniStat
                  label="Main domains"
                  value={currentSummary.referring_main_domains}
                />

                <MiniStat
                  label="Nofollow domains"
                  value={currentSummary.referring_domains_nofollow}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative max-w-xl flex-1">
                  <Search
                    size={16}
                    className="absolute left-3 top-3 text-muted-foreground"
                  />

                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search referring domains…"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  Sort by
                  <select
                    value={domainSort}
                    onChange={(event) => setDomainSort(event.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2.5 text-foreground"
                  >
                    <option value="links">Backlinks</option>

                    <option value="rank">Rank</option>
                  </select>
                </label>
              </div>
            </div>

            <SectionState state={details["referring-domains"]}>
              <DataTable
                rows={filteredDomains}
                emptyMessage="No referring-domain records are available yet."
                columns={[
                  {
                    key: "domain",

                    label: "Domain",

                    render: (value) => (
                      <span className="font-semibold">{value || "—"}</span>
                    ),
                  },

                  { key: "links", label: "Backlinks", render: fmt },

                  { key: "pages", label: "Referring pages", render: fmt },

                  { key: "rank", label: "Rank", render: fmt },

                  { key: "spam_score", label: "Spam score", render: fmt },
                ]}
              />
            </SectionState>

            <div className="border-t border-border p-4 text-xs text-muted-foreground">
              Showing {filteredDomains.length} domain records.
            </div>
          </Panel>
        )}

        {activeTab === "Pages" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                label="Crawled pages"
                value={currentSummary.crawled_pages}
                subtitle="Pages crawled in backlink analysis"
                icon={Globe2}
                tone="cyan"
              />

              <MetricCard
                label="Internal links"
                value={currentSummary.internal_links_count}
                subtitle="Internal links reported"
                icon={Network}
                tone="violet"
              />

              <MetricCard
                label="External links"
                value={currentSummary.external_links_count}
                subtitle="External links reported"
                icon={ExternalLink}
                tone="emerald"
              />
            </div>

            <Panel className="overflow-hidden">
              <div className="p-4 sm:p-5">
                <SectionHeading
                  title="Pages receiving backlinks"
                  description="Your site's pages that receive links from external sources."
                />
              </div>

              <SectionState state={details.pages}>
                <DataTable
                  rows={pageRows}
                  emptyMessage="No page-level backlink records are available yet."
                  columns={[
                    {
                      key: "url",

                      label: "Target page",

                      render: (value) => (
                        <span
                          className="block max-w-lg truncate font-medium"
                          title={value}
                        >
                          {value || "—"}
                        </span>
                      ),
                    },

                    { key: "backlinks", label: "Backlinks", render: fmt },

                    { key: "domains", label: "Referring domains", render: fmt },

                    { key: "rank", label: "Rank", render: fmt },
                  ]}
                />
              </SectionState>
            </Panel>
          </div>
        )}

        {activeTab === "History" && (
          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-3">
            <Panel className="p-4 sm:p-5 2xl:col-span-2">
              <SectionHeading
                title="Backlink growth"
                description="Historical snapshots saved by Odito. A single snapshot cannot show a trend."
              />

              <SectionState state={details.history}>
                <HistoryChart items={historyRows} />
              </SectionState>
            </Panel>

            <Panel className="p-4 sm:p-5">
              <SectionHeading
                title="Latest summary"
                description="Most recent saved backlink report."
              />

              <div className="space-y-4">
                {[
                  ["Total backlinks", currentSummary.backlinks],

                  ["Referring domains", currentSummary.referring_domains],

                  ["Referring IPs", currentSummary.referring_ips],

                  [
                    "First seen",

                    currentSummary.first_seen
                      ? new Date(currentSummary.first_seen).toLocaleDateString()
                      : "—",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0"
                  >
                    <span className="text-sm text-muted-foreground">
                      {label}
                    </span>

                    <span className="text-right text-sm font-semibold">
                      {typeof value === "number" ? fmt(value) : (value ?? "—")}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        <footer className="flex flex-col justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row">
          <p>Odito · Backlink intelligence</p>

          <p>
            {sourceLabel} · {lastUpdated || "Not loaded"}
          </p>
        </footer>
      </div>
    </main>
  );
}
