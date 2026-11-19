"use client"

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { FacebookAccountCard } from '@/components/social-media/FacebookAccountCard'
import { InstagramAccountCard } from '@/components/social-media/InstagramAccountCard'
import { GoogleBusinessStatus } from '@/components/social-media/GoogleBusinessStatus'
import { SocialBusinessProfileBoundary } from '@/components/social-media/SocialBusinessProfileBoundary'
import { ConfirmActionDialog } from '@/components/social-media/ConfirmActionDialog'
import SocialMediaToastStack from '@/components/social-media/SocialMediaToastStack'
import FacebookPageSelectorDialog from '@/components/dashboard/social/FacebookPageSelectorDialog'
import { useToastQueue } from '@/hooks/useToastQueue'
import { useProject } from '@/contexts/ProjectContext'
import { useMetaOAuthRedirect } from '@/hooks/useMetaOAuthRedirect'
import { useRetryMetaInstagramDiscovery } from '@/hooks/useDashboardQueries'
import {
  useSocialAccounts, useStartMetaConnection, useVerifySocialAccounts, useDisconnectSocialPlatform, useSocialBusinessProfile,
} from '@/hooks/useSocialMediaAI'
import { describeApiError } from '@/lib/socialMedia/failureMessages'
import { oauthErrorMessage, instagramDiscoveryMessage } from '@/lib/socialMedia/oauthMessages'

// Scopes the shared Page selector's local theme variables to this module's
// always-light surface (otherwise it follows the dashboard's dark theme).
const LIGHT_DIALOG_VARS =
  '[--background:#ffffff] [--foreground:#0f172a] [--card:#ffffff] [--popover:#ffffff] [--popover-foreground:#0f172a] [--muted:#f1f5f9] [--muted-foreground:#64748b] [--border:#e2e8f0] [--accent:#f5f3ff] [--accent-foreground:#6d28d9] bg-white text-slate-800'

const PLATFORM_LABEL = { facebook: 'Facebook', instagram: 'Instagram' }

/**
 * Google Business Profile CONNECTION only: status, connected account, location, last sync and health. The business
 * details Google provides are NOT shown here — they are managed (with their source) in Business Profile. The status
 * comes from the same React Query entry Business Profile uses, so visiting both costs one request, not two.
 * Connecting Google and choosing a location is the existing Google Business Profile flow (linked from the card);
 * nothing here can change Google.
 */
function GoogleConnectionSection({ projectId }) {
  const query = useSocialBusinessProfile(projectId)

  return (
    <section className="space-y-3" aria-labelledby="gbp-section-title" data-testid="gbp-section">
      <div>
        <h2 id="gbp-section-title" className="text-lg font-bold tracking-tight text-slate-900">Business data source</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Connect Google Business Profile so Odito can read your verified business details. What Odito knows about your business is managed in{' '}
          <Link href="/app/social-media/business-profile" className="font-medium text-violet-600 hover:text-violet-700">Business Profile</Link>.
        </p>
      </div>
      <SocialBusinessProfileBoundary projectId={projectId} query={query}>
        {({ resolvedProfile, googleStatus }) => (
          <GoogleBusinessStatus
            googleStatus={googleStatus}
            meta={resolvedProfile.meta}
            locationName={resolvedProfile.business?.name?.source === 'google_business_profile' ? resolvedProfile.business.name.value : null}
          />
        )}
      </SocialBusinessProfileBoundary>
    </section>
  )
}

