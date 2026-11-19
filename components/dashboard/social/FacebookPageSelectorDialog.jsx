"use client"

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, AlertCircle, CheckCircle2, Facebook, Instagram } from 'lucide-react'
import {
  useMetaPages, useSelectMetaPage, useRetryMetaInstagramDiscovery,
  useFacebookAccounts, useSwitchFacebookAccount,
} from '@/hooks/useDashboardQueries'
import { normalizeImageUrl } from '@/lib/security/sanitize'

// Instagram discovery failure reasons that mean "something went wrong, try
// again" — NOT_CONNECTED is deliberately excluded: a Page genuinely having
// no linked Instagram account is a normal outcome, not a retryable error.
const RETRYABLE_INSTAGRAM_REASONS = new Set(['ACCESS_DENIED', 'DISCOVERY_FAILED', 'PROFILE_FETCH_FAILED', 'INVALID_PAGE_CONNECTION'])

/**
 * ONE Facebook Page picker, in two modes, replacing what used to be two
 * separately-designed dialogs (MetaPageSelectionDialog + SwitchAccountDialog)
 * that happened to solve two genuinely different problems with two
 * different-looking UIs:
 *
 *   mode="connect" — shown right after a fresh Meta OAuth round-trip.
 *     Data: useMetaPages() -> GET /social/meta/pages, which lists Meta's
 *     live /me/accounts response for the OAuth grant that just completed,
 *     now enriched server-side (see metaOAuthController.js's getMetaPages)
 *     with whether each Page already has a SocialAccount for this project.
 *     Selecting a Page calls POST /social/meta/pages/:pageId/select, which
 *     can create NEW SocialAccount rows (persistDiscoveredFacebookPages
 *     persists every discovered Page, not just the one clicked).
 *
 *   mode="switch" — shown from the explicit "Switch Account" button.
 *     Data: useFacebookAccounts() -> GET /social/facebook/accounts, the
 *     project's already-persisted SocialAccount rows. No OAuth, no new
 *     documents — selecting a Page only flips which one is isActive.
 *
 * The two data sources, mutations, and backend contracts are kept
 * completely separate (this component never mixes them) — only the visual
 * shell (the card grid, avatar/badge treatment, footer layout, loading/
 * error states) is shared, based on the original SwitchAccountDialog design.
 */
