// Turns a Lighthouse audit's `details` into plain rows the UI can show:
// the actual files, elements and numbers behind each finding.
import { formatBytes, formatMs } from './metrics'

const MAX_ROWS = 8

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

export function shortUrl(url) {
  if (typeof url !== 'string') return ''
  if (!/^https?:\/\//i.test(url.trim())) {
    const code = url.replace(/\s+/g, ' ').trim()
    return `Inline code: ${code.length > 50 ? `${code.slice(0, 47)}…` : code}`
  }
  try {
    const u = new URL(url)
    const file = u.pathname.split('/').filter(Boolean).pop() || u.pathname || '/'
    return `${u.hostname.replace(/^www\./, '')} › ${decodeURIComponent(file).slice(0, 60)}`
  } catch {
    // inline CSS/JS blobs are reported as their source text
    return url.length > 70 ? `${url.slice(0, 67)}…` : url
  }
}

function nodeText(node) {
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text') return String(node.value ?? '')
  const label = (node.nodeLabel || '').split('\n')[0].trim()
  return label || node.selector || node.snippet || ''
}

function formatCell(value, heading) {
  const type = heading?.valueType || heading?.itemType
  if (value === null || value === undefined) return { text: '' }
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value.type === 'node') return { text: nodeText(value), title: value.snippet || value.selector }
    if (value.type === 'source-location') {
      return { text: `${shortUrl(value.url)}${value.line !== undefined ? `:${value.line + 1}` : ''}`, title: value.url, url: value.url }
    }
    if (value.type === 'url') return { text: shortUrl(value.value), title: value.value, url: value.value }
    if (value.type === 'text' || value.type === 'code') return { text: String(value.value ?? '') }
    if (value.type === 'numeric') return { text: Number(value.value).toLocaleString('en-US') }
    return { text: '' }
  }
  switch (type) {
    case 'url': return { text: shortUrl(value), title: value, url: value }
    case 'bytes': return { text: formatBytes(value) }
    case 'ms':
    case 'timespanMs': return { text: formatMs(value) }
    case 'numeric': return { text: typeof value === 'number' ? (Math.round(value * 1000) / 1000).toLocaleString('en-US') : String(value) }
    case 'node': return { text: nodeText(value) }
    default: return { text: String(value) }
  }
}

/** First table found in details (lists wrap tables in LH12+ insights). */
export function findTable(details) {
  if (!details || typeof details !== 'object') return null
  if ((details.type === 'table' || details.type === 'opportunity') && Array.isArray(details.items)) return details
  if (details.type === 'list' && Array.isArray(details.items)) {
    for (const it of details.items) {
      const t = findTable(it)
      if (t && t.items.length) return t
    }
  }
  return null
}

export function findChecklist(details) {
  if (!details || typeof details !== 'object') return null
  if (details.type === 'checklist' && details.items && typeof details.items === 'object') return details.items
  if (details.type === 'list' && Array.isArray(details.items)) {
    for (const it of details.items) {
      const c = findChecklist(it)
      if (c) return c
    }
  }
  return null
}

export function findNode(details) {
  if (!details || typeof details !== 'object') return null
  if (details.type === 'node') return details
  if (Array.isArray(details.items)) {
    for (const it of details.items) {
      if (it?.type === 'node') return it
    }
  }
  return null
}

/** Sub-item text such as "Unsized image element" or an image's reason. */
function subItemNote(item) {
  const subs = item?.subItems?.items
  if (!Array.isArray(subs) || !subs.length) return ''
  const reasons = subs.map(s => s.reason || s.cause).filter(Boolean)
  return [...new Set(reasons)].slice(0, 2).join('; ')
}

/**
 * @returns {{columns:string[], rows:{cells:{text,title?,url?}[], note?:string, thirdParty?:boolean}[], total:number} | null}
 */
export function buildEvidence(audit, siteHost = '') {
  const table = findTable(audit?.details)
  if (!table) return null
  const headings = (table.headings || []).filter(h => h && h.key)
  if (!headings.length) return null
  const items = table.items.filter(it => it && !(it.node?.type === 'text' && /^total$/i.test(it.node.value)))
  if (!items.length) return null
  const rows = items.slice(0, MAX_ROWS).map(item => {
    const cells = headings.map(h => formatCell(item[h.key], h))
    const url = cells.find(c => c.url)?.url
    const host = url ? hostOf(url) : ''
    return {
      cells,
      note: subItemNote(item),
      thirdParty: !!(host && siteHost && !host.endsWith(siteHost) && !siteHost.endsWith(host)),
    }
  })
  return {
    columns: headings.map(h => h.label || h.text || h.key),
    rows,
    total: items.length,
  }
}

/** Every URL string anywhere in the device's audits (for platform detection). */
export function collectUrls(device) {
  const urls = []
  const walk = (v, depth) => {
    if (depth > 6 || urls.length > 3000) return
    if (typeof v === 'string') { if (v.startsWith('http')) urls.push(v); return }
    if (Array.isArray(v)) { v.forEach(x => walk(x, depth + 1)); return }
    if (v && typeof v === 'object') Object.values(v).forEach(x => walk(x, depth + 1))
  }
  for (const a of [...(device?.audits || []), ...(device?.opportunities || []), ...(device?.diagnostics || [])]) {
    walk(a?.details, 0)
  }
  return urls
}

export function detectPlatform(device) {
  const urls = collectUrls(device)
  const has = re => urls.some(u => re.test(u))
  const wordpress = has(/\/wp-(content|includes)\//)
  return {
    wordpress,
    elementor: wordpress && has(/\/plugins\/elementor/),
    divi: wordpress && has(/\/themes\/Divi\//i),
  }
}

/** Plain-text description without markdown link syntax, plus the first link. */
export function cleanDescription(desc = '') {
  let link = null
  const text = String(desc).replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (_, label, href) => {
    if (!link) link = href
    return label
  }).replace(/`/g, '').trim()
  return { text, link }
}