function ConnectAccountsPageContent() {
  const { activeProjectId } = useProject()
  const accounts = useSocialAccounts(activeProjectId)
  const { facebook, instagram } = accounts
  const { toasts, notify, dismiss } = useToastQueue()

  const [pageDialog, setPageDialog] = useState(null) // 'connect' | 'switch' | null
  const [disconnectTarget, setDisconnectTarget] = useState(null) // 'facebook' | 'instagram' | null
  const [disconnectError, setDisconnectError] = useState(null)
  const [verifyingPlatform, setVerifyingPlatform] = useState(null)
  const [discoveryMessage, setDiscoveryMessage] = useState(null)

  const startConnection = useStartMetaConnection(activeProjectId)
  const verify = useVerifySocialAccounts(activeProjectId)
  const disconnect = useDisconnectSocialPlatform(activeProjectId)
  const instagramCheck = useRetryMetaInstagramDiscovery(activeProjectId)

  // The backend callback sends the browser back here with ?meta_connected=1
  // or ?meta_error=<code>. A successful round trip is NOT yet a connected
  // Page: it opens the Page picker; the status below only changes once a Page
  // is actually selected and persisted by the backend.
  useMetaOAuthRedirect({
    onConnected: () => setPageDialog('connect'),
    onError: (code) => notify(oauthErrorMessage(code), 'danger'),
  })

  function beginOAuth({ reconnect }) {
    if (!activeProjectId) { notify('Select a project before connecting Meta.', 'danger'); return }
    startConnection.mutate({ reconnect }, {
      onError: (error) => notify(describeApiError(error, 'Failed to start the Meta connection.').message, 'danger'),
    })
  }

  function handleVerify(platform) {
    setVerifyingPlatform(platform)
    verify.mutate(undefined, {
      onSuccess: (res) => {
        const results = res?.data?.accounts || []
        if (results.length === 0) notify('No connected account to verify.', 'default')
        else if (results.some((r) => r.status === 'expired' || r.requiresReconnect)) notify('A connection has expired — reconnect required.', 'danger')
        else if (results.some((r) => r.valid === null)) notify('Could not reach Meta to verify right now. Try again.', 'danger')
        else notify('Connection verified with Meta.', 'success')
      },
      onError: (error) => notify(describeApiError(error, 'Verification failed.').message, 'danger'),
      onSettled: () => setVerifyingPlatform(null),
    })
  }

  function handleCheckInstagram() {
    if (!facebook.accountId) return
    setDiscoveryMessage(null)
    instagramCheck.mutate(facebook.accountId, {
      onSuccess: (res) => {
        const result = res?.data?.instagram
        if (result?.connected) { setDiscoveryMessage(null); notify('Instagram account connected.', 'success') }
        else setDiscoveryMessage(instagramDiscoveryMessage(result?.reason))
      },
      onError: (error) => setDiscoveryMessage(describeApiError(error, 'Could not check for a linked Instagram account.').message),
    })
  }

  function handleConfirmDisconnect() {
    const platform = disconnectTarget
    setDisconnectError(null)
    disconnect.mutate(platform, {
      onSuccess: (res) => {
        setDisconnectTarget(null)
        notify(res?.alreadyDisconnected ? `${PLATFORM_LABEL[platform]} was already disconnected.` : `${PLATFORM_LABEL[platform]} disconnected.`, 'default')
      },
      onError: (error) => setDisconnectError(describeApiError(error, 'Failed to disconnect.').message),
    })
  }

  const connecting = startConnection.isPending
  const sharedBusy = { connecting, verifying: verify.isPending && !!verifyingPlatform, disconnecting: disconnect.isPending, refreshing: accounts.isFetching }

  if (!activeProjectId) {
    return (
      <div className="flex-1 space-y-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Connect your accounts</h1>
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm" data-testid="no-project">
          <p className="text-sm font-semibold text-slate-700">No project selected</p>
          <p className="mt-1 text-sm text-slate-400">Select or create a project to connect its Facebook and Instagram accounts.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Connect your accounts</h1>
        <p className="mt-1 text-sm text-slate-500">Connect and manage the external accounts Odito uses.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <FacebookAccountCard
          account={facebook}
          busy={{ ...sharedBusy, verifying: sharedBusy.verifying }}
          onConnect={() => beginOAuth({ reconnect: false })}
          onReconnect={() => beginOAuth({ reconnect: true })}
          onVerify={() => handleVerify('facebook')}
          onDisconnect={() => { setDisconnectError(null); setDisconnectTarget('facebook') }}
          onSwitchPage={() => setPageDialog('switch')}
          onRetryStatus={() => accounts.refetch()}
        />
        <InstagramAccountCard
          account={instagram}
          facebook={facebook}
          busy={{ ...sharedBusy, checking: instagramCheck.isPending }}
          discoveryMessage={discoveryMessage}
          onConnect={() => beginOAuth({ reconnect: false })}
          onCheck={handleCheckInstagram}
          onReconnect={() => beginOAuth({ reconnect: true })}
          onVerify={() => handleVerify('instagram')}
          onDisconnect={() => { setDisconnectError(null); setDisconnectTarget('instagram') }}
          onRetryStatus={() => accounts.refetch()}
        />
      </div>

      <GoogleConnectionSection projectId={activeProjectId} />

      <FacebookPageSelectorDialog
        open={pageDialog !== null}
        mode={pageDialog || 'connect'}
        contentClassName={LIGHT_DIALOG_VARS}
        projectId={activeProjectId}
        onOpenChange={(next) => { if (!next) setPageDialog(null) }}
        onConnected={() => notify('Facebook Page connected.', 'success')}
        onSwitched={(account) => notify(`Switched to ${account?.name || 'that Page'}.`, 'success')}
        onConnectAnother={() => { setPageDialog(null); beginOAuth({ reconnect: false }) }}
        // re-prompts Meta's consent so more Pages / Business Portfolios can be shared with Odito
        onChoosePages={() => { setPageDialog(null); beginOAuth({ reconnect: true }) }}
      />

      <ConfirmActionDialog
        open={disconnectTarget !== null}
        onOpenChange={(next) => { if (!next) setDisconnectTarget(null) }}
        title={`Disconnect ${PLATFORM_LABEL[disconnectTarget] || ''}?`}
        description={disconnectTarget === 'facebook'
          ? 'This disconnects your Facebook Page and the Instagram account linked through it. Posts scheduled for them will fail until you reconnect.'
          : 'This disconnects your Instagram account. Posts scheduled for it will fail until you reconnect.'}
        confirmLabel="Disconnect"
        cancelLabel="Keep connected"
        destructive
        pending={disconnect.isPending}
        error={disconnectError}
        onConfirm={handleConfirmDisconnect}
      />

      <SocialMediaToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// useMetaOAuthRedirect reads the URL via useSearchParams, which needs a
// Suspense boundary in the Next app router.
export default function ConnectAccountsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectAccountsPageContent />
    </Suspense>
  )
}
