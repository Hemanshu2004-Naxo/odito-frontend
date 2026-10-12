"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Building2, MapPin, ArrowRight, ChevronDown } from "lucide-react";
import apiService from "@/lib/apiService";

/**
 * BusinessSearchStep
 *
 * Inline search-first business discovery. No modal, no overlay, no dialog.
 * Rendered directly in the page flow below the URL input.
 *
 * Flow:
 *  1. User types business name → debounced live search → results appear
 *  2a. Click a result → onConfirm({ source: "search" }) → audit starts
 *  2b. "Add Manually" expands inline → fill name + location → Continue Audit
 *       → onConfirm({ source: "manual" }) → audit starts
 *
 * Props:
 *   url        – the validated URL being audited
 *   onConfirm  – (auditBusinessContext) => void
 *   onSkip     – () => void  (start audit with no business context)
 */
export const SEARCH_DEBOUNCE_MS = 350;

// A failed search is NOT "no results": say what happened, keep manual/skip open.
function describeSearchError(err) {
  if (!err?.status) {
    return "We couldn't reach the server to search for your business. Check your connection and try again.";
  }
  switch (err.code) {
    case "PLACES_RATE_LIMITED":
    case "RATE_LIMIT_EXCEEDED":
      return "Too many searches in a short time. Please wait a moment and try again.";
    case "PLACES_TIMEOUT":
      return "The business search timed out. Please try again.";
    case "PLACES_NOT_CONFIGURED":
    case "PLACES_KEY_INVALID":
    case "PLACES_ACCESS_DENIED":
    case "PLACES_BILLING_REQUIRED":
      return "Business search is unavailable right now. You can add your business manually or skip this step.";
    default:
      return err.message || "Business search failed. Please try again.";
  }
}

