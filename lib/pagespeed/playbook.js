// What each Lighthouse finding means in plain English and how to fix it.
// Summaries only quote numbers that are in the scan itself.
import { findChecklist, findTable, hostOf } from './evidence'
import { formatBytes, formatMs } from './metrics'

const items = a => findTable(a?.details)?.items || []
// Real count (details are capped at 20 rows when stored).
const count = a => (typeof a?.itemCount === 'number' && findTable(a?.details) === a?.details ? a.itemCount : items(a).length)
const sum = (arr, key) => arr.reduce((t, it) => t + (Number(it?.[key]) || 0), 0)
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const WP_PERF_PLUGIN = 'a performance plugin such as WP Rocket, LiteSpeed Cache, Perfmatters or FlyingPress'

// Third-party services we can give a specific fix for.
const THIRD_PARTY_TIPS = [
  { re: /youtube|vimeo|wistia/i, tip: entity => `${entity}: replace each embedded video with a lightweight "click to play" preview image (a video facade). The player only loads when someone presses play. Generic option: lite-youtube-embed.`, wp: `WP Rocket ("Replace YouTube iframe with preview image"), Perfmatters or FlyingPress can add video facades without code.` },
  { re: /tag manager|google analytics|doubleclick|google ads/i, tip: entity => `${entity}: remove tags you no longer use and avoid loading Google Analytics twice (directly and through Tag Manager).` },
  { re: /facebook|meta|tiktok|linkedin|twitter|pinterest|hotjar|clarity/i, tip: entity => `${entity}: delay this tracking script until the visitor first scrolls or taps — it does not need to run before the page is visible.` },
  { re: /zoho|tawk|intercom|drift|hubspot|crisp|livechat|freshchat|tidio|wati|whatsapp/i, tip: entity => `${entity} (chat widget): load it after the visitor interacts or after a few seconds instead of during page load.` },
  { re: /fonts\.g|google fonts/i, tip: entity => `${entity}: host the fonts on your own domain and load only the weights you use.` },
]

