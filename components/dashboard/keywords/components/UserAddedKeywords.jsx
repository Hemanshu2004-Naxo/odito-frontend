import React, { useState, memo, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getUrlLabel(url) {
  try {
    const path = new URL(url).pathname.replace(/\/$/, '');
    if (!path) return 'Homepage';
    return path.split('/').filter(Boolean).pop()
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return url;
  }
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function getRankBadgeStyle(rank) {
  if (rank >= 1 && rank <= 10)  return { background: 'var(--color-status-success-surface)', color: 'var(--gr)', border: '1px solid var(--color-status-success-border)' };
  if (rank >= 11 && rank <= 20) return { background: 'var(--color-status-warning-surface)', color: 'var(--am)', border: '1px solid var(--color-status-warning-border)' };
  return { background: 'var(--color-status-error-surface)', color: 'var(--re)', border: '1px solid var(--color-status-error-border)' };
}

function getStatusFromRank(rank) {
  if (rank >= 1 && rank <= 10)  return { text: 'Page 1',  style: { background: 'var(--color-status-success-surface)', color: 'var(--gr)', border: '1px solid var(--color-status-success-border)' } };
  if (rank >= 11 && rank <= 20) return { text: 'Page 2',  style: { background: 'var(--color-status-warning-surface)', color: 'var(--am)', border: '1px solid var(--color-status-warning-border)' } };
  return { text: 'Page 3+', style: { background: 'var(--color-status-error-surface)', color: 'var(--re)', border: '1px solid var(--color-status-error-border)' } };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Rank badge: #N coloured by position range, or — for null */
function RankBadge({ rank, style: extraStyle = {}, nullTitle }) {
  if (rank == null) return <span title={nullTitle} style={{ fontSize: '12px', color: 'var(--text3)' }}>—</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '36px', height: '24px', borderRadius: '6px',
      fontSize: '12px', fontWeight: 600, padding: '0 8px',
      ...getRankBadgeStyle(rank), ...extraStyle
    }}>
      #{rank}
    </span>
  );
}

/**
 * Delta badge shown in Prev Week / Prev Month columns.
 * Shows current rank alongside the directional change vs compareRank.
 * Lower rank number = better position, so compareRank > currentRank = improvement.
 */
function DeltaBadge({ currentRank, compareRank }) {
  if (compareRank == null) return <span style={{ fontSize: '11px', color: 'var(--text3)' }}>—</span>;
  if (currentRank == null) return <span style={{ fontSize: '11px', color: 'var(--text3)' }}>—</span>;

  const delta    = compareRank - currentRank;   // positive = improved
  const improved = delta > 0;
  const neutral  = delta === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
      <RankBadge rank={compareRank} />
      {neutral ? (
        <span style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600 }}>→</span>
      ) : (
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          color: improved ? 'var(--gr)' : 'var(--re)',
          whiteSpace: 'nowrap'
        }}>
          {improved ? '▲' : '▼'}{Math.abs(delta)}
        </span>
      )}
    </div>
  );
}

/**
 * Position change between a previous and a current rank for ONE device.
 * Lower rank number = better position. Returns null when either side is
 * unknown — a missing/failed value never produces a change.
 */
export function getRankChange(currentRank, previousRank) {
  if (currentRank == null || previousRank == null) return null;
  return previousRank - currentRank; // positive = improved, negative = declined
}

/** Green ▲N / red ▼N / neutral dash. `change === null` (no history) is a dash too. */
function ChangeIndicator({ change }) {
  if (change == null || change === 0) {
    return <span data-testid="rank-change-neutral" aria-label="No position change" style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>–</span>;
  }
  const improved = change > 0;
  return (
    <span
      data-testid={improved ? 'rank-change-up' : 'rank-change-down'}
      aria-label={`${improved ? 'Improved' : 'Declined'} by ${Math.abs(change)} position${Math.abs(change) === 1 ? '' : 's'}`}
      style={{ fontSize: '10px', fontWeight: 700, color: improved ? 'var(--gr)' : 'var(--re)', whiteSpace: 'nowrap' }}
    >
      {improved ? '▲' : '▼'}{Math.abs(change)}
    </span>
  );
}