// `contentClassName` (optional) lets a host with its own always-light surface
// (the Social Media AI module) scope local theme-variable overrides onto the
// dialog, so it matches its page instead of following the dashboard theme.
// Omitted everywhere else — the dialog is unchanged for existing callers.
// `onChoosePages` (optional, connect mode): restarts Meta's consent with re-prompt so the person can share more Pages with Odito.
export default function FacebookPageSelectorDialog({ open, onOpenChange, projectId, mode, onConnected, onSwitched, onConnectAnother, onChoosePages, contentClassName = '' }) {
  const isConnectMode = mode === 'connect'

  const [selectedId, setSelectedId] = useState(null)
  // connect-mode only: the post-selection Facebook+Instagram result screen
  // (Instagram auto-discovery runs server-side as part of the same select
  // call — see selectMetaPage's own docblock) and the retry affordance for it.
  const [connectionResult, setConnectionResult] = useState(null)

  const pagesQuery = useMetaPages(projectId, { enabled: isConnectMode && open && !connectionResult })
  const accountsQuery = useFacebookAccounts(projectId, { enabled: !isConnectMode && open })

  const selectMutation = useSelectMetaPage(projectId)
  const switchMutation = useSwitchFacebookAccount(projectId)
  const retryInstagramMutation = useRetryMetaInstagramDiscovery(projectId)

  // Normalized into one shared shape regardless of mode, so the card grid
  // below never needs to know which endpoint the data came from.
  const pages = isConnectMode
    ? (pagesQuery.data?.data?.pages || []).map((p) => ({
        id: p.id, name: p.name, category: p.category, picture: normalizeImageUrl(p.picture),
        alreadyConnected: !!p.alreadyConnected, isActive: !!p.isActive,
        // false only when Meta listed the Page without giving Odito a Page token — shown, never hidden, but not selectable
        canConnect: p.canConnect !== false,
      }))
    : (accountsQuery.data?.data?.accounts || []).map((a) => ({
        id: a.id, name: a.name, category: null, picture: normalizeImageUrl(a.picture),
        alreadyConnected: true, isActive: !!a.isActive, canConnect: true,
      }))
  // connect mode: Pages in the person's Business Portfolios that Meta did NOT share with Odito (not ticked in Meta's dialog)
  const unsharedPages = isConnectMode ? (pagesQuery.data?.data?.unsharedPages || []) : []

  const isLoading = isConnectMode ? pagesQuery.isLoading : accountsQuery.isLoading
  const isError = isConnectMode ? pagesQuery.isError : accountsQuery.isError
  const errorMessage = isConnectMode ? pagesQuery.error?.message : accountsQuery.error?.message
  const refetch = isConnectMode ? pagesQuery.refetch : accountsQuery.refetch
  const isMutating = isConnectMode ? selectMutation.isPending : switchMutation.isPending
  const mutationError = isConnectMode ? selectMutation.error : switchMutation.error

  const activePage = pages.find((p) => p.isActive) || null

  // Switch mode keeps its original "default to whatever is already active"
  // behavior. Connect mode starts with nothing pre-selected — right after
  // a fresh OAuth grant there may be no active Page yet, and even when one
  // of the discovered Pages happens to already be active, auto-selecting
  // it here could make "Connect" fire for a Page the user never actually
  // clicked.
  useEffect(() => {
    if (!isConnectMode && open && pages.length > 0 && selectedId === null) {
      setSelectedId(activePage?.id || pages[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnectMode, open, pages.length, activePage?.id])

  function reset() {
    setSelectedId(null)
    setConnectionResult(null)
    selectMutation.reset()
    switchMutation.reset()
    retryInstagramMutation.reset()
  }

  function handleOpenChange(next) {
    if (isMutating) return // don't let the dialog close mid-write
    if (!next) reset()
    onOpenChange(next)
  }

  function handleCardClick(page) {
    if (isMutating || !page.canConnect) return
    setSelectedId(page.id)
  }

  function handlePrimaryAction() {
    if (!selectedId || isMutating) return
    if (isConnectMode) {
      selectMutation.mutate(selectedId, {
        onSuccess: (res) => {
          setConnectionResult(res?.data || null)
          onConnected?.(selectedId)
        },
      })
    } else {
      if (selectedId === activePage?.id) return
      switchMutation.mutate(selectedId, {
        onSuccess: (res) => {
          onSwitched?.(res?.data?.account)
          reset()
          onOpenChange(false)
        },
      })
    }
  }

  function handleRetryInstagram() {
    if (!selectedId) return
    retryInstagramMutation.mutate(selectedId, {
      onSuccess: (res) => {
        setConnectionResult((prev) => ({ ...prev, instagram: res?.data?.instagram || prev?.instagram }))
      },
    })
  }

  function handleDone() {
    reset()
    onOpenChange(false)
  }

  const selectedPage = pages.find((p) => p.id === selectedId) || null
  const canAct = isConnectMode
    ? !!selectedId && !isMutating
    : !!selectedId && selectedId !== activePage?.id && !isMutating

  const instagram = connectionResult?.instagram
  const instagramFailed = instagram && !instagram.connected && instagram.reason && RETRYABLE_INSTAGRAM_REASONS.has(instagram.reason)
  const isRetryingInstagram = retryInstagramMutation.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`sm:max-w-2xl ${contentClassName}`}>
        <DialogHeader>
          <DialogTitle>{connectionResult ? 'Connection result' : isConnectMode ? 'Choose a Facebook Page' : 'Switch Facebook Account'}</DialogTitle>
          {!connectionResult && !isConnectMode && !isLoading && activePage && (
            <p className="text-sm text-muted-foreground">
              Currently connected: <span className="font-semibold text-foreground">{activePage.name || 'Untitled Page'}</span>
            </p>
          )}
          <DialogDescription>
            {connectionResult
              ? `Here's what got connected for ${selectedPage?.name || 'that Page'}.`
              : isConnectMode
                ? "Select the Page you'd like to connect to this project."
                : 'Select the Facebook Page you want to manage.'}
          </DialogDescription>
        </DialogHeader>

        {connectionResult ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#1877F2]/10 text-[#1877F2]">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{connectionResult.facebook?.accountName || selectedPage?.name}</p>
                  <p className="text-xs text-muted-foreground">Facebook Page</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#E4405F]/10 text-[#E4405F]">
                  <Instagram className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {instagram?.connected ? `@${instagram.username || 'instagram'}` : 'Instagram'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {instagram?.connected
                      ? 'Linked via this Page'
                      : instagram?.reason === 'NOT_CONNECTED'
                        ? 'No Instagram account linked to this Page'
                        : isRetryingInstagram
                          ? 'Checking again…'
                          : 'Could not check for a linked Instagram account'}
                  </p>
                </div>
              </div>

              {instagram?.connected ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                </span>
              ) : instagramFailed ? (
                <Button size="sm" variant="outline" disabled={isRetryingInstagram} onClick={handleRetryInstagram} className="shrink-0">
                  {isRetryingInstagram ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Retry'}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">Not connected</span>
              )}
            </div>

            <Button size="sm" className="mt-2" onClick={handleDone}>Done</Button>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading your Facebook Pages…</span>
              </div>
            )}

            {isError && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-sm text-muted-foreground">
                  {errorMessage || 'Could not load your Facebook Pages.'}
                </p>
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            )}

            {!isLoading && !isError && pages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <Facebook className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isConnectMode
                    ? 'No Facebook Pages were found for that account. You need to manage at least one Page to connect it here.'
                    : 'No Facebook Pages are connected yet.'}
                </p>
              </div>
            )}

            {!isLoading && !isError && pages.length > 0 && (
              <div className="max-h-[420px] overflow-y-auto overflow-x-hidden -mx-1 px-1 py-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pages.map((page) => {
                    const isSelected = selectedId === page.id
                    const isActive = page.isActive
                    return (
                      <button
                        key={page.id}
                        type="button"
                        disabled={isMutating || !page.canConnect}
                        onClick={() => handleCardClick(page)}
                        aria-pressed={isSelected}
                        data-testid={`page-card-${page.id}`}
                        className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                          !page.canConnect
                            ? 'cursor-not-allowed border-dashed border-border opacity-60'
                            : isSelected
                              ? 'border-[#1877F2] bg-[#1877F2]/5'
                              : 'border-border hover:border-muted-foreground/30 hover:bg-muted/40'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium px-1.5 py-0.5">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        )}

                        <div className="relative mt-1">
                          <Avatar size="lg" className="h-14 w-14">
                            <AvatarImage src={page.picture || undefined} alt={page.name || 'Page'} />
                            <AvatarFallback className="text-base">{(page.name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-card bg-[#1877F2]">
                            <Facebook className="h-2.5 w-2.5 text-white" />
                          </span>
                        </div>

                        <p className="text-sm font-medium truncate w-full">{page.name || 'Untitled Page'}</p>
                        {isConnectMode && page.category && !isActive && (
                          <p className="text-xs text-muted-foreground truncate w-full -mt-1">{page.category}</p>
                        )}

                        {!isActive && !page.canConnect && (
                          <span className="text-xs text-muted-foreground">Meta gave no access to this Page</span>
                        )}
                        {!isActive && page.canConnect && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${page.alreadyConnected ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                            {page.alreadyConnected ? 'Connected' : 'Connect'}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {isConnectMode && !isLoading && !isError && (unsharedPages.length > 0 || onChoosePages) && (
              <div className="rounded-lg border border-dashed px-3 py-2.5" data-testid="unshared-pages">
                {unsharedPages.length > 0 ? (
                  <>
                    <p className="text-xs font-medium">
                      {unsharedPages.length === 1 ? '1 Page in your Business Portfolios isn’t shared with Odito' : `${unsharedPages.length} Pages in your Business Portfolios aren’t shared with Odito`}
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {unsharedPages.map((u) => (
                        <li key={u.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span className="truncate">{u.name || 'Untitled Page'}</span>
                          {u.businessName && <span className="shrink-0 truncate">{u.businessName}</span>}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-xs text-muted-foreground">To use them, reconnect and tick them in Facebook&apos;s &ldquo;choose Pages&rdquo; step.</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Missing a Page? Reconnect and tick it in Facebook&apos;s &ldquo;choose Pages&rdquo; step.</p>
                )}
                {onChoosePages && (
                  <Button size="sm" variant="outline" className="mt-2" disabled={isMutating} onClick={() => { handleOpenChange(false); onChoosePages() }}>
                    Choose which Pages Odito can use
                  </Button>
                )}
              </div>
            )}

            {!isConnectMode && pages.length === 1 && (
              <div className="flex flex-col items-center gap-2 pt-1 text-center">
                <p className="text-xs text-muted-foreground">Only one Facebook Page is connected.</p>
                {onConnectAnother && (
                  <Button size="sm" variant="ghost" onClick={() => { onOpenChange(false); onConnectAnother() }}>
                    + Connect another Facebook Page
                  </Button>
                )}
              </div>
            )}

            {(selectMutation.isError || switchMutation.isError) && (
              <p className="text-xs text-destructive text-center">
                {mutationError?.message || `Failed to ${isConnectMode ? 'connect' : 'switch to'} ${selectedPage?.name || 'that Page'}. Please try again.`}
              </p>
            )}

            {!isLoading && !isError && pages.length > 0 && (
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" size="sm" disabled={isMutating} onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={!canAct} onClick={handlePrimaryAction}>
                  {isMutating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isConnectMode ? 'Connect' : 'Switch Account'}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
