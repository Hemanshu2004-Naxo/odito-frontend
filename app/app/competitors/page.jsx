

"use client";



import { Fragment, useCallback, useEffect, useMemo, useState } from "react";



import {

  Activity,

  ArrowDownUp,

  ChevronDown,

  ChevronUp,

  ExternalLink,

  Globe2,

  LoaderCircle,

  RefreshCw,

  Search,

  ShieldAlert,

  Target,

  TrendingUp,

  Users,

} from "lucide-react";



import { useProject } from "@/contexts/ProjectContext";



const DEFAULT_LIMIT = 20;



function formatNumber(value, digits = 0) {

  if (value === null || value === undefined || value === "") return "—";



  const number = Number(value);



  if (!Number.isFinite(number)) return "—";



  return number.toLocaleString("en-US", {

    maximumFractionDigits: digits,

    minimumFractionDigits: digits,

  });

}



function formatDomain(value) {

  if (!value) return "—";



  return String(value)

    .replace(/^https?:\/\//i, "")

    .replace(/^www\./i, "")

    .replace(/\/$/, "");

}



function domainUrl(value) {

  const domain = formatDomain(value);



  if (domain === "—") return "#";



  return `https\://${domain}`;

}



function getApiBase() {

  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
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



function getOrganicMetrics(item) {

  return (

    item?.competitor_metrics?.organic ||

    item?.full_domain_metrics?.organic ||

    item?.metrics?.organic ||

    {}

  );

}



function getKeywordCount(item) {

  const metrics = getOrganicMetrics(item);



  return Number(metrics.count ?? item?.intersections ?? 0);

}



function getEstimatedTraffic(item) {

  const metrics = getOrganicMetrics(item);



  return Number(metrics.etv ?? 0);

}



function getPosition(item) {

  const value = Number(item?.avg_position);



  return Number.isFinite(value) && value > 0 ? value : null;

}



function MetricCard({

  icon: Icon,

  label,

  value,

  hint,

  accent = "cyan",

}) {

  const accentClass =

    accent === "violet"

      ? "bg-violet-500/10 text-violet-600 dark:text-violet-300"

      : accent === "emerald"

        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"

        : accent === "amber"

          ? "bg-amber-500/10 text-amber-600 dark:text-amber-300"

          : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300";



  return (

    <div className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">

      <div className="flex items-start justify-between gap-3">

        <p className="text-sm font-medium text-muted-foreground">{label}</p>



        <span

          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentClass}`}

        >

          <Icon size={19} />

        </span>

      </div>



      <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">

        {value}

      </p>



      <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>

    </div>

  );

}



function PositionPill({ value }) {

  if (value == null) {

    return <span className="text-muted-foreground">—</span>;

  }



  const color =

    value <= 10

      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"

      : value <= 20

        ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"

        : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300";



  return (

    <span

      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${color}`}

    >

      {value.toFixed(1)}

    </span>

  );

}



function DetailItem({ label, value }) {

  let displayValue = "—";



  if (value !== null && value !== undefined && value !== "") {

    displayValue =

      typeof value === "object"

        ? JSON.stringify(value, null, 2)

        : String(value);

  }



  return (

    <div className="min-w-0 rounded-xl border border-border bg-background p-3">

      <p className="text-xs font-medium text-muted-foreground">{label}</p>



      <p className="mt-2 break-words text-sm text-foreground">

        {displayValue}

      </p>

    </div>

  );

}



