import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('dist');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const sitemap = readFileSync(resolve(root, 'sitemap.xml'), 'utf8');
const robots = readFileSync(resolve(root, 'robots.txt'), 'utf8');
const llms = readFileSync(resolve(root, 'llms.txt'), 'utf8');

assert.match(html, /<link rel="canonical" href="https:\/\/clearcutt\.in\/">/);
assert.doesNotMatch(html, /chatgpt\.site/);
assert.match(html, /<meta property="og:image" content="https:\/\/clearcutt\.in\/artwork\/clearcut-social-card\.png">/);
assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
assert.match(html, /<meta name="twitter:description" content="[^"]+">/);
assert.match(html, /<meta name="twitter:image" content="https:\/\/clearcutt\.in\/artwork\/clearcut-social-card\.png">/);
assert.match(html, /id="reviews"/);
assert.match(html, /id="review-form"/);
assert.doesNotMatch(html, /AggregateRating|"@type":"Review"/);
assert.match(html, /"@type":"FAQPage"/);
assert.match(robots, /Sitemap: https:\/\/clearcutt\.in\/sitemap\.xml/);
assert.match(llms, /https:\/\/clearcutt\.in\/how-to-remove-background\//);
for (const icon of ['favicon.ico', 'favicon-48.png', 'favicon-512.png', 'favicon.svg', 'apple-touch-icon.png']) {
  assert.ok(existsSync(resolve(root, icon)), `Missing identity asset: ${icon}`);
}

const urls = [...sitemap.matchAll(/<loc>(https:\/\/clearcutt\.in\/[^<]*)<\/loc>/g)].map(match => new URL(match[1]));
assert.equal(urls.length, 10, 'Sitemap must include the homepage and nine generated pages');
for (const url of urls) {
  const relative = url.pathname === '/' ? 'index.html' : `${url.pathname.slice(1)}index.html`;
  assert.ok(existsSync(resolve(root, relative)), `Missing generated page: ${relative}`);
}

const assetPaths = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
assert.ok(assetPaths.length >= 2, 'Expected built JavaScript and CSS assets');
for (const asset of assetPaths) assert.ok(existsSync(resolve(root, asset.slice(1))), `Missing built asset: ${asset}`);

const socialCard = readFileSync(resolve(root, 'artwork/clearcut-social-card.png'));
assert.equal(socialCard.subarray(1, 4).toString(), 'PNG', 'Social card must be a PNG');
console.log(`Verified ${urls.length} crawlable pages, ${assetPaths.length} built assets and social metadata.`);
