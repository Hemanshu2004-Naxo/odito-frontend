import React from "react";
import { useExportHomepageAuditPDF } from "../../../hooks/useExportHomepageAuditPDF";

// Visual language matches the Performance category card (HeroSection):
// dark dashboard background, orange (#f59e0b family) accent border/icon,
// white text, same rounded-2xl radius as the dashboard's other cards.
export default function ExportPdfButton({ auditId }) {
  const { exportPDF, loading, error, progress } = useExportHomepageAuditPDF();

  const handleClick = async () => {
    if (!auditId) return;
    try {
      await exportPDF(auditId);
    } catch {
      // error state is already surfaced via `error`; nothing else to do here
    }
  };

  return (
    <div className="flex flex-col items-start sm:items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !auditId}
        className="px-5 py-2.5 rounded-2xl bg-white dark:bg-[#111827] border border-orange-400/60 dark:border-orange-400/40 text-slate-900 dark:text-white font-semibold text-sm flex items-center gap-2 hover:border-orange-400/70 hover:bg-orange-400/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin"></span>
            Generating PDF... {progress}%
          </>
        ) : (
          <>
            <span className="text-orange-400">📄</span>
            Export PDF
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">PDF export failed: {error}</p>}
    </div>
  );
}
