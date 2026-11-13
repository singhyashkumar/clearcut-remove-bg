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
const { pages } = await import(new URL('../scripts/seo.mjs', import.meta.url).pathname);
const expected = [new URL('/', site), ...pages.map(p => new URL(`/${p.slug}/`, site))];
assert.equal(urls.length, expected.length, `Live sitemap must include the homepage and every generated page (${expected.length} URLs)`);
assert.deepEqual(urls.map(url => url.href).sort(), expected.map(url => url.href).sort(), 'Live sitemap URLs must exactly match the generated page list');
for (const url of urls) {
  const page = await (await request(url)).text();
  const canonical = page.match(/<link rel="canonical" href="([^"]+)">/);
  assert.ok(canonical, `Missing canonical link on ${url.href}`);
  assert.equal(new URL(canonical[1], url).href, url.href, `Canonical must match the fetched URL for ${url.href}`);
}
await request(new URL('/robots.txt', site));
await request(new URL('/artwork/clearcut-social-card.png', site));
console.log(`Live SEO smoke test passed for ${urls.length} pages and ${assets.length} hashed assets.`);