function CompetitorDetails({ item }) {

  const metrics = getOrganicMetrics(item);

  const domainMetrics = item?.full_domain_metrics?.organic || {};

  const competitorMetrics = item?.competitor_metrics?.organic || {};

  const projectMetrics = item?.metrics?.organic || {};



  const topTen =

    Number(metrics.pos_1 || 0) +

    Number(metrics.pos_2_3 || 0) +

    Number(metrics.pos_4_10 || 0);



  const rankings = [

    { label: "Position 1", key: "pos_1" },

    { label: "Positions 2–3", key: "pos_2_3" },

    { label: "Positions 4–10", key: "pos_4_10" },

    { label: "Positions 11–20", key: "pos_11_20" },

    { label: "Positions 21–30", key: "pos_21_30" },

    { label: "Positions 31–40", key: "pos_31_40" },

    { label: "Positions 41–50", key: "pos_41_50" },

    { label: "Positions 51–60", key: "pos_51_60" },

    { label: "Positions 61–70", key: "pos_61_70" },

    { label: "Positions 71–80", key: "pos_71_80" },

    { label: "Positions 81–90", key: "pos_81_90" },

    { label: "Positions 91–100", key: "pos_91_100" },

  ];



  return (

    <div className="space-y-6 border-t border-border bg-muted/30 p-5 sm:p-6">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h3 className="text-base font-semibold text-foreground">

            Competitor SEO details

          </h3>



          <p className="mt-1 text-sm text-muted-foreground">

            Available metrics returned by DataForSEO for this domain.

          </p>

        </div>



        <a

          href={domainUrl(item.domain)}

          target="_blank"

          rel="noopener noreferrer"

          className="inline-flex w-fit items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-300"

        >

          Visit website

          <ExternalLink size={15} />

        </a>

      </div>



      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

        <MetricCard

          icon={Users}

          label="Shared keywords"

          value={formatNumber(item.intersections)}

          hint="Keyword overlap with your target"

        />



        <MetricCard

          icon={Target}

          label="Average position"

          value={

            getPosition(item) == null

              ? "—"

              : getPosition(item).toFixed(1)

          }

          hint="Average ranking position"

          accent="emerald"

        />



        <MetricCard

          icon={TrendingUp}

          label="Organic keywords"

          value={formatNumber(metrics.count ?? item.intersections)}

          hint="Organic keyword count from selected metrics"

          accent="violet"

        />



        <MetricCard

          icon={Activity}

          label="Estimated traffic value"

          value={formatNumber(metrics.etv, 2)}

          hint="DataForSEO estimated traffic value"

          accent="amber"

        />

      </div>



      <section>

        <h4 className="mb-3 text-sm font-semibold text-foreground">

          Organic ranking distribution

        </h4>



        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

          {rankings.map(({ label, key }) => (

            <DetailItem

              key={key}

              label={label}

              value={metrics[key]}

            />

          ))}



          <DetailItem label="Total rankings 1–10" value={topTen} />



          <DetailItem

            label="Estimated paid traffic cost"

            value={metrics.estimated_paid_traffic_cost}

          />



          <DetailItem label="New keywords" value={metrics.is_new} />



          <DetailItem label="Improved rankings" value={metrics.is_up} />



          <DetailItem label="Declined rankings" value={metrics.is_down} />



          <DetailItem label="Lost keywords" value={metrics.is_lost} />

        </div>

      </section>



      <section>

        <h4 className="mb-3 text-sm font-semibold text-foreground">

          Domain metrics

        </h4>



        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

          <DetailItem label="Domain" value={item.domain} />



          <DetailItem

            label="Average position"

            value={

              item.avg_position == null

                ? "—"

                : Number(item.avg_position).toFixed(2)

            }

          />



          <DetailItem label="Sum of positions" value={item.sum_position} />



          <DetailItem

            label="Domain organic keywords"

            value={domainMetrics.count}

          />



          <DetailItem

            label="Domain estimated traffic"

            value={domainMetrics.etv}

          />



          <DetailItem

            label="Domain estimated paid traffic cost"

            value={domainMetrics.estimated_paid_traffic_cost}

          />

        </div>

      </section>



      <section>

        <h4 className="mb-3 text-sm font-semibold text-foreground">

          Competitor-specific metrics

        </h4>



        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

          <DetailItem

            label="Competitor organic keywords"

            value={competitorMetrics.count}

          />



          <DetailItem

            label="Competitor estimated traffic"

            value={competitorMetrics.etv}

          />



          <DetailItem

            label="Competitor estimated paid traffic cost"

            value={competitorMetrics.estimated_paid_traffic_cost}

          />



          <DetailItem

            label="Project organic keywords"

            value={projectMetrics.count}

          />



          <DetailItem

            label="Project estimated traffic"

            value={projectMetrics.etv}

          />



          <DetailItem

            label="Project estimated paid traffic cost"

            value={projectMetrics.estimated_paid_traffic_cost}

          />

        </div>

      </section>

    </div>

  );

}



