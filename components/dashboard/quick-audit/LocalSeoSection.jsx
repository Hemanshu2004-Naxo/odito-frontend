"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Phone, Globe, Star, Building2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import LocalPresenceModal from "./LocalPresenceModal.jsx";
import apiService from "@/lib/apiService.js";

export default function LocalSeoSection({ data, businessContext, auditId }) {
  const [showModal, setShowModal]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [profile, setProfile]             = useState(null);
  const [notFound, setNotFound]           = useState(false);
  const autoFetchedRef                    = useRef(false);

  if (!data) return null;

  const pi = data.page_info || {};

  // Auto-fetch when businessContext arrives from the onboarding search step
  useEffect(() => {
    if (
      businessContext?.businessName &&
      businessContext?.location &&
      !autoFetchedRef.current &&
      !profile
    ) {
      autoFetchedRef.current = true;
      fetchPresence(businessContext.businessName, businessContext.location);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessContext]);

  const fetchPresence = async (businessName, location) => {
    setLoading(true);
    setError("");
    setNotFound(false);

    try {
      const res = await apiService.searchLocalPresence(businessName, location, {
        website: pi.url || data.url || ""
      });

      if (res.success && res.data) {
        setProfile(res.data);
        setShowModal(false);
        persistGBP({ found: true, data: res.data });
      } else {
        setNotFound(true);
        persistGBP({ found: false });
      }
    } catch {
      setError("Failed to fetch business profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Write the GBP result back into the audit snapshot so it's available for
  // video generation, reports, exports, and recommendations without re-calling
  // the Google Places API.
  const persistGBP = (result) => {
    if (!auditId) return;

    const payload = result.found
      ? {
          found: true,
          business_name: result.data.name || "",
          category:      result.data.category || "",
          rating:        result.data.rating ?? null,
          review_count:  result.data.total_reviews ?? 0,
          address:       result.data.address || "",
          phone:         (result.data.phone !== "Not available" ? result.data.phone : "") || "",
          website:       result.data.website || "",
          maps_url:      result.data.google_maps_url || "",
          place_id:      result.data.place_id || "",
          status:        "verified",
        }
      : { found: false, status: "not_found" };

    apiService
      .updateHomepageAuditSnapshot(auditId, "local_seo", {
        google_business_presence: payload,
      })
      .catch((err) =>
        console.error("[SNAPSHOT] GBP persistence failed:", err.message)
      );
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const str = (val) => {
    if (!val || val === "Not available") return null;
    if (typeof val === "string")  return val;
    if (typeof val === "number")  return String(val);
    if (val?.text)                return val.text;
    return null;
  };

  const hostname = (url) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="space-y-12 pt-8">

      {/* Section header */}
      <div className="flex items-center border-b border-slate-200 dark:border-[#263244] pb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-blue-700 dark:text-blue-400" />
          </div>
          Google Business Presence
        </h2>
      </div>

      {/* Card area */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-2xl p-8">

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <Loader2 className="w-8 h-8 text-cyan-700 dark:text-cyan-400 animate-spin" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Looking up{" "}
              <span className="text-slate-900 dark:text-white font-medium">
                {businessContext?.businessName}
              </span>
              {businessContext?.location ? ` in ${businessContext.location}` : ""}
              …
            </p>
          </div>
        )}

        {/* ── Business found ── */}
        {!loading && profile && (
          <div className="space-y-6">

            {/* Status badge */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                Listed on Google Business Profile
              </span>
            </div>

            {/* Name + rating */}
            <div className="pb-5 border-b border-slate-200 dark:border-[#263244]">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                {str(profile.name) || "—"}
              </h3>
              {profile.rating != null && (
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-700 dark:text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold text-slate-900 dark:text-white">{profile.rating}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    ({profile.total_reviews ?? 0}{" "}
                    {profile.total_reviews === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

              {str(profile.category) && (
                <Field icon={<Building2 className="w-4 h-4" />} label="Category">
                  {str(profile.category)}
                </Field>
              )}

              {str(profile.address) && (
                <Field icon={<MapPin className="w-4 h-4" />} label="Address">
                  {str(profile.address)}
                </Field>
              )}

              {str(profile.phone) && (
                <Field icon={<Phone className="w-4 h-4" />} label="Phone">
                  {str(profile.phone)}
                </Field>
              )}

              {str(profile.website) && (
                <Field icon={<Globe className="w-4 h-4" />} label="Website">
                  <a
                    href={str(profile.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    {hostname(str(profile.website))}
                  </a>
                </Field>
              )}

              <Field icon={<CheckCircle2 className="w-4 h-4 text-green-700 dark:text-green-400" />} label="GBP Status">
                <span className="text-green-700 dark:text-green-400 font-medium">Verified &amp; Active</span>
              </Field>

            </div>

            {/* Maps link */}
            {str(profile.google_maps_url) && (
              <div className="pt-2">
                <a
                  href={str(profile.google_maps_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-[#1a2332] border border-slate-200 dark:border-[#263244] text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-blue-400/40 rounded-xl transition-colors"
                >
                  <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
                  View on Google Maps
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Not found ── */}
        {!loading && notFound && (
          <div className="flex flex-col items-center text-center py-10 gap-4">
            <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-[#263244] flex items-center justify-center">
              <XCircle className="w-7 h-7 text-slate-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                Google Business Profile Not Found
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
                This business does not appear to have a verified Google Business Profile.
              </p>
            </div>
            <button
              onClick={() => { setNotFound(false); setShowModal(true); }}
              className="mt-2 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 border border-blue-400/30 rounded-xl hover:bg-blue-400/10 transition-colors"
            >
              Search Again
            </button>
          </div>
        )}

        {/* ── API error ── */}
        {!loading && error && (
          <div className="flex flex-col items-center text-center py-10 gap-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => { setError(""); setShowModal(true); }}
              className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 border border-blue-400/30 rounded-xl hover:bg-blue-400/10 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Manual CTA — shown when no businessContext was collected ── */}
        {!loading && !profile && !notFound && !error && (
          <div className="flex flex-col items-center text-center py-10 gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
              <MapPin className="w-7 h-7 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                Check Your Google Business Profile
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
                Enter your business name and location to see if you have a verified Google Business Profile.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Search Business Profile
            </button>
          </div>
        )}

      </div>

      {showModal && (
        <LocalPresenceModal
          onSubmit={fetchPresence}
          onClose={() => setShowModal(false)}
          loading={loading}
        />
      )}
    </section>
  );
}

// ── Field sub-component ───────────────────────────────────────────────────

function Field({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1a2332] border border-slate-200 dark:border-[#263244] flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-slate-400 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em] mb-0.5">
          {label}
        </p>
        <div className="text-sm text-slate-900 dark:text-white leading-snug break-words">
          {children}
        </div>
      </div>
    </div>
  );
}
