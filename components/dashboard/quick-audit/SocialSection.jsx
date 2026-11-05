import React from "react";
import s from "../QuickAuditResult.module.css";

const PLATFORMS = [
  { key: "facebook", label: "Facebook Page Linked", icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#1877F2" /><path d="M16.67 15.47l.53-3.47h-3.33V9.87c0-.95.46-1.87 1.95-1.87h1.51V5.15s-1.37-.23-2.68-.23c-2.74 0-4.53 1.66-4.53 4.66V12H7v3.47h3.12V24h3.85V15.47h2.7z" fill="white" /></svg> },
  { key: "twitter", label: "X (formerly Twitter) Account Linked", icon: null },
  { key: "instagram", label: "Instagram Linked", icon: <svg viewBox="0 0 24 24"><defs><linearGradient id="ig" x1="0" y1="24" x2="24" y2="0"><stop offset="0%" stopColor="#feda75" /><stop offset="25%" stopColor="#fa7e1e" /><stop offset="50%" stopColor="#d62976" /><stop offset="75%" stopColor="#962fbf" /><stop offset="100%" stopColor="#4f5bd5" /></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig)" /><rect x="4" y="4" width="16" height="16" rx="4.5" fill="none" stroke="white" strokeWidth="1.5" /><circle cx="12" cy="12" r="3.5" fill="none" stroke="white" strokeWidth="1.5" /><circle cx="17" cy="7" r="1.2" fill="white" /></svg> },
  { key: "linkedin", label: "LinkedIn Page Linked", icon: <svg viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0A66C2" /><path d="M7.5 9.5h2v7h-2zm1-3.2a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zm3.5 3.2h1.9v.95h.03c.27-.5.92-1.05 1.9-1.05 2.03 0 2.4 1.34 2.4 3.07v3.53h-2v-3.13c0-.75-.01-1.7-1.04-1.7s-1.2.81-1.2 1.65v3.18h-2v-7z" fill="white" /></svg> },
  { key: "youtube", label: "YouTube Channel Linked", icon: null },
];

export default function SocialSection({ data }) {
  if (!data) return null;

  const pi = data.page_info || {};
  const social = pi.social_signals || {};

  // If no social_signals at all, show fallback
  if (!pi.social_signals) {
    return (
      <div className={s.section}>
        <div className={s.sectionTitle}>Social Results</div>
        <div className={s.socialRow}>
          <div className={s.socialContent}>
            <div className={s.socialName}>No data available</div>
          </div>
        </div>
      </div>
    );
  }

  // Social Coverage Score
  const foundCount = PLATFORMS.filter(p => social[p.key]?.found === true).length;
  const coverageScore = Math.round((foundCount / PLATFORMS.length) * 100);
  const coverageStatus = coverageScore >= 80 ? "pass" : coverageScore >= 50 ? "warning" : "fail";

  // Open Graph
  const hasOG = social.open_graph === true;
  // Twitter Cards
  const hasTwitterCards = social.twitter_cards === true;
  // Facebook Pixel
  const hasFbPixel = social.facebook_pixel === true;

  return (
    <section className="space-y-12 pt-8">
      {/* HEADER */}
      <div className="flex items-center border-b border-slate-200 dark:border-[#263244] pb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
            <span className="text-blue-700 dark:text-blue-400 text-xl">📤</span>
          </div>
          Social Results
        </h2>
      </div>

      {/* MAIN CARD */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263244] rounded-2xl p-8">
        <div className="space-y-6">
          {/* FACEBOOK */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-[#263244] hover:border-green-400/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">Facebook</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {social.facebook?.found ? "Facebook page found and linked" : "No associated Facebook page found linked on your page"}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase ${
              social.facebook?.found 
                ? "bg-green-400/10 text-green-700 dark:text-green-400" 
                : "bg-red-400/10 text-red-600 dark:text-red-400"
            }`}>
              {social.facebook?.found ? "Connected" : "Not Found"}
            </span>
          </div>

          {/* TWITTER */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-[#263244] hover:border-green-400/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1DA1F2]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">X (Twitter)</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {social.twitter?.found ? "X profile found and linked" : "No associated X profile found linked on your page"}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase ${
              social.twitter?.found 
                ? "bg-green-400/10 text-green-700 dark:text-green-400" 
                : "bg-red-400/10 text-red-600 dark:text-red-400"
            }`}>
              {social.twitter?.found ? "Connected" : "Not Found"}
            </span>
          </div>

          {/* INSTAGRAM */}
          <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
            social.instagram?.found 
              ? "border-slate-200 dark:border-[#263244] hover:border-green-400/30" 
              : "border-red-400/30 bg-red-400/5 hover:border-red-400/50"
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                social.instagram?.found 
                  ? "bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-400/20" 
                  : "bg-red-400/10"
              }`}>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill={social.instagram?.found ? "url(#instagram-gradient)" : "#EF4444"} stroke={social.instagram?.found ? "url(#instagram-gradient)" : "#EF4444"} strokeWidth="2"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill={social.instagram?.found ? "white" : "#FCA5A5"}/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke={social.instagram?.found ? "white" : "#FCA5A5"} strokeWidth="2" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#833AB4"/>
                      <stop offset="50%" stopColor="#FD1D1D"/>
                      <stop offset="100%" stopColor="#FCB045"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div>
                <h4 className={`font-bold ${social.instagram?.found ? "text-slate-900 dark:text-white" : "text-red-600 dark:text-red-400"}`}>Instagram</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {social.instagram?.found ? "Instagram profile found and linked" : "No associated Instagram profile found linked on your page"}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase ${
              social.instagram?.found 
                ? "bg-green-400/10 text-green-700 dark:text-green-400" 
                : "bg-red-400/20 text-red-600 dark:text-red-400 border border-red-400/30"
            }`}>
              {social.instagram?.found ? "Connected" : "Not Found"}
            </span>
          </div>

          {/* LINKEDIN */}
          <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
            social.linkedin?.found 
              ? "border-slate-200 dark:border-[#263244] hover:border-green-400/30" 
              : "border-red-400/30 bg-red-400/5 hover:border-red-400/50"
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                social.linkedin?.found 
                  ? "bg-[#0077B5]/10" 
                  : "bg-red-400/10"
              }`}>
                <svg className={`w-5 h-5 ${social.linkedin?.found ? "text-[#0077B5]" : "text-red-600 dark:text-red-400"}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </div>
              <div>
                <h4 className={`font-bold ${social.linkedin?.found ? "text-slate-900 dark:text-white" : "text-red-600 dark:text-red-400"}`}>LinkedIn</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {social.linkedin?.found ? "LinkedIn page found and linked" : "No associated LinkedIn page found linked on your page"}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase ${
              social.linkedin?.found 
                ? "bg-green-400/10 text-green-700 dark:text-green-400" 
                : "bg-red-400/20 text-red-600 dark:text-red-400 border border-red-400/30"
            }`}>
              {social.linkedin?.found ? "Connected" : "Not Found"}
            </span>
          </div>

          {/* YOUTUBE */}
          <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
            social.youtube?.found 
              ? "border-slate-200 dark:border-[#263244] hover:border-green-400/30" 
              : "border-red-400/30 bg-red-400/5 hover:border-red-400/50"
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                social.youtube?.found 
                  ? "bg-[#FF0000]/10" 
                  : "bg-red-400/10"
              }`}>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill={social.youtube?.found ? "#FF0000" : "#EF4444"}/>
                  <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white"/>
                </svg>
              </div>
              <div>
                <h4 className={`font-bold ${social.youtube?.found ? "text-slate-900 dark:text-white" : "text-red-600 dark:text-red-400"}`}>YouTube</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {social.youtube?.found ? "YouTube channel found and linked" : "No associated YouTube channel found linked on your page"}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase ${
              social.youtube?.found 
                ? "bg-green-400/10 text-green-700 dark:text-green-400" 
                : "bg-red-400/20 text-red-600 dark:text-red-400 border border-red-400/30"
            }`}>
              {social.youtube?.found ? "Connected" : "Not Found"}
            </span>
          </div>
        </div>

        {/* RECOMMENDATION */}
        <div className="mt-8 p-6 bg-orange-400/5 rounded-xl border border-orange-400/20">
          <div className="flex items-start gap-3">
            <span className="text-orange-700 dark:text-orange-400">⚠️</span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-orange-700 dark:text-orange-400 mb-2">
                RECOMMENDATION
              </p>
              <p className="font-semibold text-orange-200">
                Add missing social media links to improve social media presence and SEO ranking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
