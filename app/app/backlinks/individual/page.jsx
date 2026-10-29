"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Filter,
  Globe2,
  Link2,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Unlink,
  X,
} from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";

const PAGE_SIZE = 25;

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

function scoreTone(score) {
  if (score === null || score === undefined || score === "") return "neutral";
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return "neutral";
  if (numeric >= 60) return "red";
  if (numeric >= 30) return "amber";
  return "green";
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
    red: "bg-red-500/10 text-red-500",
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
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone] || styles.neutral}`}
    >
      {children}
    </span>
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

function normalizeItems(payload) {
  const items = payload?.data?.items;
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    ...item,
    __key: `${item?.url_from ?? "src"}|${item?.url_to ?? "dst"}|${item?.anchor ?? ""}|${index}`,
  }));
}

function ExternalUrl({ url, className = "" }) {
  if (!url) return <span>—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      title={url}
      className={`inline-flex max-w-full items-center gap-1 hover:text-primary hover:underline ${className}`}
    >
      <span className="truncate">{url.replace(/^https?:\/\//i, "")}</span>
      <ExternalLink size={12} className="shrink-0" />
    </a>
  );
}

function getAnchorLabel(item) {
  if (item.anchor) return item.anchor;
  if (item.item_type === "image") return "(image link)";
  return "(empty anchor)";
}

export default function IndividualBacklinksPage() {
  const { activeProject, activeProjectId } = useProject();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState(null);
  const [apiCost, setApiCost] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
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

  const loadBacklinks = useCallback(
    async ({ pageNumber = 1, force = false } = {}) => {
      if (!activeProjectId) {
        setItems([]);
        setLoading(false);
        setError("Select a project from the sidebar to view its backlinks.");
        return;
      }
      setError("");
      if (force) setRefreshing(true);
      else setLoading(true);
      try {
        const token = getAuthToken();
        if (!token)
          throw new Error("No login token found. Please sign in again.");
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String((pageNumber - 1) * PAGE_SIZE),
        });
        if (force) params.set("force", "true");
        const response = await fetch(
          `${getApiBase()}/projects/${encodeURIComponent(activeProjectId)}/individual-backlinks?${params.toString()}`,
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
              `Could not load backlinks (HTTP ${response.status}).`,
          );
        setItems(normalizeItems(payload));
        setTotalCount(Number(payload?.data?.total_count) || 0);
        setApiCost(payload?.data?.api_cost ?? null);
        setFetchedAt(payload?.data?.fetched_at || new Date().toISOString());
        setPage(pageNumber);
        setSelected(null);
      } catch (err) {
        setError(err?.message || "Could not load backlinks.");
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
    setFilter("all");
    setPage(1);
    loadBacklinks({ pageNumber: 1 });
  }, [activeProjectId, loadBacklinks]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (
        query &&
        ![item.url_from, item.url_to, item.domain_from, item.anchor]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(query))
      )
        return false;
      if (filter === "dofollow") return item.dofollow === true;
      if (filter === "nofollow") return item.dofollow === false;
      if (filter === "broken") return item.is_broken === true;
      if (filter === "new") return item.is_new === true;
      if (filter === "lost") return item.is_lost === true;
      return true;
    });
  }, [items, search, filter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const dofollowCount = items.filter((item) => item.dofollow).length;
  const brokenCount = items.filter((item) => item.is_broken).length;
  const riskyCount = items.filter(
    (item) => Number(item.backlink_spam_score) >= 30,
  ).length;

  function exportCsv() {
    if (!filteredItems.length) return;
    const columns = [
      ["source_url", (item) => item.url_from],
      ["source_domain", (item) => item.domain_from],
      ["target_url", (item) => item.url_to],
      ["anchor", (item) => item.anchor],
      ["link_type", (item) => item.item_type],
      ["dofollow", (item) => item.dofollow],
      ["attributes", (item) => (item.attributes || []).join(" ")],
      ["is_broken", (item) => item.is_broken],
      ["target_status_code", (item) => item.url_to_status_code],
      ["spam_score", (item) => item.backlink_spam_score],
      ["rank", (item) => item.rank],
      ["first_seen", (item) => item.first_seen],
      ["last_seen", (item) => item.last_seen],
    ];
    const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      columns.map(([label]) => quote(label)).join(","),
      ...filteredItems.map((item) =>
        columns.map(([, getValue]) => quote(getValue(item))).join(","),
      ),
    ].join("\n");
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "odito-individual-backlinks.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-full w-full min-w-0 bg-transparent text-foreground">
      <div className="mx-auto w-full min-w-0 space-y-5 p-4 sm:p-5 lg:p-6">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Projects</span>
              <ChevronRight size={13} />
              <span>Backlinks</span>
              <ChevronRight size={13} />
              <span className="font-medium text-primary">
                Individual Backlinks
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Individual Backlinks
              </h1>
              <Badge tone="cyan">Link-level data</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Every link pointing to your site: where it comes from, which page
              it targets, its anchor text, follow status and whether the target
              is broken.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <div className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
                <Globe2 size={16} className="shrink-0 text-primary" />
                <span className="max-w-72 truncate font-medium">
                  {domain || "Select a project"}
                </span>
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
              onClick={() => loadBacklinks({ pageNumber: 1, force: true })}
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
              <p className="font-medium">Unable to load backlinks</p>
              <p className="mt-1">{error}</p>
              {activeProjectId && (
                <button
                  type="button"
                  onClick={() => loadBacklinks({ pageNumber: page })}
                  className="mt-2 underline underline-offset-2"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total backlinks"
            value={loading ? "…" : formatNumber(totalCount)}
            note="All live links reported by DataForSEO"
            icon={Link2}
          />
          <MetricCard
            label="Dofollow (this page)"
            value={loading ? "…" : formatNumber(dofollowCount)}
            note={`Out of ${formatNumber(items.length)} links on this page`}
            icon={ExternalLink}
            tone="violet"
          />
          <MetricCard
            label="Broken targets (this page)"
            value={loading ? "…" : formatNumber(brokenCount)}
            note="Links whose target URL returns an error"
            icon={Unlink}
            tone="red"
          />
          <MetricCard
            label="Higher spam risk (this page)"
            value={loading ? "…" : formatNumber(riskyCount)}
            note="Spam score of 30 or more. Review, not proof of spam"
            icon={ShieldAlert}
            tone="amber"
          />
        </section>

        <Panel className="overflow-hidden">
          <div className="border-b border-border p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
              <div>
                <h2 className="text-base font-semibold">Backlink records</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search and filter apply to the links on the current page.
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
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search source, target or anchor…"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
                <div className="relative">
                  <Filter
                    size={15}
                    className="pointer-events-none absolute left-3 top-3 text-muted-foreground"
                  />
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-44"
                  >
                    <option value="all">All links</option>
                    <option value="dofollow">Dofollow</option>
                    <option value="nofollow">Nofollow</option>
                    <option value="broken">Broken target</option>
                    <option value="new">New</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Showing {formatNumber(filteredItems.length)} of{" "}
              {formatNumber(items.length)} links on this page
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <LoaderCircle size={17} className="animate-spin" />
              Loading backlinks from DataForSEO…
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No matching backlinks"
              description={
                items.length
                  ? "Try changing the search or filter."
                  : "No backlinks are available for this project yet. Use Refresh data to try again."
              }
            />
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-y border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Source page</th>
                    <th className="px-4 py-3 font-medium">Target page</th>
                    <th className="px-4 py-3 font-medium">Anchor</th>
                    <th className="px-4 py-3 font-medium">Follow</th>
                    <th className="px-4 py-3 font-medium">Target status</th>
                    <th className="px-4 py-3 font-medium">Spam</th>
                    <th className="px-4 py-3 font-medium">Last seen</th>
                    <th className="px-5 py-3 text-right font-medium">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((item) => {
                    const isSelected = selected?.__key === item.__key;
                    return (
                      <Fragment key={item.__key}>
                        <tr
                          className={`cursor-pointer transition-colors hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}
                          onClick={() => setSelected(isSelected ? null : item)}
                        >
                          <td className="max-w-[300px] px-5 py-4">
                            <p className="truncate font-medium">
                              {item.domain_from}
                            </p>
                            <div className="mt-1 text-xs text-muted-foreground">
                              <ExternalUrl url={item.url_from} />
                            </div>
                            <div className="mt-1.5 flex gap-1.5">
                              {item.is_new && <Badge tone="green">New</Badge>}
                              {item.is_lost && <Badge tone="red">Lost</Badge>}
                            </div>
                          </td>
                          <td className="max-w-[260px] px-4 py-4 text-xs text-muted-foreground">
                            <ExternalUrl url={item.url_to} />
                          </td>
                          <td className="max-w-[220px] px-4 py-4">
                            <span
                              className="block truncate"
                              title={getAnchorLabel(item)}
                            >
                              {getAnchorLabel(item)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.item_type || "link"}
                              {item.semantic_location
                                ? ` · ${item.semantic_location}`
                                : ""}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <Badge tone={item.dofollow ? "green" : "neutral"}>
                              {item.dofollow ? "Dofollow" : "Nofollow"}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            {item.is_broken ? (
                              <Badge tone="red">
                                Broken
                                {item.url_to_status_code
                                  ? ` · ${item.url_to_status_code}`
                                  : ""}
                              </Badge>
                            ) : (
                              <Badge
                                tone={
                                  item.url_to_status_code >= 300
                                    ? "amber"
                                    : "green"
                                }
                              >
                                {item.url_to_status_code ?? "OK"}
                                {item.url_to_status_code >= 300 &&
                                item.url_to_status_code < 400
                                  ? " · Redirect"
                                  : ""}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {item.backlink_spam_score == null ? (
                              "—"
                            ) : (
                              <Badge tone={scoreTone(item.backlink_spam_score)}>
                                {formatNumber(item.backlink_spam_score)}
                              </Badge>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                            {formatDate(item.last_seen)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelected(isSelected ? null : item);
                              }}
                              aria-label={`View details for link from ${item.domain_from}`}
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
                          <tr className="bg-muted/20">
                            <td colSpan={8} className="p-0">
                              <BacklinkDetails
                                item={item}
                                onClose={() => setSelected(null)}
                              />
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

          {!loading && totalCount > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
              <p className="text-xs text-muted-foreground">
                Page {formatNumber(page)} of {formatNumber(totalPages)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => loadBacklinks({ pageNumber: page - 1 })}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => loadBacklinks({ pageNumber: page + 1 })}
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Panel>

        <footer className="flex flex-col justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row">
          <p>Odito · Individual Backlinks</p>
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

function BacklinkDetails({ item, onClose }) {
  const facts = [
    ["Domain rank", item.domain_from_rank],
    ["Page rank", item.page_from_rank],
    ["Link rank", item.rank],
    ["Spam score", item.backlink_spam_score],
    ["External links on page", item.page_from_external_links],
    ["Internal links on page", item.page_from_internal_links],
  ];
  const rows = [
    ["Source page title", item.page_from_title],
    ["Source country", item.domain_from_country],
    ["Source language", item.page_from_language],
    ["Source platform", (item.domain_from_platform_type || []).join(", ")],
    ["Link attributes", (item.attributes || []).join(", ") || "None"],
    ["Link placement", item.semantic_location],
    ["First seen", formatDate(item.first_seen)],
    ["Last seen", formatDate(item.last_seen)],
    ["Redirects to", item.url_to_redirect_target],
  ];
  return (
    <div className="border-y border-primary/20 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Selected backlink
          </p>
          <h3 className="mt-1 break-words text-base font-semibold">
            {getAnchorLabel(item)}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
          aria-label="Close backlink details"
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {facts.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-3"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-lg font-semibold tabular-nums">
              {formatNumber(value)}
            </p>
          </div>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 break-words font-medium">
              {value || "—"}
            </dd>
          </div>
        ))}
      </dl>
      {item.text_post && (
        <p className="mt-4 rounded-xl bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          <span className="font-medium text-foreground">{item.anchor}</span>
          {item.text_post}
        </p>
      )}
    </div>
  );
}
