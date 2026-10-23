import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pages, enhanceHome, renderPage, robots, sitemap, schema } from '../scripts/seo.mjs';
test('search pages have unique canonical URLs, crawlable content and matching sitemap entries',()=>{
 assert.equal(new Set(pages.map(p=>p.slug)).size,pages.length);
 assert.equal(new Set(pages.map(p=>p.title)).size,pages.length);
 for(const p of pages){const html=renderPage(p);assert.ok(html.includes(`rel="canonical" href="https://clearcutt.in/${p.slug}/"`));assert.ok(sitemap.includes(`https://clearcutt.in/${p.slug}/`));assert.equal((html.match(/<h1>/g)||[]).length,1);assert.ok(p.sections.length>=3);const data=JSON.parse(html.match(/application\/ld\+json">(.*?)<\/script>/s)[1]);assert.equal(data.url,`https://clearcutt.in/${p.slug}/`);assert.equal(data.breadcrumb.itemListElement[1].item,data.url);}
 assert.match(robots,/User-agent: \*\nAllow: \/\n/);assert.match(robots,/Sitemap: https:\/\/clearcutt.in\/sitemap.xml/);
});
test('home SEO exposes linked guides and honest schema without altering social preview metadata',()=>{
 const original=readFileSync(new URL('../index.html',import.meta.url),'utf8');const html=enhanceHome(original);
 for(const p of pages)assert.ok(html.includes(`href="https://clearcutt.in/${p.slug}/"`));
 assert.deepEqual(html.match(/<meta (?:property="og:|name="twitter:)[^>]*>/g),original.match(/<meta (?:property="og:|name="twitter:)[^>]*>/g));
 assert.equal(schema['@graph'][1].offers.price,'0');assert.equal(JSON.stringify(schema).includes('aggregateRating'),false);
});