export const PLAYBOOK = {
  'render-blocking-insight': {
    title: 'Files are blocking the page from appearing',
    metrics: ['fcp', 'lcp'],
    base: 0.7,
    summary: a => {
      const n = count(a)
      return `${plural(n, 'CSS/JavaScript file')} must finish downloading before the browser can draw anything${a.displayValue ? ` — Google estimates fixing this saves ${a.displayValue.replace(/^Est savings of /i, '')}` : ''}.`
    },
    steps: [
      'Load only the CSS needed for the top of the page first (critical CSS) and load the rest after the page appears.',
      'Add defer to scripts that are not needed for the first view.',
      'Stop plugins and widgets from loading their CSS/JS on pages that do not use them.',
    ],
    wordpress: [
      `In ${WP_PERF_PLUGIN}, turn on "Load JavaScript deferred" and "Optimize CSS delivery" / "Remove unused CSS".`,
      'Use a script manager (Perfmatters Script Manager or Asset CleanUp) to switch off plugin files on pages where the plugin is not used, e.g. popup, slider or form plugins.',
    ],
  },
  'unused-javascript': {
    title: 'The page downloads JavaScript it never uses',
    metrics: ['tbt', 'lcp'],
    base: 0.6,
    magnitude: a => Math.min(1, sum(items(a), 'wastedBytes') / (2 * 1024 * 1024)),
    summary: a => {
      const its = items(a)
      const wasted = sum(its, 'wastedBytes')
      const hosts = [...new Set(its.slice(0, 5).map(it => hostOf(it.url)).filter(Boolean))].slice(0, 3)
      return `${formatBytes(wasted)} of JavaScript across ${plural(count(a), 'file')} is downloaded but never run on this page${hosts.length ? ` — the biggest come from ${hosts.join(', ')}` : ''}.`
    },
    steps: [
      'Remove scripts, plugins and embeds you do not actually need on this page.',
      'Delay non-essential scripts (analytics, pixels, chat, video players) until the visitor interacts.',
      'If you build the site yourself, split bundles so each page only loads its own code.',
    ],
    wordpress: [
      `Turn on "Delay JavaScript execution" in ${WP_PERF_PLUGIN} for tracking, chat and video scripts.`,
      'Deactivate plugins you no longer use — each one can add its own scripts to every page.',
    ],
  },
  'unused-css-rules': {
    title: 'Most of the CSS on this page is unused',
    metrics: ['fcp', 'lcp'],
    base: 0.5,
    summary: a => `${formatBytes(sum(items(a), 'wastedBytes'))} of CSS rules are downloaded but not used on this page${a.displayValue ? ` (${a.displayValue.replace(/^Est savings of /i, 'est. savings ')})` : ''}.`,
    steps: [
      'Generate "used CSS" per page and load the full stylesheet later.',
      'Remove theme/plugin stylesheets for features this page does not use.',
    ],
    wordpress: [
      `Enable "Remove unused CSS" (WP Rocket), "Used CSS" (Perfmatters / FlyingPress) or "UCSS" (LiteSpeed Cache).`,
    ],
  },
  'bootup-time': {
    title: 'JavaScript keeps the phone busy',
    metrics: ['tbt'],
    base: 0.8,
    summary: a => {
      const top = items(a)[0]
      return `Scripts use ${formatMs(a.numericValue)} of processor time while the page loads${top?.url ? `. The heaviest is ${hostOf(top.url) || 'your own page'} (${formatMs(top.total)})` : ''}. During this time the page cannot respond to taps.`
    },
    steps: [
      'Start with the scripts at the top of the list below — remove, replace or delay them.',
      'Load third-party widgets (video, chat, maps, reviews) only when the visitor reaches or clicks them.',
    ],
    wordpress: [
      `Use "Delay JavaScript execution" in ${WP_PERF_PLUGIN} so these scripts wait for the first interaction.`,
    ],
  },
  'mainthread-work-breakdown': {
    title: 'The browser has too much work to do',
    metrics: ['tbt'],
    base: 0.6,
    summary: a => {
      const top = items(a)[0]
      return `The browser spends ${formatMs(a.numericValue)} working before the page settles${top?.groupLabel ? `, mostly on "${top.groupLabel}" (${formatMs(top.duration)})` : ''}.`
    },
    steps: [
      'If "Script Evaluation" is the biggest item, fix the JavaScript findings first.',
      'If "Style & Layout" or "Rendering" is big, simplify the page structure and heavy animations.',
    ],
  },
  'third-parties-insight': {
    title: 'Third-party services are slowing the page',
    metrics: ['tbt', 'lcp'],
    base: 0.7,
    include: a => items(a).some(it => (it.mainThreadTime || 0) >= 250 || (it.transferSize || 0) >= 500 * 1024),
    magnitude: a => Math.min(1, sum(items(a), 'mainThreadTime') / 3000),
    summary: a => {
      const top = [...items(a)].sort((x, y) => (y.mainThreadTime || 0) - (x.mainThreadTime || 0)).slice(0, 3)
      const parts = top.map(it => `${it.entity} (${formatBytes(it.transferSize)}, ${formatMs(it.mainThreadTime)} CPU)`)
      return `Code from other companies loads on your page: ${parts.join(', ')}.`
    },
    dynamicSteps: (a, ctx) => {
      const out = []
      for (const it of items(a).slice(0, 6)) {
        const t = THIRD_PARTY_TIPS.find(x => x.re.test(it.entity || ''))
        if (t && !out.some(o => o.tip === t)) out.push({ tip: t, entity: it.entity })
      }
      return {
        steps: [
          ...out.map(o => o.tip.tip(o.entity)),
          'Remove any third-party service you no longer use.',
        ],
        wordpress: ctx.platform?.wordpress ? out.filter(o => o.tip.wp).map(o => o.tip.wp) : [],
      }
    },
  },
  'image-delivery-insight': {
    title: 'Images are larger than they need to be',
    metrics: ['lcp'],
    base: 0.5,
    magnitude: a => Math.min(1, sum(items(a), 'wastedBytes') / (1024 * 1024)),
    summary: a => `${plural(count(a), 'image')} could be ${formatBytes(sum(items(a), 'wastedBytes'))} smaller in total by compressing, resizing to the size they are shown at, or using WebP/AVIF.`,
    steps: [
      'Resize images to the size they are actually displayed at (and provide smaller versions for phones via srcset).',
      'Compress images and serve WebP or AVIF.',
    ],
    wordpress: [
      'Use an image optimizer (ShortPixel, Imagify, EWWW or Smush) to compress existing images and serve WebP/AVIF.',
      'Upload images close to their display size instead of full camera-size originals.',
    ],
  },
  'cache-insight': {
    title: 'Files are not cached for returning visitors',
    metrics: ['lcp'],
    base: 0.35,
    summary: (a, ctx) => {
      const its = items(a)
      const own = its.filter(it => ctx.siteHost && hostOf(it.url).endsWith(ctx.siteHost))
      return `${plural(count(a), 'file')} ${count(a) === 1 ? 'has' : 'have'} a short or no cache lifetime, so returning visitors download them again (${formatBytes(sum(its, 'totalBytes'))})${own.length ? `. ${own.length} of them are on your own domain, which you control` : ''}.`
    },
    steps: [
      'Set a long Cache-Control lifetime (e.g. one year) for images, fonts, CSS and JS on your server or CDN.',
      'Files hosted by other companies (Facebook, Google…) cannot be changed by you — focus on your own files.',
    ],
    wordpress: [
      `Enable browser caching in ${WP_PERF_PLUGIN}, or through your host / Cloudflare.`,
    ],
  },
  'lcp-discovery-insight': {
    title: 'The main hero content is not prioritised',
    metrics: ['lcp'],
    base: 0.6,
    summary: (a, ctx) => {
      const checks = findChecklist(a.details) || {}
      const failed = Object.values(checks).filter(c => c && c.value === false).map(c => c.label)
      return `${ctx.lcpElement ? `Your largest element is "${ctx.lcpElement}". ` : ''}${failed.length ? `Missing: ${failed.join('; ')}.` : 'The browser discovers it later than it should.'}`
    },
    dynamicSteps: (a, ctx) => {
      const steps = [
        'Make the hero image a normal <img> in the HTML (not a CSS background or something a script inserts).',
        'Add fetchpriority="high" to the hero image and never lazy-load it.',
      ]
      if (ctx.lcpInSlider) steps.push('Your hero sits inside a slider/carousel — slider scripts delay it. A single static hero image is much faster.')
      return {
        steps,
        wordpress: ctx.platform?.wordpress ? ['Exclude the hero image from lazy-loading in your optimisation plugin and enable its "preload LCP image" option if it has one.'] : [],
      }
    },
  },
  'font-display-insight': {
    title: 'Text is invisible while fonts load',
    metrics: ['fcp'],
    base: 0.3,
    summary: a => `${plural(count(a), 'web font')} ${count(a) === 1 ? 'hides' : 'hide'} text until they finish downloading${a.displayValue ? ` (${a.displayValue.replace(/^Est savings of /i, 'est. savings ')})` : ''}.`,
    steps: [
      'Add font-display: swap to your @font-face rules so text shows immediately in a fallback font.',
      'Use fewer font families and weights; preload the one used above the fold.',
    ],
    wordpress: ['Most optimisation plugins have a "font-display: swap" option; theme/page-builder settings often allow loading Google Fonts locally.'],
  },
  'cls-culprits-insight': {
    title: 'Content jumps around while loading',
    metrics: ['cls'],
    base: 0.6,
    include: a => typeof a.score === 'number' && a.score < 0.9,
    summary: a => {
      const its = items(a).filter(it => it.node?.type !== 'text')
      const causes = [...new Set(its.flatMap(it => (it.subItems?.items || []).map(s => s.cause)).filter(Boolean))]
      return `${plural(its.length, 'element')} moved during loading${causes.length ? `, caused by: ${causes.slice(0, 3).join(', ')}` : ''}.`
    },
    steps: [
      'Give every image, video and iframe a width and height (or aspect-ratio) so space is reserved.',
      'Reserve space for banners, cookie bars and embeds instead of inserting them above existing content.',
      'Use font-display: swap with a fallback font of similar size.',
    ],
  },
  'unsized-images': {
    title: 'Images have no width and height set',
    metrics: ['cls'],
    base: 0.35,
    summary: a => `${plural(count(a), 'image')} ${count(a) === 1 ? 'has' : 'have'} no width/height, so the page jumps when they load.`,
    steps: ['Add width and height attributes (matching the image proportions) to each image listed below.'],
    wordpress: ['Re-insert the images through the WordPress media library or page builder image widget, which adds width/height automatically.'],
  },
  'total-byte-weight': {
    title: 'The page is very heavy to download',
    metrics: ['lcp', 'speed_index'],
    base: 0.5,
    magnitude: a => Math.min(1, (a.numericValue || 0) / (8 * 1024 * 1024)),
    summary: a => {
      const its = items(a)
      const video = its.find(it => /\.(mp4|webm|mov)(\?|$)/i.test(it.url || '') && (it.totalBytes || 0) > 1024 * 1024)
      return `Visitors download ${formatBytes(a.numericValue)} to view this page${video ? `. One video file alone is ${formatBytes(video.totalBytes)} (${video.url.split('/').pop().split('?')[0]})` : ''}.`
    },
    dynamicSteps: a => {
      const hasVideo = items(a).some(it => /\.(mp4|webm|mov)(\?|$)/i.test(it.url || ''))
      return {
        steps: [
          ...(hasVideo ? ['Do not autoload large videos: add preload="none" and a poster image, compress the file, or host it on YouTube/Vimeo behind a click-to-play preview.'] : []),
          'Work down the list of largest files below — compress, replace or remove them.',
        ],
      }
    },
  },
  'network-dependency-tree-insight': {
    title: 'Important files load one after another',
    metrics: ['lcp', 'fcp'],
    base: 0.3,
    summary: () => 'Critical files are chained — each one is only requested after the previous one finished.',
    steps: [
      'Preload the key font and hero image, and add preconnect for the most important other domains.',
      'Reduce the number of CSS/JS files needed before the page can render.',
    ],
  },
  'forced-reflow-insight': {
    title: 'Scripts make the browser recalculate the layout',
    metrics: ['tbt'],
    base: 0.35,
    summary: a => {
      const its = items(a).filter(it => it.source?.url)
      const total = sum(its, 'reflowTime')
      return `JavaScript forces repeated layout work${total ? ` (${formatMs(total)})` : ''}${its[0] ? `, mostly from ${its[0].source.url.split('/').pop().split('?')[0]}` : ''}.`
    },
    steps: [
      'Usually caused by sliders, sticky headers and animation scripts — remove or replace the ones listed.',
      'Developers: batch DOM reads before writes and avoid reading offsetWidth/height in loops.',
    ],
  },
  'legacy-javascript-insight': {
    title: 'Scripts include code for very old browsers',
    metrics: ['tbt'],
    base: 0.15,
    summary: (a, ctx) => `${formatBytes(sum(items(a), 'wastedBytes'))} of old-browser compatibility code is shipped${ctx.siteHost && items(a).length && items(a).every(it => !hostOf(it.url).endsWith(ctx.siteHost)) ? ' — all of it inside third-party scripts you cannot edit' : ''}.`,
    steps: ['If it comes from your own build, target modern browsers only. If it comes from a third-party script, the fix is to delay or remove that script.'],
  },
  'duplicated-javascript-insight': {
    title: 'The same JavaScript library is loaded twice',
    metrics: ['tbt'],
    base: 0.3,
    summary: () => 'Some JavaScript modules are included in more than one file.',
    steps: ['Find which plugins/bundles both include the library and load it only once.'],
  },
  'document-latency-insight': {
    title: 'The server is slow to send the page',
    metrics: ['fcp', 'lcp'],
    base: 0.6,
    summary: a => {
      const checks = findChecklist(a.details) || {}
      const failed = Object.values(checks).filter(c => c && c.value === false).map(c => c.label)
      return failed.length ? `Problems with the first request: ${failed.join('; ')}.` : 'The first request for the page is slow.'
    },
    steps: ['Use full-page caching, a faster host or a CDN, enable compression, and remove redirects.'],
    wordpress: [`Enable page caching in ${WP_PERF_PLUGIN} or your host.`],
  },
  'server-response-time': {
    title: 'The server is slow to respond',
    metrics: ['fcp', 'lcp'],
    base: 0.6,
    summary: a => `Your server took ${formatMs(a.numericValue)} to start sending the page.`,
    steps: ['Use full-page caching, a faster host or a CDN close to your visitors.'],
    wordpress: [`Enable page caching in ${WP_PERF_PLUGIN} or your host.`],
  },
  redirects: {
    title: 'Redirects delay the page',
    metrics: ['fcp', 'lcp'],
    base: 0.4,
    summary: a => `The browser is redirected before reaching the final page${a.displayValue ? ` (${a.displayValue})` : ''}.`,
    steps: ['Link directly to the final URL (correct https/www version) everywhere, including Google Business Profile and ads.'],
  },
  'dom-size-insight': {
    title: 'The page has too many HTML elements',
    metrics: ['tbt'],
    base: 0.3,
    include: a => typeof a.score === 'number' && a.score < 0.9,
    summary: a => {
      const total = items(a).find(it => /total/i.test(it.statistic || ''))?.value?.value
      return `The page is built from ${total ? total.toLocaleString('en-US') : 'a very large number of'} elements, which makes every update slower.`
    },
    steps: ['Remove hidden/duplicate sections (e.g. separate mobile and desktop copies) and flatten deeply nested layouts.'],
  },
  'unminified-javascript': {
    title: 'JavaScript files are not minified',
    metrics: ['fcp', 'lcp'],
    base: 0.1,
    summary: a => `Minifying would save ${formatBytes(sum(items(a), 'wastedBytes'))}.`,
    steps: ['Turn on JavaScript minification in your build tool or optimisation plugin.'],
  },
  'unminified-css': {
    title: 'CSS files are not minified',
    metrics: ['fcp', 'lcp'],
    base: 0.1,
    summary: a => `Minifying would save ${formatBytes(sum(items(a), 'wastedBytes'))}.`,
    steps: ['Turn on CSS minification in your build tool or optimisation plugin.'],
  },
  'viewport-insight': {
    title: 'Mobile viewport is not set up correctly',
    metrics: ['tbt'],
    base: 0.4,
    summary: () => 'The page is missing a proper mobile viewport tag, which delays taps on phones.',
    steps: ['Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the page <head>.'],
  },
}

// Pre-Lighthouse-12 IDs → the playbook entry that covers them.
export const LEGACY_ALIASES = {
  'render-blocking-resources': 'render-blocking-insight',
  'uses-long-cache-ttl': 'cache-insight',
  'uses-responsive-images': 'image-delivery-insight',
  'modern-image-formats': 'image-delivery-insight',
  'uses-webp-images': 'image-delivery-insight',
  'uses-optimized-images': 'image-delivery-insight',
  'efficient-animated-images': 'image-delivery-insight',
  'offscreen-images': 'image-delivery-insight',
  'properly-size-images': 'image-delivery-insight',
  'layout-shift-elements': 'cls-culprits-insight',
  'legacy-javascript': 'legacy-javascript-insight',
  'duplicated-javascript': 'duplicated-javascript-insight',
  'dom-size': 'dom-size-insight',
  'third-party-summary': 'third-parties-insight',
  'font-display': 'font-display-insight',
}

export function playbookFor(id) {
  return PLAYBOOK[id] || PLAYBOOK[LEGACY_ALIASES[id]] || null
}
