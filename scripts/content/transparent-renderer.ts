import { transparentPage } from './transparent-page.ts';
import { renderGuideComparison } from './guide-comparison.ts';
import { comparisonStylesheet } from './guide-styles.ts';
import type { GuidePageFields, LegacyGuideSource } from './types.ts';

type RenderOptions = Readonly<{
  linksHtml: string;
  lastModified: string;
}>;

type StructuredPage = Record<string, unknown>;

const site = 'https://clearcutt.in/';
const socialImage = `${site}artwork/clearcut-social-card.png`;
const faviconLinks = '<link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48"><link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">';

const escape = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('"', '&quot;');

const md = (value: string): string => escape(value)
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

const protectEmails = (html: string): string => html.replace(
  /<a href="mailto:[^"]+"[^>]*>.*?<\/a>|yxsingh2@gmail\.com/g,
  match => `<!--email_off-->${match}<!--/email_off-->`,
);

/**
 * Complete static renderer for the transparent-background canary route.
 * Its output is checked byte-for-byte against the shared renderer at build time.
 */
export function renderTransparentPage({ linksHtml, lastModified }: RenderOptions): string {
  const page: LegacyGuideSource = transparentPage;
  const [slug, title, description, sections, faqs = [], rawFields] = page;
  const fields: GuidePageFields = rawFields ?? {};
  const pageTitle = fields.metaTitle ?? title;
  const h1 = fields.h1 ?? title;
  const url = `${site}${slug}/`;

  const data: StructuredPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    isPartOf: { '@id': `${site}#website` },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Clearcutt Remove BG', item: site },
        { '@type': 'ListItem', position: 2, name: title, item: url },
      ],
    },
  };
  data.author = { '@type': 'Organization', '@id': `${site}#organization`, name: 'Clearcutt', url: site };
  data.publisher = { '@id': `${site}#organization` };
  data.dateModified = lastModified;
  data['@graph'] = [{
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: faqs.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }];

  const visual = renderGuideComparison('transparency');
  const body = sections.map(([heading, text]) => `<section><h2>${escape(heading)}</h2><p>${md(text)}</p></section>`).join('');
  const faq = `<section class="faq" aria-labelledby="faq-heading"><h2 id="faq-heading">Frequently asked questions</h2>${faqs.map(([question, answer]) => `<h3>${escape(question)}</h3><p>${md(answer)}</p>`).join('')}</section>`;
  const pageMeta = `<p class="page-meta">Maintained by <a href="/about/#editorial-standards">Clearcutt</a> · Last updated <time datetime="${lastModified}">${new Date(`${lastModified}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time></p>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(pageTitle)} | Clearcutt</title><meta name="description" content="${escape(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="referrer" content="no-referrer"><meta property="og:site_name" content="Clearcutt"><meta property="og:title" content="${escape(pageTitle)} | Clearcutt"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:image" content="${socialImage}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Clearcutt Remove BG — private, on-device image background removal"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(pageTitle)} | Clearcutt"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${socialImage}"><meta name="twitter:image:alt" content="Clearcutt Remove BG — private, on-device image background removal"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; script-src https://static.cloudflareinsights.com; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'"><link rel="canonical" href="${url}">${faviconLinks}<link rel="stylesheet" href="${comparisonStylesheet}"><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><a class="skip" href="#content">Skip to content</a><header><a class="brand" href="/">◩ clearcutt.</a><nav aria-label="Main"><a href="/#workspace">Remove background</a><a href="/how-to-remove-background/">How to use</a><a href="/#plans">Pricing</a></nav></header><main id="content"><p class="breadcrumb"><a href="/">Home</a><span aria-hidden="true"> / </span>${escape(title)}</p><h1>${escape(h1)}</h1><p class="lead">${escape(description)}</p>${pageMeta}${visual}${body}<p class="editorial-note"></p>${faq}<p><a class="cta" href="/#workspace">Open the free background remover →</a></p><aside aria-label="Related guides"><h2>Explore Clearcutt</h2><ul>${linksHtml}</ul></aside></main><footer><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/contact/">Contact</a><a href="/THIRD_PARTY_NOTICES.md">Open-source notices</a></footer></body></html>`;

  // The empty editorial marker is removed to preserve the legacy byte stream.
  return protectEmails(html.replace('<p class="editorial-note"></p>', ''));
}
