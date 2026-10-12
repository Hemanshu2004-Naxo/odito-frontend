/**
 * Website URL parsing for the onboarding chat.
 *
 * Pure string work - it NEVER fetches anything, so a syntactically valid URL
 * says nothing about whether the site is reachable. The backend repeats (and
 * strengthens) these checks; this exists so the user gets instant feedback and
 * so a URL typed into the chat is never mistaken for a business name/location.
 */

const MAX_URL_LENGTH = 2048;

// "example.com", "www.example.co.uk", "xn--bcher-kva.example" - a dotted hostname
// whose last label is a 2+ letter TLD (or punycode TLD).
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const INTERNAL_SUFFIX_RE = /\.(local|localhost|internal|intranet|lan|home|corp)$/i;

// A bare "domain.tld[:port][/path]" token (no scheme).
const BARE_DOMAIN_TOKEN_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#]\S*)?$/i;

const FAIL = {
  empty: 'Please enter your website address (for example, https://yourbusiness.com).',
  scheme: 'Only http:// and https:// website addresses are supported.',
  malformed: "That doesn't look like a valid website address. Try something like https://yourbusiness.com",
  host: 'Please enter a website with a real domain name, like yourbusiness.com.',
  credentials: 'Website addresses with a username or password are not supported.',
  port: 'Please use the standard web address, without a custom port.',
  tooLong: 'That website address is too long.',
};

const fail = (reason) => ({ ok: false, reason, message: FAIL[reason] });

/**
 * Validate and normalize a user-typed website URL.
 * Scheme-less input ("naxonify.com") becomes https://. A bare root path loses its
 * trailing slash ("https://naxonify.com/" -> "https://naxonify.com") and the
 * fragment is dropped; deeper paths and query strings are kept.
 *
 * @param {unknown} input
 * @returns {{ ok: true, url: string, hostname: string } | { ok: false, reason: string, message: string }}
 */
export function parseWebsiteUrl(input) {
  if (typeof input !== 'string') return fail('empty');
  let raw = input.trim().replace(/^[<"'(\[]+|[>"')\].,;!?]+$/g, '');
  if (!raw) return fail('empty');
  if (raw.length > MAX_URL_LENGTH) return fail('tooLong');
  if (/[\s\u0000-\u001f]/.test(raw)) return fail('malformed');

  if (!/^https?:\/\//i.test(raw)) {
    // "javascript:...", "file:///...", "ftp://...", "data:..." - but not "example.com:8080".
    const scheme = raw.match(/^([a-z][a-z0-9+.-]*):(.*)$/i);
    if (scheme && !/^\d+(?:[/?#]|$)/.test(scheme[2])) return fail('scheme');
    // Protocol-relative ("//evil.com") is not something a user types for a website.
    if (raw.startsWith('//')) return fail('malformed');
    raw = `https://${raw}`;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return fail('malformed');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fail('scheme');
  if (parsed.username || parsed.password) return fail('credentials');

  // Host before port: "localhost:3000" should be told "use a real domain", not "no custom port".
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host.startsWith('[') || IPV4_RE.test(host) || host === 'localhost' || INTERNAL_SUFFIX_RE.test(host)) {
    return fail('host');
  }
  if (!HOSTNAME_RE.test(host)) return fail('host');
  if (parsed.port) return fail('port');

  parsed.hash = '';
  let url = parsed.toString();
  if (parsed.pathname === '/' && !parsed.search) url = url.replace(/\/$/, '');
  return { ok: true, url, hostname: host };
}

/**
 * Decide whether a chat message IS (or contains) a website address, so it can
 * be routed to the website step instead of being stored as a business name or
 * location.
 *
 * Detected: an explicit http(s):// token, a www. token, an unsupported-scheme
 * token (javascript:, file:, ...) so it can be rejected with a message, or a
 * message that is nothing but a bare "domain.tld" token. A bare domain inside a
 * longer sentence is deliberately NOT treated as a URL ("Acme.io Labs" is a
 * business name).
 *
 * @param {unknown} text
 * @returns {null | ({ ok: true, url: string, hostname: string } | { ok: false, reason: string, message: string })}
 */
export function detectWebsiteInput(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);

  const explicit = tokens.find((t) => /^[<"'(\[]*(?:https?:\/\/|www\.)\S+/i.test(t));
  if (explicit) return parseWebsiteUrl(explicit);

  if (tokens.length === 1) {
    const token = tokens[0];
    if (/^(?:javascript|data|file|ftp|vbscript|blob|ws|wss|view-source):/i.test(token)) return fail('scheme');
    if (BARE_DOMAIN_TOKEN_RE.test(token.replace(/^[<"'(\[]+|[>"')\].,;!?]+$/g, ''))) return parseWebsiteUrl(token);
  }
  return null;
}
