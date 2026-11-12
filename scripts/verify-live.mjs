import assert from 'node:assert/strict';

const site = new URL(process.argv[2] || 'https://clearcutt.in/');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(url, attempts = 4) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'follow', headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
      if (response.ok) return response;
      last = new Error(`${response.status} ${response.statusText} for ${url}`);
    } catch (error) { last = error; }
    if (attempt < attempts) await delay(attempt * 3000);
  }
  throw last;
}

const html = await (await request(site)).text();
assert.match(html, new RegExp(`<link rel="canonical" href="${site.href.replaceAll('.', '\\.')}">`));
assert.doesNotMatch(html, /chatgpt\.site/);
assert.match(html, /<meta property="og:image" content="https:\/\/clearcutt\.in\/artwork\/clearcut-social-card\.png">/);
assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
assert.match(html, /id="reviews"/);
assert.match(html, /id="review-form"/);

const assets = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.(?:js|css))"/g)]
  .map(match => new URL(match[1], site));
assert.ok(assets.length >= 2, 'Expected JavaScript and CSS references in live HTML');
for (const asset of assets) await request(asset);

const sitemap = await (await request(new URL('/sitemap.xml', site))).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
assert.equal(urls.length, 10, 'Live sitemap must include ten pages');
for (const url of urls) await request(url);
await request(new URL('/robots.txt', site));
await request(new URL('/artwork/clearcut-social-card.png', site));
console.log(`Live SEO smoke test passed for ${urls.length} pages and ${assets.length} hashed assets.`);
