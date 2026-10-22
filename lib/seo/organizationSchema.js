import { siteConfig } from "@/config/site";

/**
 * Canonical Organization + WebSite JSON-LD for oditoai.com — a single,
 * stable entity (@id: `${siteConfig.url}/#organization`) that every page
 * shares, rather than a separate Organization object per page. Rendered
 * site-wide from the true root layout (app/layout.js) via <JsonLd/>, so
 * this is the ONLY place Organization/WebSite data is defined; do not
 * create a second one elsewhere.
 *
 * Odito is a SaaS platform, not a physically-visited local business — this
 * is deliberately "Organization", never "LocalBusiness". LocalBusiness
 * requires real address/telephone/geo/openingHours data, none of which
 * exists anywhere in this codebase; fabricating it to satisfy an SEO audit
 * would be worse than the "missing schema" issue it's meant to fix.
 *
 * Every field below is sourced from data that already exists in the
 * project (siteConfig, the real logo file in /public) except `sameAs`,
 * which is TEMPORARY PLACEHOLDER data — see the loud comment on that field.
 */

const ORGANIZATION_ID = `${siteConfig.url}/#organization`;
const WEBSITE_ID = `${siteConfig.url}/#website`;

export function getOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "Odito.ai",
        url: siteConfig.url,
        logo: {
          "@type": "ImageObject",
          // The square Odito app icon from the brand kit (public/logo/), the format
          // structured-data logo guidelines ask for.
          url: `${siteConfig.url}/logo/odito-app-icon.png`,
          width: 512,
          height: 512,
        },
        description: siteConfig.description,
        // ⚠️ TEMPORARY PLACEHOLDER — these are NOT verified, real Odito
        // social profile URLs. They were added on explicit request to fill
        // `sameAs` "for now"; the project's own SEO task brief for this
        // change explicitly prohibits inventing sameAs URLs, so this is a
        // deliberate, flagged exception, not an oversight. Replace every
        // entry below with the real, verified profile URL (or remove the
        // ones that don't exist) before this is treated as final/production
        // data — an incorrect sameAs claims Odito owns a profile it may not.
        sameAs: [
          "https://www.linkedin.com/company/oditoai",
          "https://www.facebook.com/oditoai",
          "https://www.instagram.com/oditoai",
          "https://twitter.com/oditoai",
          "https://www.youtube.com/@oditoai",
        ],
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: `${siteConfig.url}/`,
        name: "Odito.ai",
        publisher: { "@id": ORGANIZATION_ID },
      },
    ],
  };
}