/**
 * Mobile organic ranking cell. Four data states that must never be confused:
 *   not_collected — mobile was never checked (old keyword / feature off)
 *   scan_error    — the last mobile check failed (rank unknown)
 *   ranked        — found at #N (+ change vs the previous mobile scan)
 *   not_ranked    — checked successfully, not found; "Not in top N" is only
 *                   stated when the scan recorded how deep it actually looked
 * Reads ONLY keyword.mobile — never falls back to desktop values.
 */
export function getMobileState(mobile) {
  if (!mobile) return 'not_collected';
  if (mobile.last_scan_status === 'error') return 'scan_error';
  if (mobile.last_scan_status === 'ok') return mobile.current_rank != null ? 'ranked' : 'not_ranked';
  return 'not_collected';
}

function MobileRankCell({ mobile, isScanning }) {
  if (isScanning) {
    return (
      <span title="Checking your Google mobile ranking…" style={{ fontSize: '12px', color: 'var(--cyan)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ display: 'inline-block', animation: 'kwdash-spin 1s linear infinite' }}>⟳</span>
        Scanning…
      </span>
    );
  }

  const state = getMobileState(mobile);

  if (state === 'not_collected') {
    return (
      <span
        data-testid="mobile-not-collected"
        title="Mobile ranking hasn't been checked yet for this keyword. Rescan to collect it."
        style={{ fontSize: '11px', color: 'var(--text3)', fontStyle: 'italic' }}
      >
        Not checked
      </span>
    );
  }

  if (state === 'scan_error') {
    const message = mobile.last_scan_error || 'The last mobile ranking check failed — this is not a confirmed rank. Try rescanning.';
    if (mobile.current_rank != null) {
      // Keep the last known good rank visible, but flag that it is stale.
      return (
        <div data-testid="mobile-scan-error" title={`Showing the last known mobile rank. ${message}`} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <RankBadge rank={mobile.current_rank} />
          <span style={{ fontSize: '11px', color: 'var(--am)', fontWeight: 700 }}>⚠</span>
        </div>
      );
    }
    return (
      <span
        data-testid="mobile-scan-error"
        title={message}
        style={{
          fontSize: '11px', fontWeight: 500,
          background: 'var(--color-status-warning-surface)', color: 'var(--am)',
          border: '1px solid var(--color-status-warning-border)',
          borderRadius: '6px', padding: '3px 8px', display: 'inline-block'
        }}
      >
        Scan Error
      </span>
    );
  }

  if (state === 'not_ranked') {
    const depth = mobile.tracked_depth;
    return (
      <div data-testid="mobile-not-ranked" title={depth ? `Checked on mobile: not found in the top ${depth} results` : 'Checked on mobile: not found in the results returned'} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text3)' }}>—</span>
        {depth ? <span style={{ fontSize: '10px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>Not in top {depth}</span> : null}
      </div>
    );
  }

  // ranked
  const change = getRankChange(mobile.current_rank, mobile.prev_scan_rank ?? null);
  const history = [
    mobile.prev_scan_rank != null ? `Last scan #${mobile.prev_scan_rank}` : null,
    mobile.prev_week_rank != null ? `Prev week #${mobile.prev_week_rank}` : null,
    mobile.prev_month_rank != null ? `Prev month #${mobile.prev_month_rank}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div data-testid="mobile-ranked" title={history || 'No earlier mobile scan to compare with'} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <RankBadge rank={mobile.current_rank} />
      <ChangeIndicator change={change} />
    </div>
  );
}

/** Google Maps rank badge with a pin icon */
function MapsRankBadge({ mapsRank }) {
  if (mapsRank == null) return <span style={{ fontSize: '12px', color: 'var(--text3)' }}>—</span>;
  return (
    <span
      title="Google Maps Position"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        background: 'var(--color-status-success-surface)',
        color: 'var(--gr)',
        border: '1px solid var(--color-status-success-border)',
        borderRadius: '6px', fontSize: '11px', fontWeight: 700,
        padding: '2px 7px', whiteSpace: 'nowrap'
      }}
    >
      📍#{mapsRank}
    </span>
  );
}

/** Maps listing card shown in the expanded row */
function MapsListingCard({ listing }) {
  if (!listing || !listing.title) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '9px 14px',
      background: 'var(--bg)', border: '0.5px solid var(--color-status-success-border)',
      borderRadius: '8px', marginTop: '4px'
    }}>
      <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>📍</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gr)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.title}
        </div>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          {listing.rating != null && (
            <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
              ⭐ {listing.rating}
            </span>
          )}
          {listing.reviews != null && (
            <span style={{ fontSize: '11px', color: 'var(--text3)' }}>
              {listing.reviews.toLocaleString()} reviews
            </span>
          )}
          {listing.address && (
            <span style={{ fontSize: '11px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {listing.address}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Per-keyword re-scan button with spinner while in-flight */
function RescanButton({ keyword, isRescanning, onRescan }) {
  return (
    <button
      className="tap-target"
      onClick={() => onRescan(keyword)}
      disabled={isRescanning}
      title={isRescanning ? 'Rescanning…' : 'Re-scan this keyword'}
      style={{
        background: isRescanning ? 'var(--bg)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        color: isRescanning ? 'var(--text3)' : 'var(--cyan)',
        cursor: isRescanning ? 'not-allowed' : 'pointer',
        fontSize: '13px',
        padding: '3px 7px',
        lineHeight: 1,
        opacity: isRescanning ? 0.6 : 1,
        transition: 'opacity 0.2s'
      }}
    >
      {isRescanning ? '⟳' : '↻'}
    </button>
  );
}

/** Per-keyword delete button — opens the confirmation dialog, doesn't delete directly */
function DeleteButton({ isDeleting, onRequestDelete }) {
  return (
    <button
      className="tap-target"
      onClick={onRequestDelete}
      disabled={isDeleting}
      title={isDeleting ? 'Removing…' : 'Stop tracking this keyword'}
      style={{
        background: isDeleting ? 'var(--bg)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        color: isDeleting ? 'var(--text3)' : 'var(--re)',
        cursor: isDeleting ? 'not-allowed' : 'pointer',
        fontSize: '13px',
        padding: '3px 7px',
        lineHeight: 1,
        opacity: isDeleting ? 0.6 : 1,
        transition: 'opacity 0.2s'
      }}
    >
      {isDeleting ? '⟳' : '✕'}
    </button>
  );
}

// ─── Grid layout ─────────────────────────────────────────────────────────────
// #(36) | Keyword(1fr) | Desktop(80) | Mobile(96) | Last Scan(80) | Best(76) | Prev Wk(90) | Prev Mo(90) | Benchmark(80) | Maps(76) | Status(80) | Actions(60)
// Column template lives in styles/keywords.css (.kw-grid) so container queries can
// re-flow it into stacked cards on narrow screens.

/**
 * One table row, memoized — an add/delete/rescan on ONE keyword should not
 * re-render every other row. Props are kept to primitives + stable callback
 * references (KeywordDashboard/UserAddedKeywords pass useCallback-wrapped
 * handlers) so the memo comparison is actually effective, not defeated by a
 * fresh function/array identity on every parent render.
 */
const KeywordRow = memo(function KeywordRow({ keyword, index, isLast, isRescanning, isDeleting, onRescan, onRequestDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Support both canonical doc fields (current_rank) and legacy archive
  // docs that never had a current_rank field at all. Fall back to
  // best_rank/rank only when current_rank is genuinely ABSENT (legacy
  // doc) — not when it's explicitly null (keyword fell out of the
  // top 100 on the latest scan). `??` alone can't tell those apart
  // since both are nullish; a present-but-null current_rank must stay
  // null so the UI shows "not ranked" instead of a stale historical rank.
  const currentRank   = 'current_rank' in keyword
    ? keyword.current_rank
    : (keyword.best_rank ?? keyword.rank ?? null);
  const bestRank      = keyword.best_rank      ?? keyword.rank      ?? null;
  const lastScanRank  = keyword.last_scan_rank  ?? keyword.prev_scan_rank ?? null;
  const prevWeekRank  = keyword.prev_week_rank  ?? null;
  const prevMonthRank = keyword.prev_month_rank ?? null;
  const benchmarkRank = keyword.benchmark_rank  ?? null;
  const mapsRank      = keyword.maps_rank       ?? null;
  const mapsListing   = keyword.maps_listing    ?? null;

  // Set by buildKeywordUpdate (rankingHistoryService.js) when the last scan's
  // organic SERP request/parse itself failed (DataForSEO API/task error,
  // timeout, etc.) — distinct from a scan that succeeded and genuinely found
  // no match. A present-but-null currentRank must NOT be labeled "Not ranked"
  // in this case: we don't actually know, the check itself failed.
  // last_scan_error is already sanitized server-side (see
  // sanitizeScanErrorForStorage in rankingHistoryService.js) — never the raw
  // vendor message — so it's safe to show directly here.
  const scanFailed = keyword.last_scan_status === 'error';
  const scanErrorMessage = keyword.last_scan_error || 'The last ranking check failed — this is not a confirmed rank. Try rescanning.';

  // 'pending' only ever exists transiently in the frontend's own optimistic
  // cache (see useAddKeyword in useKeywordQueries.js) right after adding a
  // keyword — the database never stores this value, only 'ok'/'error'. It
  // means the initial DataForSEO scan for this brand-new keyword is still
  // in flight; must render distinctly from both "Not ranked" (a completed
  // scan found nothing) and "Scan Error" (a completed scan failed).
  const isScanning = keyword.last_scan_status === 'pending';

  const status      = currentRank != null ? getStatusFromRank(currentRank) : null;
  const rankingUrls = keyword.ranking_urls || [];
  const mobileUrls  = keyword.mobile?.ranking_urls || [];
  const hasUrls     = rankingUrls.length > 0 || mobileUrls.length > 0;
  const hasMapsListing = !!(mapsListing && mapsListing.title);

  return (
    <div style={{ borderBottom: isLast ? 'none' : '0.5px solid var(--border)' }}>
      {/* Main row */}
      <div className="kw-grid kw-grid--row" style={{
        opacity: (isRescanning || isDeleting) ? 0.6 : 1,
        transition: 'opacity 0.2s'
      }}>
        {/* # */}
        <div className="kw-c-idx" style={{ fontSize: '12px', color: 'var(--text3)' }}>{index + 1}</div>

        {/* Keyword */}
        <div className="kw-c-name">
          <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
            <span className="kw-idx-inline">{index + 1}.</span>
            {keyword.keyword}
          </div>
          {keyword.scan_count != null && (
            <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '1px' }}>
              {keyword.scan_count} scan{keyword.scan_count !== 1 ? 's' : ''}
              {rankingUrls.length > 0 && ` · ${rankingUrls.length} URL${rankingUrls.length !== 1 ? 's' : ''}`}
            </div>
          )}
          {keyword.scan_count == null && rankingUrls.length > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
              {rankingUrls.length} ranking URL{rankingUrls.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Desktop rank (the long-standing top-level rank fields) */}
        <div className="kw-c-m" data-label="Desktop">
          {isScanning ? (
            <span title="Checking your Google ranking…" style={{ fontSize: '12px', color: 'var(--cyan)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', animation: 'kwdash-spin 1s linear infinite' }}>⟳</span>
              Scanning…
            </span>
          ) : (
            <RankBadge
              rank={currentRank}
              nullTitle={scanFailed ? scanErrorMessage : 'Not in Top 100'}
            />
          )}
        </div>

        {/* Mobile rank — independent of desktop; reads keyword.mobile only */}
        <div className="kw-c-m" data-label="Mobile">
          <MobileRankCell mobile={keyword.mobile} isScanning={isScanning} />
        </div>

        {/* Last Scan Rank */}
        <div className="kw-c-m" data-label="Last Scan"><DeltaBadge currentRank={currentRank} compareRank={lastScanRank} /></div>

        {/* Best Rank (all-time) */}
        <div className="kw-c-m" data-label="Best">
          {bestRank != null ? (
            <RankBadge
              rank={bestRank}
              style={bestRank < (currentRank ?? Infinity)
                ? { background: 'var(--color-status-success-surface)', color: 'var(--gr)', border: '1px solid var(--color-status-success-border)' }
                : {}}
            />
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>—</span>
          )}
        </div>

        {/* Prev Week */}
        <div className="kw-c-m" data-label="Prev Week"><DeltaBadge currentRank={currentRank} compareRank={prevWeekRank} /></div>

        {/* Prev Month */}
        <div className="kw-c-m" data-label="Prev Month"><DeltaBadge currentRank={currentRank} compareRank={prevMonthRank} /></div>

        {/* Benchmark */}
        <div className="kw-c-m" data-label="Benchmark">
          {benchmarkRank != null ? (
            <span
              title="Rank when this keyword was first tracked"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '36px', height: '24px', borderRadius: '6px',
                fontSize: '12px', fontWeight: 600, padding: '0 8px',
                background: 'var(--bg)', color: 'var(--text3)',
                border: '1px solid var(--border)'
              }}
            >
              #{benchmarkRank}
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text3)' }} title="Keyword was unranked when first tracked">—</span>
          )}
        </div>

        {/* Maps Rank */}
        <div className="kw-c-m" data-label="Maps"><MapsRankBadge mapsRank={mapsRank} /></div>

        {/* Status */}
        <div className="kw-c-m" data-label="Status">
          {isScanning ? (
            <span
              title="Checking your Google ranking…"
              style={{
                fontSize: '11px', fontWeight: 500,
                background: 'var(--color-brand-cyan-surface, rgba(0,223,255,0.08))', color: 'var(--cyan)',
                border: '1px solid var(--color-brand-cyan-border, rgba(0,223,255,0.18))',
                borderRadius: '6px', padding: '3px 8px', display: 'inline-block'
              }}
            >
              Scanning…
            </span>
          ) : status ? (
            <span style={{
              fontSize: '11px', fontWeight: 500, ...status.style,
              borderRadius: '6px', padding: '3px 8px', display: 'inline-block'
            }}>
              {status.text}
            </span>
          ) : scanFailed ? (
            <span
              title={scanErrorMessage}
              style={{
                fontSize: '11px', fontWeight: 500,
                background: 'var(--color-status-warning-surface)', color: 'var(--am)',
                border: '1px solid var(--color-status-warning-border)',
                borderRadius: '6px', padding: '3px 8px', display: 'inline-block'
              }}
            >
              Scan Error
            </span>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Not ranked</span>
          )}
        </div>

        {/* Actions: rescan + delete + expand */}
        <div className="kw-c-actions">
          <div className="kw-actions-row">
            {/* While isScanning, this row is still the optimistic placeholder
                from useAddKeyword — the real record may not exist server-side
                yet, so rescan/delete are disabled rather than risking a
                "not tracked" error on a request that's already in flight. */}
            {onRescan && (
              <RescanButton
                keyword={keyword.keyword}
                isRescanning={isRescanning || isScanning}
                onRescan={onRescan}
              />
            )}
            {onRequestDelete && (
              <DeleteButton
                isDeleting={isDeleting || isScanning}
                onRequestDelete={() => onRequestDelete(keyword.keyword)}
              />
            )}
          </div>
          {(hasUrls || hasMapsListing) && (
            <button
              className="tap-target"
              onClick={() => setIsExpanded(e => !e)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '4px', color: 'var(--text3)',
                cursor: 'pointer', fontSize: '11px', padding: '3px 7px', lineHeight: 1
              }}
            >
              {isExpanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {/* Expanded section: ranking URLs + Maps listing */}
      {isExpanded && (hasUrls || hasMapsListing) && (
        <div className="kw-expand">
          {hasMapsListing && <MapsListingCard listing={mapsListing} />}
          {[...rankingUrls.map(ru => ({ ru, device: 'desktop' })), ...mobileUrls.map(ru => ({ ru, device: 'mobile' }))].map(({ ru, device }, ri) => (
            <div key={`${device}-${ri}`} data-device={device} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '7px 12px',
              background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: '8px'
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '30px', height: '22px', padding: '0 6px', borderRadius: '5px',
                fontSize: '11px', fontWeight: 700, flexShrink: 0,
                ...getRankBadgeStyle(ru.rank)
              }}>
                #{ru.rank}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 700,
                color: ru.type === 'homepage' ? 'var(--cyan)' : 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                flexShrink: 0, width: '80px'
              }}>
                {ru.type === 'homepage' ? 'Homepage' : 'Page'}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                {device === 'mobile' ? 'Mobile' : 'Desktop'}
              </span>
              <a
                href={ru.url}
                target="_blank"
                rel="noopener noreferrer"
                className="kw-ru-link"
                style={{
                  fontSize: '12px', color: 'var(--text2)',
                  textDecoration: 'none', flex: 1, minWidth: 0
                }}
                title={ru.url}
              >
                {getUrlLabel(ru.url)}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

function UserAddedKeywords({ data, loading, error, onRefresh, onRescan, onDelete, rescanningKeywords = new Set(), deletingKeyword = null }) {
  const [pendingDeleteKeyword, setPendingDeleteKeyword] = useState(null);

  // Stable references so KeywordRow's memo comparison actually holds across
  // parent re-renders (an inline arrow function passed as a prop would
  // defeat memoization every time, since it's a new identity each render).
  const handleRequestDelete = useCallback((keyword) => {
    setPendingDeleteKeyword(keyword);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (pendingDeleteKeyword && onDelete) {
      onDelete(pendingDeleteKeyword);
    }
    setPendingDeleteKeyword(null);
  }, [pendingDeleteKeyword, onDelete]);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
        Loading tracked keywords...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--red)', fontSize: '13px' }}>
        <div style={{ marginBottom: '10px' }}>⚠️ Error loading keywords</div>
        <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '20px' }}>{error}</div>
        <button
          onClick={onRefresh}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px',
            padding: '6px 12px', color: 'var(--text)', fontSize: '12px', cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data || !data.keywords || !Array.isArray(data.keywords) || data.keywords.length === 0) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
        No tracked keywords yet
      </div>
    );
  }

  const { domain, location, keywords, created_at, last_scanned_at, scan_count } = data;

  return (
    <div>
      {/* Domain info card */}
      <div style={{
        background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: '10px',
        padding: '14px 16px', marginBottom: '16px',
        display: 'flex', flexWrap: 'wrap', rowGap: '12px', columnGap: '24px', alignItems: 'flex-start'
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Domain</div>
          <div style={{ color: 'var(--cyan)', fontSize: '13px', overflowWrap: 'anywhere' }}>{domain}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Location</div>
          <div style={{ color: 'var(--text2)', fontSize: '12px', maxWidth: '380px', lineHeight: '1.5' }}>{location}</div>
        </div>
        <div className="kw-info-meta">
          {scan_count != null && (
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Scans</div>
              <div style={{ color: 'var(--text2)', fontSize: '12px' }}>{scan_count}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Last Scan</div>
            <div style={{ color: 'var(--text2)', fontSize: '12px' }}>{formatDate(last_scanned_at || created_at)}</div>
          </div>
        </div>
      </div>

      {/* Keywords table */}
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        {/* Section header */}
        <div style={{
          padding: '14px 16px 10px', borderBottom: '0.5px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Tracked Keywords
          </div>
          <div style={{ background: 'var(--bg)', color: 'var(--cyan)', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px' }}>
            {keywords.length} keywords
          </div>
        </div>

        {/* Table header + rows scroll together (safety net) inside the card;
            below ~980px of content width the rows re-flow into stacked cards
            instead (see styles/keywords.css), so nothing is ever clipped. */}
        <div className="kw-table-scroll">
        <div className="kw-table">
        <div className="kw-grid kw-grid--head" style={{
          borderBottom: '0.5px solid var(--border)',
          fontSize: '10px', color: 'var(--text3)', fontWeight: 600,
          letterSpacing: '0.05em', textTransform: 'uppercase'
        }}>
          <div>#</div>
          <div>Keyword</div>
          <div>Desktop</div>
          <div>Mobile</div>
          <div>Last Scan</div>
          <div>Best</div>
          <div>Prev Week</div>
          <div>Prev Month</div>
          <div>Benchmark</div>
          <div>Maps</div>
          <div>Status</div>
          <div></div>
        </div>

        {/* Table rows — each memoized, keyed by keyword so add/delete only
            mounts/unmounts the changed row instead of re-rendering all */}
        {keywords.map((keyword, index) => (
          <KeywordRow
            key={keyword._id || keyword.keyword}
            keyword={keyword}
            index={index}
            isLast={index === keywords.length - 1}
            isRescanning={rescanningKeywords.has(keyword.keyword)}
            isDeleting={deletingKeyword === keyword.keyword}
            onRescan={onRescan}
            onRequestDelete={onDelete ? handleRequestDelete : undefined}
          />
        ))}
        </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px', fontSize: '11px', color: 'var(--text3)',
          textAlign: 'center', borderTop: '0.5px solid var(--border)'
        }}>
          Manual tracking · Last updated {formatDate(last_scanned_at || created_at)}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDeleteKeyword} onOpenChange={(open) => { if (!open) setPendingDeleteKeyword(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop tracking this keyword?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteKeyword && (
                <>You're about to remove <strong>"{pendingDeleteKeyword}"</strong> from active tracking. Its ranking history will be kept — if you track it again later, its past history will still be there.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Remove Keyword
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default UserAddedKeywords;