export default function BusinessSearchStep({ url, onConfirm, onSkip }) {
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName]         = useState("");
  const [manualLocation, setManualLocation] = useState("");

  const timerRef = useRef(null);
  // Generation counter — discard responses from superseded requests
  const genRef = useRef(0);
  // Cancels the in-flight request when a newer search (or unmount) supersedes it
  const abortRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
  }, []);

  // ── Search ──────────────────────────────────────────────────────────────

  const execSearch = useCallback(async (q, gen) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await apiService.searchBusinessCandidates(q, "", { signal: controller.signal });
      if (genRef.current !== gen) return;                   // stale — discard
      if (!res?.success || !Array.isArray(res.data)) {
        throw Object.assign(new Error("Unexpected response"), { status: 502 });
      }
      setSearchError(null);
      setResults(res.data);
    } catch (err) {
      if (genRef.current !== gen || err?.name === "AbortError") return;
      setResults([]);
      setSearchError({ message: describeSearchError(err), code: err?.code || null });
    } finally {
      if (genRef.current === gen) {
        setIsSearching(false);
        setHasSearched(true);
      }
    }
  }, []);

  const startSearch = (q) => {
    setIsSearching(true);
    setHasSearched(false);
    setSearchError(null);
    const gen = ++genRef.current;
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => execSearch(q, gen), SEARCH_DEBOUNCE_MS);
  };

  const handleQueryChange = (val) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!val.trim() || val.trim().length < 2) {
      genRef.current++;              // invalidate any in-flight request
      abortRef.current?.abort();
      setResults([]);
      setSearchError(null);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    startSearch(val.trim());
  };

  const handleRetry = () => {
    if (query.trim().length >= 2) startSearch(query.trim());
  };

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleSelectResult = (biz) => {
    const address = biz.formattedAddress || biz.address || "";
    onConfirm({
      url,
      businessName: biz.name,
      location: address,
      source: "search",
      // Places-sourced details, kept only for results the user explicitly picked.
      placeId: biz.placeId || null,
      formattedAddress: address,
      coordinates: biz.location || null,
    });
  };

  const handleManualContinue = () => {
    if (!manualName.trim()) return;
    onConfirm({
      url,
      businessName: manualName.trim(),
      location: manualLocation.trim(),
      source: "manual",
    });
  };

  const handleAddManually = () => {
    if (!showManual && query.trim()) {
      setManualName(query.trim()); // pre-fill with what they typed
    }
    setShowManual(true);
  };

  // ── Derived visibility flags ────────────────────────────────────────────

  const showResults    = !isSearching && !searchError && results.length > 0;
  const showError      = !isSearching && !!searchError;
  // "No results" is only for a search that SUCCEEDED with zero matches.
  const showEmpty      = !isSearching && hasSearched && !searchError && results.length === 0;
  const showManualHint = query.trim().length >= 2 || showManual;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto">

      {/* Step connector line */}
      <div className="flex flex-col items-center mb-3" aria-hidden="true">
        <div className="w-px h-5 bg-gradient-to-b from-cyan-500/40 to-cyan-500/10" />
        <span className="text-[10px] font-bold text-cyan-400/60 uppercase tracking-[0.18em] px-3 py-0.5">
          Step 2 — Find Your Business
        </span>
        <div className="w-px h-3 bg-gradient-to-b from-cyan-500/10 to-transparent" />
      </div>

      {/* Card ─────────────────────────────────────────────────────────── */}
      <div className="bg-white/[0.04] backdrop-blur-md border border-cyan-500/20 rounded-2xl overflow-visible soft-bloom">

        {/* Search field */}
        <div className="p-5 pb-3">
          <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-[0.15em]">
            Business Name
          </label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search your business name..."
              autoFocus
              className="w-full pl-10 pr-10 py-3 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-cyan-400/50 focus:bg-white/[0.07] transition-all placeholder-slate-600"
            />
            {isSearching && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2" role="status" aria-label="Searching">
                <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* ── Results list ─────────────────────────────────────────────── */}
        {showResults && (
          <div className="mx-5 mb-3 border border-white/[0.07] rounded-xl overflow-hidden divide-y divide-white/[0.05]">
            {results.map((biz, i) => (
              <button
                key={biz.placeId || i}
                type="button"
                onClick={() => handleSelectResult(biz)}
                className="w-full px-4 py-3.5 text-left hover:bg-white/[0.06] active:bg-white/10 transition-colors flex items-start gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-cyan-500/20 transition-colors">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white group-hover:text-cyan-100 transition-colors truncate">
                    {biz.name}
                  </p>
                  {(biz.formattedAddress || biz.address) && (
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {biz.formattedAddress || biz.address}
                    </p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0 mt-1.5" />
              </button>
            ))}
          </div>
        )}

        {/* ── Error state (search failed — distinct from "no results") ──── */}
        {showError && (
          <div
            role="alert"
            className="mx-5 mb-3 px-4 py-4 rounded-xl bg-red-500/5 border border-red-500/20 text-center"
          >
            <p className="text-sm text-red-300">{searchError.message}</p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Try again
              </button>
              <span className="text-xs text-slate-500">
                or add your business manually below.
              </span>
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {showEmpty && !showManual && (
          <div className="mx-5 mb-3 px-4 py-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
            <p className="text-sm text-slate-400">
              No results for{" "}
              <span className="text-white font-semibold">&quot;{query}&quot;</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Try a shorter name or add your business manually below.
            </p>
          </div>
        )}

        {/* ── Manual fallback prompt ────────────────────────────────────── */}
        {showManualHint && (
          <div className="px-5 pb-5">

            {/* Toggle row */}
            {!showManual && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">
                  Can&apos;t find your business?
                </span>
                <button
                  type="button"
                  onClick={handleAddManually}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  Add Manually
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ── Expandable manual entry (grid-rows animation) ─────────── */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: showManual ? "1fr" : "0fr",
                opacity: showManual ? 1 : 0,
                transition:
                  "grid-template-rows 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <div className="pt-4 border-t border-white/[0.07] mt-2">

                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4">
                    Manual Entry
                  </p>

                  {/* Business Name */}
                  <div className="mb-3">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Business Name
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                      <input
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="e.g. ABC Roofing"
                        className="w-full pl-9 pr-4 py-2.5 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-cyan-400/50 transition-colors placeholder-slate-600"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="mb-5">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                      <input
                        type="text"
                        value={manualLocation}
                        onChange={(e) => setManualLocation(e.target.value)}
                        placeholder="e.g. Nashik, Maharashtra"
                        className="w-full pl-9 pr-4 py-2.5 text-sm text-white bg-white/5 border border-white/10 rounded-xl outline-none focus:border-cyan-400/50 transition-colors placeholder-slate-600"
                      />
                    </div>
                  </div>

                  {/* Continue button */}
                  <button
                    type="button"
                    onClick={handleManualContinue}
                    disabled={!manualName.trim()}
                    className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    Continue Audit
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom padding when nothing is visible below the input yet */}
        {!showManualHint && !showResults && !showEmpty && !showError && (
          <div className="pb-4" />
        )}
      </div>

      {/* Skip link */}
      <button
        type="button"
        onClick={onSkip}
        className="mt-4 w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-2 text-center"
      >
        Skip business setup — the audit will still run in full
      </button>
    </div>
  );
}
