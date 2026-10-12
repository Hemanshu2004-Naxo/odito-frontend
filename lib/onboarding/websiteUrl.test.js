import { describe, it, expect } from 'vitest'
import { parseWebsiteUrl, detectWebsiteInput } from './websiteUrl'

describe('parseWebsiteUrl', () => {
  it.each([
    ['https://naxonify.com/', 'https://naxonify.com'],
    ['https://naxonify.com', 'https://naxonify.com'],
    ['naxonify.com', 'https://naxonify.com'],
    ['  NAXONIFY.com/  ', 'https://naxonify.com'],
    ['www.naxonify.com', 'https://www.naxonify.com'],
    ['http://naxonify.com', 'http://naxonify.com'], // an explicit scheme is the user's choice
    ['https://naxonify.com/seo-reseller', 'https://naxonify.com/seo-reseller'],
    ['https://naxonify.com/a?b=1#frag', 'https://naxonify.com/a?b=1'],
    ['https://shop.example.co.uk/', 'https://shop.example.co.uk'],
    ['<https://naxonify.com/>', 'https://naxonify.com'],
    ['https://naxonify.com.', 'https://naxonify.com'], // trailing sentence punctuation
  ])('accepts and normalizes %j -> %s', (input, expected) => {
    const r = parseWebsiteUrl(input)
    expect(r.ok).toBe(true)
    expect(r.url).toBe(expected)
  })

  it.each([
    ['javascript:alert(1)', 'scheme'],
    ['JaVaScRiPt:alert(1)', 'scheme'],
    ['file:///etc/passwd', 'scheme'],
    ['ftp://naxonify.com', 'scheme'],
    ['data:text/html,<script>alert(1)</script>', 'scheme'],
    ['vbscript:msgbox(1)', 'scheme'],
    ['//evil.com', 'malformed'],
    ['', 'empty'],
    ['   ', 'empty'],
    ['not a url', 'malformed'],
    ['https://', 'malformed'],
    ['https://nodot', 'host'],
    ['https://localhost', 'host'],
    ['http://localhost:3000', 'host'],
    ['https://127.0.0.1', 'host'],
    ['http://169.254.169.254/latest/meta-data', 'host'],
    ['https://10.0.0.5', 'host'],
    ['https://[::1]/', 'host'],
    ['https://intranet.local', 'host'],
    ['https://service.internal', 'host'],
    ['https://user:pw@naxonify.com', 'credentials'],
    ['https://naxonify.com:8443', 'port'],
    ['naxonify.com:8080', 'port'],
    ['https://-bad-.com', 'host'],
    ['https://naxonify.c', 'host'],
  ])('rejects %j (%s)', (input, reason) => {
    const r = parseWebsiteUrl(input)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe(reason)
    expect(r.message).toBeTruthy()
  })

  it('rejects non-string and over-long input', () => {
    expect(parseWebsiteUrl(undefined).ok).toBe(false)
    expect(parseWebsiteUrl(null).ok).toBe(false)
    expect(parseWebsiteUrl({}).ok).toBe(false)
    expect(parseWebsiteUrl(`https://naxonify.com/${'a'.repeat(3000)}`).reason).toBe('tooLong')
  })

  it('never touches the network (syntactic only)', () => {
    const f = globalThis.fetch
    globalThis.fetch = () => { throw new Error('network call from a validator') }
    try {
      expect(parseWebsiteUrl('https://naxonify.com').ok).toBe(true)
      expect(detectWebsiteInput('https://naxonify.com')).not.toBeNull()
    } finally {
      globalThis.fetch = f
    }
  })
})

describe('detectWebsiteInput', () => {
  it('recognizes a pasted URL', () => {
    expect(detectWebsiteInput('https://naxonify.com/')).toMatchObject({ ok: true, url: 'https://naxonify.com' })
  })

  it('recognizes a bare domain when that is the whole message', () => {
    expect(detectWebsiteInput('naxonify.com')).toMatchObject({ ok: true, url: 'https://naxonify.com' })
  })

  it('finds an explicit URL inside a sentence', () => {
    expect(detectWebsiteInput('my website is https://naxonify.com/ thanks')).toMatchObject({ ok: true, url: 'https://naxonify.com' })
    expect(detectWebsiteInput('check www.naxonify.com')).toMatchObject({ ok: true, url: 'https://www.naxonify.com' })
  })

  it('does not treat business names or places as URLs', () => {
    for (const text of ['Naxonify', 'Acme.io Labs', 'Sapphire Digital Agency', 'Nashik', 'New York, NY', 'Dr. Smith Dental', 'St. Mary']) {
      expect(detectWebsiteInput(text), text).toBeNull()
    }
  })

  it('flags a dangerous scheme so it can be rejected, instead of treating it as a name', () => {
    for (const text of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi']) {
      const r = detectWebsiteInput(text)
      expect(r, text).not.toBeNull()
      expect(r.ok).toBe(false)
      expect(r.reason).toBe('scheme')
    }
  })

  it('returns a rejection (not null) for an explicit but internal URL', () => {
    expect(detectWebsiteInput('http://localhost:3000')).toMatchObject({ ok: false })
    expect(detectWebsiteInput('http://169.254.169.254/')).toMatchObject({ ok: false })
  })

  it('returns null for empty / non-string input', () => {
    expect(detectWebsiteInput('')).toBeNull()
    expect(detectWebsiteInput('   ')).toBeNull()
    expect(detectWebsiteInput(undefined)).toBeNull()
  })
})