export default function CompetitorsPage() {

  const { activeProject, activeProjectId } = useProject();



  const [report, setReport] = useState(null);

  const [projectInfo, setProjectInfo] = useState(null);

  const [loading, setLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [query, setQuery] = useState("");

  const [sortBy, setSortBy] = useState("intersections");

  const [limit, setLimit] = useState(String(DEFAULT_LIMIT));

  const [expandedDomain, setExpandedDomain] = useState(null);



  const displayTarget =

    projectInfo?.target ||

    activeProject?.main_url ||

    activeProject?.project_url ||

    activeProject?.url ||

    activeProject?.project_name ||

    activeProject?.name ||

    "Select a project from the sidebar";



  const loadSaved = useCallback(

    async (projectId = activeProjectId) => {

      if (!projectId) {

        setReport(null);

        setProjectInfo(null);

        setExpandedDomain(null);

        setError(

          "Select a project from the sidebar to discover its search competitors."

        );

        return;

      }



      setLoading(true);

      setError("");

      setExpandedDomain(null);



      try {

        const token = getAuthToken();



        if (!token) {

          throw new Error("No login token found. Sign in again.");

        }



        const response = await fetch(

          `${getApiBase()}/projects/${encodeURIComponent(projectId)}/competitors`,

          {

            headers: { Authorization: `Bearer ${token}` },

            cache: "no-store",

          }

        );



        const result = await response.json().catch(() => ({}));



        if (!response.ok || !result.success) {

          throw new Error(

            result.message || "Could not load competitor report."

          );

        }



        setProjectInfo(result.project || null);

        setReport(result.data || null);



        setNotice(

          result.data

            ? "Saved competitor report loaded."

            : "No competitor report saved yet. Select Refresh data to discover competitors."

        );

      } catch (err) {

        setError(err.message || "Could not load competitor data.");

      } finally {

        setLoading(false);

      }

    },

    [activeProjectId]

  );



  const refresh = useCallback(async () => {

    if (!activeProjectId) {

      setError("Select a project from the sidebar first.");

      return;

    }



    setRefreshing(true);

    setError("");

    setNotice("");

    setExpandedDomain(null);



    try {

      const token = getAuthToken();



      if (!token) {

        throw new Error("No login token found. Sign in again.");

      }



      const response = await fetch(

        `${getApiBase()}/projects/${encodeURIComponent(activeProjectId)}/competitors/refresh`,

        {

          method: "POST",

          headers: {

            Authorization: `Bearer ${token}`,

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            limit: Number(limit) || DEFAULT_LIMIT,

          }),

        }

      );



      const result = await response.json().catch(() => ({}));



      if (!response.ok || !result.success) {

        throw new Error(

          result.message || "Could not refresh competitor data."

        );

      }



      setReport(result.data || null);



      setProjectInfo(

        (previous) =>

          previous || {

            target:

              activeProject?.main_url ||

              activeProject?.project_url ||

              activeProject?.url,

            country: activeProject?.country || "India",

            language: activeProject?.language || "English",

          }

      );



      setNotice("Competitor data refreshed successfully.");

    } catch (err) {

      setError(err.message || "Could not refresh competitor data.");

    } finally {

      setRefreshing(false);

    }

  }, [activeProjectId, activeProject, limit]);



  useEffect(() => {

    loadSaved(activeProjectId);

  }, [activeProjectId, loadSaved]);



const items = useMemo(() => {
    const source = Array.isArray(report?.items) ? report.items : [];
    const uniqueDomains = new Map();

    for (const item of source) {
      const domain = String(item?.domain || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .split("/")[0];

      if (!domain) continue;

      const existing = uniqueDomains.get(domain);
      if (
        !existing ||
        Number(item.intersections || 0) >
          Number(existing.intersections || 0)
      ) {
        uniqueDomains.set(domain, { ...item, domain });
      }
    }

    const filtered = [...uniqueDomains.values()].filter((item) =>
      item.domain.includes(query.trim().toLowerCase())
    );

    return filtered.sort((a, b) => {
      if (sortBy === "position") {
        return (getPosition(a) ?? Infinity) - (getPosition(b) ?? Infinity);
      }

      if (sortBy === "traffic") {
        return getEstimatedTraffic(b) - getEstimatedTraffic(a);
      }

      return Number(b.intersections || 0) - Number(a.intersections || 0);
    });
  }, [report, query, sortBy]);

  const summary = useMemo(() => {

    const all = Array.isArray(report?.items) ? report.items : [];



    const targetDomain = formatDomain(report?.target).toLowerCase();



    const competitors = all.filter(

      (item) => String(item.domain || "").toLowerCase() !== targetDomain

    );



    const overlap = competitors.reduce(

      (max, item) => Math.max(max, Number(item.intersections) || 0),

      0

    );



    const positions = competitors

      .map(getPosition)

      .filter((value) => value != null);



    const averagePosition = positions.length

      ? positions.reduce((sum, value) => sum + value, 0) / positions.length

      : null;



    const traffic = competitors.reduce(

      (sum, item) => sum + getEstimatedTraffic(item),

      0

    );



    return {

      count: competitors.length,

      overlap,

      averagePosition,

      traffic,

    };

  }, [report]);



  const lastUpdated = report?.fetched_at

    ? new Date(report.fetched_at).toLocaleString()

    : null;



  const hasData = Boolean(report && Array.isArray(report.items));



  return (

    <main className="min-h-full w-full min-w-0 bg-transparent text-foreground">

      <div className="mx-auto w-full max-w-[1500px] space-y-6 py-2">

        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-3">

              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">

                Competitor Analysis

              </h1>



              <span

                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${

                  hasData

                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"

                    : "border-border bg-muted text-muted-foreground"

                }`}

              >

                <span

                  className={`h-1.5 w-1.5 rounded-full ${

                    hasData ? "bg-emerald-500" : "bg-muted-foreground"

                  }`}

                />

                {hasData ? "Saved report" : "Competitor discovery"}

              </span>

            </div>



            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">

              Find domains ranking for similar Google keywords, compare organic

              visibility, and identify competitors worth investigating.

            </p>



            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">

              <span className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-foreground">

                <Globe2 size={16} className="shrink-0 text-cyan-600 dark:text-cyan-400" />

                <span className="truncate">{formatDomain(displayTarget)}</span>

              </span>



              <span className="text-xs text-muted-foreground">

                {projectInfo?.country || activeProject?.country || "India"} ·{" "}

                {projectInfo?.language || activeProject?.language || "English"}

              </span>



              {lastUpdated && (

                <span className="text-xs text-muted-foreground">

                  Last checked {lastUpdated}

                </span>

              )}

            </div>

          </div>



          <div className="flex shrink-0 flex-wrap items-center gap-2">

            <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground/80">

              <span className="text-xs text-muted-foreground">Results</span>



              <select

                value={limit}

                onChange={(event) => setLimit(event.target.value)}

                className="bg-transparent text-foreground outline-none"

              >

                {[10, 20, 50, 100].map((value) => (

                  <option

                    key={value}

                    value={String(value)}

                    className="bg-card"

                  >

                    {value}

                  </option>

                ))}

              </select>

            </label>



            <button

              type="button"

              onClick={refresh}

              disabled={refreshing || !activeProjectId}

              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"

            >

              {refreshing ? (

                <LoaderCircle size={16} className="animate-spin" />

              ) : (

                <RefreshCw size={16} />

              )}



              {refreshing ? "Discovering…" : "Refresh data"}

            </button>

          </div>

        </header>



        {notice && !error && (

          <div

            role="status"

            className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3 text-sm text-foreground"

          >

            {notice}

          </div>

        )}



        {error && (

          <div

            role="alert"

            className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-700 dark:text-rose-300"

          >

            <ShieldAlert size={17} className="mt-0.5 shrink-0" />

            <span>{error}</span>

          </div>

        )}



        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">

          <MetricCard

            icon={Users}

            label="Competitors found"

            value={hasData ? formatNumber(summary.count) : "—"}

            hint="Domains returned by the latest request"

          />



          <MetricCard

            icon={Target}

            label="Top keyword overlap"

            value={hasData ? formatNumber(summary.overlap) : "—"}

            hint="Largest shared-keyword count among returned competitors"

            accent="violet"

          />



          <MetricCard

            icon={Activity}

            label="Average position"

            value={

              summary.averagePosition == null

                ? "—"

                : summary.averagePosition.toFixed(1)

            }

            hint="Mean average position across returned competitors"

            accent="emerald"

          />



          <MetricCard

            icon={TrendingUp}

            label="Estimated organic traffic"

            value={hasData ? formatNumber(summary.traffic) : "—"}

            hint="DataForSEO estimate, not analytics visits"

            accent="amber"

          />

        </section>



        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">

          <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h2 className="text-base font-semibold">Competitor domains</h2>



              <p className="mt-1 text-sm text-muted-foreground">

                Search overlap is a signal of SEO competition, not proof of

                direct business competition.

              </p>

            </div>



            <div className="flex flex-col gap-2 sm:flex-row">

              <label className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 sm:w-72">

                <Search size={16} className="shrink-0 text-muted-foreground" />



                <input

                  value={query}

                  onChange={(event) => setQuery(event.target.value)}

                  placeholder="Search domain…"

                  className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"

                />

              </label>



              <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground/80">

                <ArrowDownUp size={15} className="text-muted-foreground" />



                <select

                  value={sortBy}

                  onChange={(event) => setSortBy(event.target.value)}

                  className="bg-transparent text-sm text-foreground outline-none"

                >

                  <option value="intersections" className="bg-card">

                    Most shared keywords

                  </option>



                  <option value="position" className="bg-card">

                    Best average position

                  </option>



                  <option value="traffic" className="bg-card">

                    Estimated traffic

                  </option>

                </select>

              </label>

            </div>

          </div>



          {loading && !hasData ? (

            <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-muted-foreground">

              <LoaderCircle size={18} className="animate-spin text-cyan-600 dark:text-cyan-400" />

              Loading saved competitor report…

            </div>

          ) : !hasData ? (

            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">

              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">

                <Target size={25} />

              </span>



              <h3 className="mt-4 text-base font-semibold">

                Discover your search competitors

              </h3>



              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">

                Run a DataForSEO competitor-domain lookup for the selected

                project. Results will be saved so the page can load without

                making a new API request every time.

              </p>



              <button

                type="button"

                onClick={refresh}

                disabled={refreshing || !activeProjectId}

                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"

              >

                {refreshing ? (

                  <LoaderCircle size={16} className="animate-spin" />

                ) : (

                  <RefreshCw size={16} />

                )}



                {refreshing

                  ? "Discovering competitors…"

                  : "Discover competitors"}

              </button>

            </div>

          ) : items.length === 0 ? (

            <div className="px-6 py-14 text-center text-sm text-muted-foreground">

              No competitor domains match your search.

            </div>

          ) : (

            <>

              <div className="w-full overflow-x-auto">

                <table className="w-full min-w-[1000px] text-left text-sm">

                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">

                    <tr>

                      <th scope="col" className="px-5 py-4 font-medium">

                        Domain

                      </th>



                      <th scope="col" className="px-5 py-4 font-medium">

                        Shared keywords

                      </th>



                      <th scope="col" className="px-5 py-4 font-medium">

                        Avg. position

                      </th>



                      <th scope="col" className="px-5 py-4 font-medium">

                        Organic keywords

                      </th>



                      <th scope="col" className="px-5 py-4 font-medium">

                        Est. traffic value

                      </th>



                      <th scope="col" className="px-5 py-4 font-medium">

                        Rankings 1–10

                      </th>



                      <th scope="col" className="px-5 py-4 font-medium">

                        Website

                      </th>

                    </tr>

                  </thead>



                  <tbody className="divide-y divide-border">

                    {items.map((item, index) => {

                      const metrics = getOrganicMetrics(item);



                      const topTen =

                        Number(metrics.pos_1 || 0) +

                        Number(metrics.pos_2_3 || 0) +

                        Number(metrics.pos_4_10 || 0);



                      const domainKey = String(item.domain || "")
                        .trim()
                        .toLowerCase()
                        .replace(/^https?:\/\//i, "")
                        .replace(/^www\./i, "")
                        .split("/")[0];
                      const isExpanded = expandedDomain === domainKey;
                      const detailId = `competitor-details-${index}`;
                      return (
                        <Fragment key={domainKey}>
                          <tr

                            className={`transition ${

                              isExpanded

                                ? "bg-cyan-500/[0.06]"

                                : "hover:bg-accent/60"

                            }`}

                          >

                            <td className="max-w-[300px] px-5 py-4">

                              <div className="flex items-center gap-3">

                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">

                                  <Globe2 size={16} />

                                </span>



                                <div className="min-w-0">

                                  <button

                                    type="button"

                                    aria-expanded={isExpanded}

                                    aria-controls={detailId}

                                    onClick={() =>

                                      setExpandedDomain(

                                        isExpanded ? null : domainKey

                                      )

                                    }

                                    className="block max-w-full truncate text-left font-semibold text-foreground hover:text-cyan-600 dark:hover:text-cyan-300"

                                  >

                                    {formatDomain(item.domain)}

                                  </button>



                                  <span className="mt-1 block text-xs text-muted-foreground">

                                    {index + 1}. Search competitor

                                  </span>

                                </div>

                              </div>

                            </td>



                            <td className="px-5 py-4">

                              <span className="font-semibold text-foreground">

                                {formatNumber(item.intersections)}

                              </span>

                            </td>



                            <td className="px-5 py-4">

                              <PositionPill value={getPosition(item)} />

                            </td>



                            <td className="px-5 py-4 text-foreground/80">

                              {formatNumber(

                                metrics.count ?? item.intersections

                              )}

                            </td>



                            <td className="px-5 py-4 text-foreground/80">

                              {metrics.etv == null

                                ? "—"

                                : formatNumber(metrics.etv, 2)}

                            </td>



                            <td className="px-5 py-4 text-foreground/80">

                              {formatNumber(topTen)}

                            </td>



                            <td className="px-5 py-4">

                              <div className="flex items-center gap-2">

                                <a

                                  href={domainUrl(item.domain)}

                                  target="_blank"

                                  rel="noopener noreferrer"

                                  aria-label={`Open ${item.domain}`}

                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-300"

                                >

                                  <ExternalLink size={15} />

                                </a>



                                <button

                                  type="button"

                                  aria-label={

                                    isExpanded

                                      ? "Collapse competitor details"

                                      : "Expand competitor details"

                                  }

                                  aria-expanded={isExpanded}

                                  aria-controls={detailId}

                                  onClick={() =>

                                    setExpandedDomain(

                                      isExpanded ? null : domainKey

                                    )

                                  }

                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-300"

                                >

                                  {isExpanded ? (

                                    <ChevronUp size={16} />

                                  ) : (

                                    <ChevronDown size={16} />

                                  )}

                                </button>

                              </div>

                            </td>

                          </tr>



                          {isExpanded && (

                            <tr
                              className="bg-muted/30"

                            >

                              <td colSpan={7} className="p-0">

                                <div id={detailId}>

                                  <CompetitorDetails item={item} />

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



              <div className="flex flex-col gap-2 border-t border-border px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">

                <span>

                  Showing {items.length} of{" "}

                  {report.total_count ?? report.items_count ?? items.length}{" "}

                  returned domains

                </span>



                <span>

                  API cost:{" "}

                  {report.api_cost == null

                    ? "—"

                    : `$${Number(report.api_cost).toFixed(4)}`}{" "}

                  · DataForSEO Labs

                </span>

              </div>

            </>

          )}

        </section>



        <p className="text-xs leading-5 text-muted-foreground">

          Competitor domains are identified by shared organic keyword rankings.

          Social platforms, directories and publishers may appear because they

          rank for similar searches. Estimated traffic value is a third-party

          estimate, not your website analytics.

        </p>

      </div>

    </main>

  );

}
