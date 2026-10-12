"use client";

import { useId, useState } from 'react';
import ButtonGroup from './ButtonGroup';
import { parseWebsiteUrl } from '@/lib/onboarding/websiteUrl';

/**
 * Manual website entry shown inside the onboarding chat when the business
 * search fails. The website is the only required field; business name and
 * city are optional and are never invented if left blank.
 *
 * Purely presentational: validation is syntactic (no network), and submitting
 * hands plain values to the parent, which owns the flow state.
 *
 * Props:
 *   initialValues  – { websiteUrl, businessName, location } preserved from the chat
 *   onContinue     – ({ websiteUrl, businessName, location }) => void  (websiteUrl already normalized)
 *   onRetry        – ({ websiteUrl, businessName, location }) => void  (raw values, nothing validated)
 *   canRetry       – false when retrying a search is pointless (e.g. credentials problem)
 *   disabled       – true while a submission is in flight
 */
export default function WebsiteFallbackForm({ initialValues = {}, onContinue, onRetry, canRetry = true, disabled = false }) {
  const uid = useId();
  const [websiteUrl, setWebsiteUrl] = useState(initialValues.websiteUrl || '');
  const [businessName, setBusinessName] = useState(initialValues.businessName || '');
  const [location, setLocation] = useState(initialValues.location || '');
  const [touched, setTouched] = useState(false);

  const parsed = parseWebsiteUrl(websiteUrl);
  const showError = touched && !parsed.ok;
  const errorId = `${uid}-website-error`;

  const values = () => ({
    websiteUrl: websiteUrl.trim(),
    businessName: businessName.trim(),
    location: location.trim(),
  });

  const submit = (e) => {
    e?.preventDefault?.();
    if (disabled) return;
    setTouched(true);
    const result = parseWebsiteUrl(websiteUrl);
    if (!result.ok) return;
    onContinue({ ...values(), websiteUrl: result.url });
  };

  return (
    <form className="chat-fallback-card" onSubmit={submit} noValidate aria-label="Continue with your website">
      <div className="chat-field">
        <label htmlFor={`${uid}-website`}>Website URL</label>
        <input
          id={`${uid}-website`}
          className="chat-input"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="https://yourbusiness.com"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          onBlur={() => websiteUrl.trim() && setTouched(true)}
          aria-invalid={showError ? 'true' : 'false'}
          aria-describedby={showError ? errorId : undefined}
          disabled={disabled}
          required
        />
        {showError && <p id={errorId} role="alert" className="chat-field-error">{parsed.message}</p>}
      </div>

      <div className="chat-field">
        <label htmlFor={`${uid}-name`}>Business name <span style={{ opacity: 0.6 }}>(optional)</span></label>
        <input
          id={`${uid}-name`}
          className="chat-input"
          type="text"
          autoComplete="organization"
          placeholder="e.g. Naxonify"
          maxLength={120}
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="chat-field">
        <label htmlFor={`${uid}-location`}>City or location <span style={{ opacity: 0.6 }}>(optional)</span></label>
        <input
          id={`${uid}-location`}
          className="chat-input"
          type="text"
          autoComplete="address-level2"
          placeholder="e.g. Nashik"
          maxLength={120}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={disabled}
        />
        <p className="chat-field-hint">Only needed if you choose Local SEO and we can't find it on your website.</p>
      </div>

      <ButtonGroup
        buttons={[
          // type=submit lets Enter in any field submit; ButtonGroup buttons are plain,
          // so the primary action is wired through onClick as well.
          { key: 'continue', label: 'Continue with Website', icon: '🌐', variant: 'primary', onClick: submit, disabled },
          ...(canRetry
            ? [{ key: 'retry', label: 'Try Again', icon: '🔄', variant: 'secondary', onClick: (e) => { e?.preventDefault?.(); if (!disabled) onRetry(values()); }, disabled }]
            : []),
        ]}
      />
    </form>
  );
}
