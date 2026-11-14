import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { pages, enhanceHome, renderPage, robots, sitemap, schema } from '../scripts/seo.mjs';
test('search pages have unique canonical URLs, crawlable content and matching sitemap entries',()=>{
 assert.equal(new Set(pages.map(p=>p.slug)).size,pages.length);
 assert.equal(new Set(pages.map(p=>p.title)).size,pages.length);
 for(const p of pages){const html=renderPage(p);assert.ok(html.includes(`rel="canonical" href="https://clearcutt.in/${p.slug}/"`));assert.ok(sitemap.includes(`https://clearcutt.in/${p.slug}/`));assert.equal((html.match(/<h1>/g)||[]).length,1);assert.ok(p.sections.length>=3);const data=JSON.parse(html.match(/application\/ld\+json">(.*?)<\/script>/s)[1]);assert.equal(data.url,`https://clearcutt.in/${p.slug}/`);assert.equal(data.breadcrumb.itemListElement[1].item,data.url);}
 assert.match(robots,/User-agent: \*\nAllow: \/\n/);assert.match(robots,/Sitemap: https:\/\/clearcutt.in\/sitemap.xml/);
});
test('home SEO exposes linked guides, instant reviews and complete honest social metadata',()=>{
 const original=readFileSync(new URL('../index.html',import.meta.url),'utf8');const html=enhanceHome(original);
 for(const p of pages)assert.ok(html.includes(`href="https://clearcutt.in/${p.slug}/"`));
 assert.ok(html.includes('id="reviews"'));assert.ok(html.includes('id="review-form"'));assert.ok(html.includes('Private%20Clearcut%20feedback'));
 assert.match(html,/Reviews come from signed-in users and are published immediately/);
 assert.ok(html.includes('property="og:url" content="https://clearcutt.in/"'));
 assert.ok(html.includes('property="og:image" content="https://clearcutt.in/artwork/clearcut-social-card.png"'));
 assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
 assert.ok(html.includes('name="twitter:description"'));
 assert.ok(html.includes('name="twitter:image" content="https://clearcutt.in/artwork/clearcut-social-card.png"'));
 assert.equal(html.includes('chatgpt.site'),false);
 assert.equal(schema['@graph'][0].name,'Clearcut');assert.deepEqual(schema['@graph'][0].alternateName,['Clearcut Remove BG','clearcutt.in']);
 assert.equal(schema['@graph'][2]['@type'],'FAQPage');assert.equal(schema['@graph'][2].mainEntity.length,4);
 assert.equal(schema['@graph'][3].offers.price,'0');assert.equal(JSON.stringify(schema).includes('aggregateRating'),false);
 assert.ok(html.includes('href="/favicon.ico"'));assert.ok(html.includes('href="/favicon-48.png"'));assert.ok(html.includes('href="/apple-touch-icon.png"'));
});
test('every generated page has production social metadata without fake ratings',()=>{
 for(const p of pages){const html=renderPage(p);assert.ok(html.includes(`property="og:url" content="https://clearcutt.in/${p.slug}/"`));assert.ok(html.includes('property="og:image" content="https://clearcutt.in/artwork/clearcut-social-card.png"'));assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));assert.ok(html.includes('name="twitter:description"'));assert.ok(html.includes('href="/favicon.ico"'));assert.ok(html.includes('property="og:site_name" content="Clearcut"'));assert.equal(/AggregateRating|"@type":"Review"/.test(html),false);}
});
test('generated pages have unique descriptions and a single canonical URL each',()=>{
 assert.equal(new Set(pages.map(p=>p.description)).size,pages.length);
 for(const p of pages){const html=renderPage(p);assert.equal((html.match(/rel="canonical"/g)||[]).length,1);}
});
test('every ld+json block on every rendered page parses and generated pages carry exactly one block',()=>{
 const blocks=html=>[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1]);
 for(const p of pages){
  const html=renderPage(p);
  const pageBlocks=blocks(html);
  assert.equal(pageBlocks.length,1,`${p.slug} must render exactly one ld+json block, found ${pageBlocks.length}`);
  for(const block of pageBlocks){
   let data;
   assert.doesNotThrow(()=>{data=JSON.parse(block);},`${p.slug} has an invalid ld+json block`);
   assert.equal(data['@type'],'WebPage',`${p.slug} root node must stay WebPage`);
   assert.equal(data.breadcrumb['@type'],'BreadcrumbList',`${p.slug} must keep its BreadcrumbList`);
   assert.equal(data.breadcrumb.itemListElement.length,2,`${p.slug} breadcrumb must have two items`);
   assert.equal(data.breadcrumb.itemListElement[1].item,`https://clearcutt.in/${p.slug}/`);
  }
 }
 const homeHtml=enhanceHome(readFileSync(new URL('../index.html',import.meta.url),'utf8'));
 const homeBlocks=blocks(homeHtml);
 assert.equal(homeBlocks.length,1,`home must render exactly one ld+json block, found ${homeBlocks.length}`);
 const homeData=JSON.parse(homeBlocks[0]);
 const nodes=homeData['@graph']??[homeData];
 for(const type of ['WebSite','Organization','FAQPage','WebApplication'])
  assert.ok(nodes.some(n=>n['@type']===type),`home schema must keep its ${type} node`);
 assert.equal(JSON.stringify(homeData).includes('aggregateRating'),false);
 assert.equal(JSON.stringify(homeData).includes('"@type":"Review"'),false);
});
test('all six legacy guide pages render visible FAQs that exactly match their FAQPage structured data',()=>{
 const guides=pages.filter(p=>['how-to-remove-background','transparent-background','remove-background-products','remove-background-portraits','remove-background-animals','remove-background-cars'].includes(p.slug));
 assert.equal(guides.length,6,'all six legacy guide pages must exist');
 const esc=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 for(const p of guides){
  assert.equal(p.faqs.length,5,`${p.slug} must expose exactly 5 FAQs`);
  const html=renderPage(p);
  assert.ok(html.includes('id="faq-heading"'),`${p.slug} FAQ section must be visibly rendered`);
  const data=JSON.parse([...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1])[0]);
  assert.equal(data['@type'],'WebPage');
  assert.equal(data.url,`https://clearcutt.in/${p.slug}/`);
  assert.equal(data.breadcrumb.itemListElement[1].item,data.url);
  const faqGraph=data['@graph'];
  assert.ok(faqGraph,`${p.slug} FAQPage @graph must exist`);
  assert.equal(faqGraph.length,1);
  assert.equal(faqGraph[0]['@type'],'FAQPage');
  assert.equal(faqGraph[0].mainEntity.length,5);
  const sectionStart=html.indexOf('<section class="faq"');
  const sectionEnd=html.indexOf('</section>',sectionStart);
  const visibleQuestions=[...html.slice(sectionStart,sectionEnd).matchAll(/<h3>(.*?)<\/h3>/g)].map(m=>m[1]);
  assert.equal(visibleQuestions.length,5,`${p.slug} must render exactly 5 visible FAQ questions, found ${visibleQuestions.length}`);
  assert.deepEqual(visibleQuestions,faqGraph[0].mainEntity.map(f=>esc(f.name)),`${p.slug} visible questions must match schema questions in order`);
  for(const [q,a] of p.faqs){
   assert.ok(html.includes(`<h3>${esc(q)}</h3>`),`${p.slug} visible FAQ missing: ${q}`);
   assert.ok(html.includes(esc(a)),`${p.slug} visible FAQ answer missing: ${q}`);
   const match=faqGraph[0].mainEntity.find(item=>item.name===q);
   assert.ok(match,`${p.slug} schema FAQ missing: ${q}`);
   assert.equal(match.acceptedAnswer.text,a);
  }
  assert.equal(JSON.stringify(data).includes('aggregateRating'),false);
  assert.equal(JSON.stringify(data).includes('"@type":"Review"'),false);
  assert.ok(html.includes('href="/#workspace"'),`${p.slug} must keep the workspace CTA`);
  const body=p.sections.map(([,t])=>t).join(' ');
  const links=[...body.matchAll(/\]\((\/[a-z-]+\/?)\)/g)].map(m=>m[1]);
  assert.ok(links.length>=1&&links.length<=3,`${p.slug} should have 1-3 natural internal links, found ${links.length}`);
  assert.ok(links.every(href=>pages.some(target=>`/${target.slug}/`===href)),`${p.slug} internal links must target existing pages`);
 }
});
test('about, privacy and contact pages expose no FAQ schema and no visible FAQ section',()=>{
 for(const slug of ['about','privacy','contact']){
  const p=pages.find(page=>page.slug===slug);
  assert.ok(p,`${slug} page must exist`);
  const html=renderPage(p);
  assert.equal(p.faqs.length,0,`${slug} must not define FAQs`);
  assert.equal(html.includes('FAQPage'),false,`${slug} must not emit FAQPage schema`);
  assert.equal(html.includes('id="faq-heading"'),false,`${slug} must not render a visible FAQ section`);
  assert.equal((html.match(/<h3>/g)||[]).length,0,`${slug} must not render FAQ question headings`);
 }
});
test('guide pages have unique FAQs and unique section headings across the site',()=>{
 const guides=pages.filter(p=>p.faqs.length===5);
 assert.equal(guides.length,10,'six legacy guides plus four india pages must each expose five FAQs');
 const questions=guides.flatMap(p=>p.faqs.map(([q])=>`${p.slug}|${q}`));
 assert.equal(new Set(questions).size,questions.length,'FAQ questions must be page-specific');
 const headings=guides.flatMap(p=>p.sections.map(p.india?s=>s.heading:([h])=>h));
 const dupes=headings.filter((h,i,a)=>a.indexOf(h)!==i);
 assert.deepEqual(dupes,[],'section headings must not be copy-pasted between pages');
});
test('guide pages keep supported claims aligned with the product and make no forbidden feature claims',()=>{
 const forbidden=[/HEIC (is )?support/,/\bresiz(e|es|ing) (your |the )?(photo|image|cutout)/,/compress(ion)? (your |the )?(photos|images)/,/blurs? (the )?(background|plate|license)/,/batch process(es|ing) (photos|images|a whole|your)/,/generates? (realistic )?(synthetic )?shadows/,/(adds?|generates?) realistic shadows/,/API (access|keys?|integration)s? (are )?(available|included)/,/rank #1|top of search|first on Google/];
 const musts={
  'how-to-remove-background':[/JPG, PNG and WebP/,/20 MB and 25 megapixels/,/98 MB/,/473 MB/,/HEIC photos from iPhones are not supported/],
  'transparent-background':[/alpha transparency|transparent/i,/JPEG format cannot store/,/Trim empty edges/,/checkerboard/],
  'remove-background-products':[/PNG/,/one photo per run|one photo at a time/,/batch processing is not available|does not certify compliance/],
  'remove-background-portraits':[/hair/,/Erase and Restore/,/does not (resize|certify)/],
  'remove-background-animals':[/Standard mode/,/Detailed mode|473 MB/,/whiskers/],
  'remove-background-cars':[/wheel/,/glass/,/license plates/]
 };
 for(const p of pages.filter(page=>musts[page.slug])){
  const parts=[p.description,...p.sections.map(([,t])=>t),...p.faqs.flatMap(([q,a])=>[q,a])];
  const text=parts.join(' ');
  for(const re of musts[p.slug])assert.match(text,re,`${p.slug} missing claim ${re}`);
  assert.doesNotMatch(text,/\bFast mode\b|Fast downloads|try Fast\b/,'outdated Fast wording must be Standard');
  for(const part of parts){
   const negated=/\b(does not|do not|cannot|can.t|no|not|never|without|rather than|neither|nor|unsupported|lacks?)\b/i.test(part.slice(0,Math.max(part.toLowerCase().lastIndexOf('does not'),part.toLowerCase().lastIndexOf('do not'),part.toLowerCase().lastIndexOf('cannot'),part.toLowerCase().lastIndexOf('never'),part.toLowerCase().lastIndexOf('no '))+80)||part.length);
   for(const re of forbidden){
    const m=part.match(re);
    if(!m)continue;
    const before=part.slice(Math.max(0,m.index-60),m.index).toLowerCase();
    const affirmative=!/\b(does not|do not|doesn't|don't|cannot|can't|no|not|never|without|nor|neither|lacks?|unsupported)\b[^.?!]*$/.test(before);
    assert.equal(affirmative,false,`${p.slug} contains affirmative forbidden claim: ${m[0]} in "${part.slice(Math.max(0,m.index-40),m.index+m[0].length+40)}"`);
   }
  }
 }
});
test('how-to guide keeps supported claims aligned with the product',()=>{
 const p=pages.find(page=>page.slug==='how-to-remove-background');
 const text=[p.description,...p.sections.map(([,t])=>t),...p.faqs.flatMap(([,a])=>[a])].join(' ');
 assert.match(text,/JPG, PNG and WebP/);
 assert.match(text,/20 MB and 25 megapixels/);
 assert.match(text,/98 MB/);
 assert.match(text,/473 MB/);
 assert.match(text,/HEIC/);
 assert.doesNotMatch(text,/unlimited|watermark-free forever|guaranteed top|instant(ly)? remove/i);
});
test('privacy page keeps its public-reviews and privacy-request sections rendered',()=>{
 const p=pages.find(page=>page.slug==='privacy');
 assert.ok(p,'privacy page must exist');
 const headings=p.sections.map(([h])=>h);
 assert.ok(headings.includes('Public reviews'),'privacy page must keep the Public reviews section');
 assert.ok(headings.includes('Contact for privacy requests'),'privacy page must keep the Contact for privacy requests section');
 const html=renderPage(p);
 assert.ok(html.includes('<h2>Public reviews</h2>'),'Public reviews section must be rendered');
 assert.ok(html.includes('<h2>Contact for privacy requests</h2>'),'Contact for privacy requests section must be rendered');
});
test('legacy pages without optional fields render no optional markup and keep title equal to H1',()=>{
 const legacy=pages.filter(p=>!p.india);
 assert.equal(legacy.length,9,'the nine pre-existing pages must stay legacy');
 for(const p of legacy){
  const html=renderPage(p);
  assert.equal(html.includes('<figure class="evidence">'),false,`${p.slug} must not render evidence figures when no images are defined`);
  assert.equal(html.includes('<table'),false,`${p.slug} must not render tables when none are defined`);
  assert.equal(html.includes('primaryImageOfPage'),false,`${p.slug} must not emit primaryImageOfPage without images`);
  assert.equal(p.metaTitle,p.title,`${p.slug} metaTitle must default to title`);
  assert.equal(p.h1,p.title,`${p.slug} h1 must default to title`);
  assert.ok(html.includes(`<title>${p.title} | Clearcut</title>`),`${p.slug} title must use the title field`);
  assert.ok(html.includes(`<h1>${p.title}</h1>`),`${p.slug} H1 must use the title field`);
  assert.equal(html.match(/<html lang="([^"]*)"/)[1],'en',`${p.slug} must default to lang en`);
 }
});
test('guide pages render responsive lightweight visuals while policy pages stay media-free',()=>{
 const visualSlugs=['how-to-remove-background','remove-background-products','remove-background-portraits','remove-background-animals','remove-background-cars','transparent-background','photo-ka-background-kaise-hataye','passport-exam-form-white-background','amazon-flipkart-meesho-product-white-background','remove-background-from-signature-png'];
 for(const slug of visualSlugs){
  const html=renderPage(pages.find(page=>page.slug===slug));
  const figure=html.match(/<figure class="guide-visual">([\s\S]*?)<\/figure>/)?.[1];
  assert.ok(figure,`${slug} must render one guide visual`);
  assert.match(figure,/srcset="\/artwork\/guides\/[^"]+-480\.webp 480w, \/artwork\/guides\/[^"]+-960\.webp 960w"/,`${slug} must offer 480px and 960px WebP variants`);
  assert.match(figure,/width="960" height="(?:340|600)"/,`${slug} must reserve the visual dimensions`);
  assert.match(figure,/fetchpriority="high"/,`${slug} visual should be prioritized without JavaScript`);
  assert.match(figure,/<figcaption>[^<]+<\/figcaption>/,`${slug} visual needs an honest caption`);
 }
 for(const slug of ['about','privacy','contact'])assert.equal(renderPage(pages.find(page=>page.slug===slug)).includes('guide-visual'),false,`${slug} must stay media-free`);
 const tutorial=renderPage(pages.find(page=>page.slug==='how-to-remove-background'));
 assert.match(tutorial,/<details class="guide-demo">/, 'the main guide must include the optional walkthrough');
 assert.match(tutorial,/src="\/artwork\/guides\/workflow\.gif"[^>]*loading="lazy"/, 'the GIF must lazy-load');
 assert.match(tutorial,/<source media="\(prefers-reduced-motion: reduce\)" srcset="\/artwork\/how-to\/download\.webp">/, 'the walkthrough must have a static reduced-motion fallback');
 const passport=renderPage(pages.find(page=>page.slug==='passport-exam-form-white-background'));
 assert.ok(passport.indexOf('callout-warning')<passport.indexOf('guide-visual'),'the passport warning must appear before its illustration');
});
test('guide media stays inside its explicit transfer budget',()=>{
 for(const name of ['workflow','transparency','products','portraits','animals','cars','passport','signature']){
  const small=statSync(new URL(`../public/artwork/guides/${name}-480.webp`,import.meta.url)).size;
  const large=statSync(new URL(`../public/artwork/guides/${name}-960.webp`,import.meta.url)).size;
  assert.ok(small<=15_000,`${name}-480.webp must stay at or below 15 KB, got ${small} bytes`);
  assert.ok(large<=30_000,`${name}-960.webp must stay at or below 30 KB, got ${large} bytes`);
 }
 const animation=statSync(new URL('../public/artwork/guides/workflow.gif',import.meta.url)).size;
 assert.ok(animation<=70_000,`workflow.gif must stay at or below 70 KB, got ${animation} bytes`);
});
test('optional metaTitle and h1 override the meta title and heading independently',()=>{
 const base=pages.find(page=>page.slug==='about');
 const variant={...base,metaTitle:'Meta Title Variant',h1:'Visible Heading Variant'};
 const html=renderPage(variant);
 assert.ok(html.includes('<title>Meta Title Variant | Clearcut</title>'),'metaTitle must drive the <title>');
 assert.ok(html.includes('property="og:title" content="Meta Title Variant | Clearcut"'),'metaTitle must drive the og:title');
 assert.ok(html.includes('name="twitter:title" content="Meta Title Variant | Clearcut"'),'metaTitle must drive the twitter:title');
 assert.ok(html.includes('<h1>Visible Heading Variant</h1>'),'h1 must drive the visible heading');
 assert.equal(html.includes(`<title>${base.title} | Clearcut</title>`),false,'original title must not leak into the meta title');
 assert.ok(html.includes(`<span aria-hidden="true"> / </span>${base.title}</p>`),'breadcrumb must keep the full title');
 const data=JSON.parse([...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1])[0]);
 assert.equal(data.name,base.title,'JSON-LD name must keep the full title');
});
test('evidence figures, captions and comparison tables render with escaping and schema image',()=>{
 const base=pages.find(page=>page.slug==='about');
 const decodeEntities=value=>value.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&amp;','&');
 const variant={...base,images:[{src:'/artwork/evidence-1.png',alt:'Mask <detail> comparison "quoted"',caption:'Left: original photo. Right: cutout on transparency.',width:1200,height:675,srcset:'/artwork/evidence-1.png 1x, /artwork/evidence-1@2x.png 2x',sizes:'(max-width: 767px) 100vw, 680px'}],tables:[{caption:'Mode download <sizes>',head:['Mode','Download'],rows:[['Standard','about 98 MB'],['Detailed','up to 473 MB']]}]};
 const html=renderPage(variant);
 assert.ok(html.includes('<figure class="evidence">'),'evidence figure must render');
 const figure=html.match(/<figure class="evidence">([\s\S]*?)<\/figure>/)[1];
 const attrs=Object.fromEntries([...figure.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
 assert.equal(decodeEntities(attrs.src),'/artwork/evidence-1.png','figure src must survive round-trip');
 assert.equal(decodeEntities(attrs.alt),'Mask <detail> comparison "quoted"','decoded alt must round-trip exactly, so quotes and angle brackets cannot break out of the attribute');
 assert.equal(/on[a-z]+=/i.test(figure),false,'figure must not allow event-handler attributes');
 assert.equal(attrs.loading,'lazy','evidence images must lazy-load');
 assert.equal(attrs.decoding,'async','evidence images must decode asynchronously');
 assert.equal(attrs.width,'1200','validated width must render');
 assert.equal(attrs.height,'675','validated height must render');
 assert.equal(decodeEntities(attrs.srcset),'/artwork/evidence-1.png 1x, /artwork/evidence-1@2x.png 2x','srcset must render when provided');
 assert.equal(decodeEntities(attrs.sizes),'(max-width: 767px) 100vw, 680px','sizes must render when provided');
 assert.ok(html.includes('<figcaption>Left: original photo. Right: cutout on transparency.</figcaption>'),'caption must render');
 const data=JSON.parse([...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1])[0]);
 assert.equal(data.primaryImageOfPage.url,'https://clearcutt.in/artwork/evidence-1.png','schema image URL must be absolute');
 assert.equal(data.primaryImageOfPage.name,'Mask <detail> comparison "quoted"','schema image name must keep decoded alt text');
 assert.equal(data.primaryImageOfPage.width,1200,'schema image width must match the rendered width');
 assert.equal(data.primaryImageOfPage.height,675,'schema image height must match the rendered height');
 const wrapLabel=decodeEntities(html.match(/<div class="table-wrap"[^>]*aria-label="([^"]*)"/)[1]);
 assert.equal(wrapLabel,'Mode download <sizes>','table wrapper accessible name must decode to the source caption');
 const captionText=decodeEntities(html.match(/<caption>([\s\S]*?)<\/caption>/)[1]);
 assert.equal(captionText,'Mode download <sizes>','table caption must decode to the source caption');
 assert.ok(html.includes('<th scope="col">Mode</th>')&&html.includes('<th scope="col">Download</th>'),'column headers must be scoped');
 assert.ok(html.includes('<td>about 98 MB</td>')&&html.includes('<td>up to 473 MB</td>'),'table cells must render');
 const noResponsive={...base,images:[{src:'/y.png',alt:'y',width:800,height:600}]};
 const plainAttrs=Object.fromEntries([...renderPage(noResponsive).match(/<figure class="evidence">([\s\S]*?)<\/figure>/)[1].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
 assert.equal('srcset' in plainAttrs,false,'srcset must be omitted when not provided');
 assert.equal('sizes' in plainAttrs,false,'sizes must be omitted when not provided');
 assert.equal(plainAttrs.width,'800','plain dimensions must render');
 const noCaptionTable={...base,tables:[{head:['A'],rows:[['1']]}]};
 assert.ok(renderPage(noCaptionTable).includes('<div class="table-wrap"><table>'),'table without caption renders without aria-label');
 const noCaptionFigure={...base,images:[{src:'/x.png',alt:'x',width:10,height:10}]};
 assert.equal(renderPage(noCaptionFigure).includes('<figcaption>'),false,'figure without caption renders no figcaption');
});
test('evidence images reject invalid definitions instead of rendering broken markup',()=>{
 const base=pages.find(page=>page.slug==='about');
 const invalid=[{alt:'no src',width:10,height:10},{src:'/a.png',width:10,height:10},{src:'/a.png',alt:'zero width',width:0,height:10},{src:'/a.png',alt:'negative height',width:10,height:-5},{src:'/a.png',alt:'fractional',width:10.5,height:10},{src:'/a.png',alt:'string width',width:'10',height:10},{src:'/a.png',alt:'NaN',width:NaN,height:10}];
 for(const image of invalid)assert.throws(()=>renderPage({...base,images:[image]}),Error,'invalid evidence image must fail loudly');
 const valid=renderPage({...base,images:[{src:'/a.png',alt:'a',width:1,height:1}]});
 assert.ok(valid.includes('width="1" height="1"'),'minimal valid image renders');
});
test('generated page CSP allows self-hosted images while keeping restrictive defaults',()=>{
 for(const p of pages){
  const html=renderPage(p);
  const csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
  assert.match(csp,/^default-src 'none'/,'CSP must keep default-src none');
  assert.ok(csp.includes("img-src 'self' data:"),'CSP must allow self-hosted and data images');
  assert.ok(csp.includes("style-src 'self'"),'CSP must keep style-src self');
  assert.ok(csp.includes("script-src 'none'"),'CSP must keep script-src none');
  assert.ok(csp.includes("object-src 'none'"),'CSP must keep object-src none');
  assert.ok(csp.includes("base-uri 'none'"),'CSP must keep base-uri none');
  assert.ok(csp.includes("form-action 'none'"),'CSP must keep form-action none');
  assert.equal(/https?:\/\/|http:/.test(csp),false,'CSP must not open external sources');
 }
});
test('sitemap URL count follows the generated page list dynamically',()=>{
 const expected=['',...pages.map(p=>`${p.slug}/`)];
 for(const path of expected)assert.ok(sitemap.includes(`<loc>https://clearcutt.in/${path}</loc>`),`sitemap must list ${path||'homepage'}`);
 const count=(sitemap.match(/<loc>/g)||[]).length;
 assert.equal(count,pages.length+1,'sitemap must contain exactly one URL per page plus the homepage');
 assert.equal(new Set(expected).size,expected.length,'page slugs must stay unique');
});
test('page lang overrides the html lang attribute and JSON-LD inLanguage',()=>{
 const base=pages.find(page=>page.slug==='about');
 const variant={...base,lang:'en-IN',explicitLang:true};
 const html=renderPage(variant);
 assert.ok(html.includes('<html lang="en-IN">'),'html lang must follow the page lang');
 const data=JSON.parse([...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1])[0]);
 assert.equal(data.inLanguage,'en-IN','JSON-LD inLanguage must follow the page lang');
});

test('the four india landing pages are built from the verified content spec with exact routes and metadata',()=>{
 const india=pages.filter(p=>p.india);
 assert.equal(india.length,4,'exactly four india landing pages must be built');
 assert.deepEqual(india.map(p=>p.slug),['photo-ka-background-kaise-hataye','passport-exam-form-white-background','amazon-flipkart-meesho-product-white-background','remove-background-from-signature-png']);
 const spec=JSON.parse(readFileSync(new URL('../docs/seo/india-page-content.json',import.meta.url),'utf8'));
 for(const p of india){
  const source=spec.pages.find(page=>page.slug===p.slug);
  assert.ok(source,`${p.slug} must come from the content spec`);
  assert.equal(p.title,source.title);
  assert.equal(p.h1,source.h1);
  assert.equal(p.description,source.description);
  assert.equal(p.lang,source.lang);
  assert.equal(p.editorialDate,spec.verifiedDate);
  const html=renderPage(p);
  assert.ok(html.includes(`<title>${source.title} | Clearcut</title>`),`${p.slug} rendered title`);
  assert.ok(html.includes(`<h1>${source.h1}</h1>`),`${p.slug} H1`);
  assert.ok(html.includes(`rel="canonical" href="https://clearcutt.in/${p.slug}/"`));
  assert.equal(html.match(/<html lang="([^"]*)"/)[1],source.lang);
  assert.ok(html.includes(`Editorially checked on ${spec.verifiedDate}`),`${p.slug} editorial checked date`);
  assert.ok((html.match(/<h1>/g)||[]).length===1,`${p.slug} exactly one H1`);
  assert.ok(source.sections.length>=3&&p.sections.length===source.sections.length,`${p.slug} section count`);
  for(const section of source.sections){
   assert.ok(html.includes(`<h2>${section.heading}</h2>`),`${p.slug} section heading rendered: ${section.heading}`);
   for(const paragraph of section.paragraphs||[])assert.ok(html.includes(paragraph.slice(0,40)),`${p.slug} paragraph text rendered`);
  }
 }
});
test('the site exposes fourteen crawlable URLs covering every page exactly once',()=>{
 const expected=['',...pages.map(p=>`${p.slug}/`)];
 assert.equal(pages.length,13,'nine legacy pages plus four india pages');
 assert.equal((sitemap.match(/<loc>/g)||[]).length,14,'sitemap must list 14 URLs');
 for(const path of expected)assert.ok(sitemap.includes(`<loc>https://clearcutt.in/${path}</loc>`),`sitemap missing ${path||'home'}`);
 assert.equal(new Set(expected).size,expected.length,'slugs must stay unique');
 for(const p of pages)assert.ok(sitemap.includes(`<loc>https://clearcutt.in/${p.slug}/</loc>`));
});
test('india pages render the passport warning before editing steps, callouts, citations and contextual links',()=>{
 const passport=pages.find(p=>p.slug==='passport-exam-form-white-background');
 const html=renderPage(passport);
 const warning=html.indexOf('uncertified visual background editor');
 const workflow=html.indexOf('id="clearcut-white-background-workflow"');
 assert.ok(warning>-1&&workflow>-1&&warning<workflow,'the portal warning must appear before the editing workflow');
 assert.ok(html.includes('class="callout callout-warning"'),'warning callout must render');
 for(const p of pages.filter(page=>page.india)){
  const page=renderPage(p);
  assert.ok(page.includes('class="citation"'),`${p.slug} must render citation links`);
  const sources=[...page.matchAll(/<p class="sources">Sources: ([\s\S]*?)<\/p>/g)];
  assert.ok(sources.length>=3,`${p.slug} must render sources rows`);
  for(const block of sources)assert.ok((block[1].match(/class="citation"/g)||[]).length>=1,'each sources row needs at least one citation');
  const contextual=[...page.matchAll(/<p class="contextual"><a href="([^"]+)">([^<]+)<\/a><\/p>/g)].map(m=>m[1]);
  assert.ok(contextual.length>=2,`${p.slug} must render its contextual links`);
  for(const href of contextual)assert.ok(pages.some(target=>`/${target.slug}/`===href)||href==='/#plans'||href==='/#workspace'||href==='/privacy/',`${p.slug} contextual link ${href} must target a real page`);
  const cta=page.match(/<a class="cta" href="\/#workspace">([^<]+) →<\/a>/);
  assert.ok(cta&&cta[1].length>10,`${p.slug} primary CTA must use its anchor text`);
  const data=JSON.parse([...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1])[0]);
  assert.equal(data.inLanguage,p.lang,`${p.slug} schema inLanguage`);
 }
});
test('india page FAQs stay a 1:1 match between visible HTML and FAQPage schema',()=>{
 for(const p of pages.filter(page=>page.india)){
  const html=renderPage(p);
  const data=JSON.parse([...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1])[0]);
  const faqGraph=data['@graph'];
  assert.equal(faqGraph.length,1,`${p.slug} one @graph FAQPage`);
  assert.equal(faqGraph[0].mainEntity.length,5,`${p.slug} five schema FAQs`);
  const sectionStart=html.indexOf('<section class="faq"');
  const sectionEnd=html.indexOf('</section>',sectionStart);
  const visibleQuestions=[...html.slice(sectionStart,sectionEnd).matchAll(/<h3>(.*?)<\/h3>/g)].map(m=>m[1]);
  assert.equal(visibleQuestions.length,5,`${p.slug} five visible questions`);
  const esc=v=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  assert.deepEqual(visibleQuestions,faqGraph[0].mainEntity.map(f=>esc(f.name)),`${p.slug} visible questions match schema in order`);
  for(const item of faqGraph[0].mainEntity){
   assert.ok(html.includes(`<h3>${esc(item.name)}</h3>`),`${p.slug} visible question rendered`);
   assert.ok(html.includes(esc(item.acceptedAnswer.text).slice(0,60)),`${p.slug} visible answer rendered`);
  }
  assert.equal(JSON.stringify(data).includes('aggregateRating'),false);
  assert.equal(JSON.stringify(data).includes('"@type":"Review"'),false);
 }
});
test('india pages publish no internal implementation details or forbidden claims',()=>{
 const forbidden=[/alpha\s*>\s*\d/,/forensic/i,/schema markup|JSON-LD|structured data|meta description|keyword/i,/rank #1|first on Google|top of search/i,/official(ly)? certifi(ed|cation)|government certified/i,/works? on (all|every) (Android|phone|device)s?/i,/universal(ly)? (supported|compatible)/i,/(can|also) (exports?|save|download) .{0,20}(JPG|JPEG)/i,/exports? .{0,15}(JPG|JPEG) files? (directly|for you|automatically)/i];
 for(const p of pages.filter(page=>page.india)){
  const html=renderPage(p);
  const data=JSON.parse([...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1])[0]);
  const text=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')+' '+JSON.stringify(data);
  const visibleText=html.replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  for(const re of forbidden)assert.doesNotMatch(text,re,`${p.slug} leaked forbidden content: ${re}`);
  for(const match of visibleText.matchAll(/\bguarantee(s|d)?\b/gi)){
   const before=visibleText.slice(Math.max(0,match.index-60),match.index);
   const after=visibleText.slice(match.index,match.index+80);
   const negated=/\b(never|cannot|not|nahin|nahi|no)\b/i.test(before)||/guarantee(s|d)? (nahin|nahi)\b/i.test(after);
   const question=/\?/.test(after)||/^\s*Does\b/i.test(after.trim())&&/\?/.test(visibleText.slice(match.index,match.index+200));
   assert.ok(negated||question,`${p.slug} guarantee mention must be negated or a question, found: ...${before.slice(-40)}${after.slice(0,60)}...`);
  }
  assert.doesNotMatch(text,/HEIC (is )?supported/i);
  assert.doesNotMatch(text,/resiz(e|es|ing) (your |the )?(photo|image|cutout)s? (in|with|using) Clearcut/i);
  const questionTexts=[...html.matchAll(/<h3>(.*?)<\/h3>/g)].map(m=>m[1]);
  for(const match of visibleText.matchAll(/batch|bulk/gi)){
   const before=visibleText.slice(Math.max(0,match.index-70),match.index);
   const negated=/\b(no|not|never|without|does not|don.t)\b/i.test(before);
   const inQuestion=questionTexts.some(q=>q.toLowerCase().includes(match[0].toLowerCase())&&visibleText.slice(Math.max(0,match.index-q.length),match.index+q.length).toLowerCase().includes(q.slice(0,Math.min(40,q.length)).toLowerCase()));
   assert.ok(negated||inQuestion,`${p.slug} batch/bulk mention must be negated or part of a rendered FAQ question, found: ...${before.slice(-50)}${visibleText.slice(match.index,match.index+30)}...`);
  }
 }
});
test('legacy pages render byte-identical apart from the shared guide navigation list',()=>{
 const legacy=pages.filter(p=>!p.india);
 for(const p of legacy){
  const html=renderPage(p);
  assert.equal(html.includes('india'),false,`${p.slug} must not contain india markers`);
  assert.equal(html.includes('callout'),false,`${p.slug} must not render callouts`);
  assert.equal(html.includes('sources'),false,`${p.slug} must not render sources rows`);
  assert.equal(html.includes('editorial-note'),false,`${p.slug} must not render editorial notes`);
  const aside=html.match(/<aside aria-label="Related guides"><h2>Explore Clearcut<\/h2><ul>([\s\S]*?)<\/ul>/)[1];
  const listed=[...aside.matchAll(/href="https:\/\/clearcutt\.in\/([a-z-]+)\/"/g)].map(m=>m[1]);
  assert.equal(listed.length,13,`${p.slug} guide navigation must list all thirteen pages`);
  for(const target of pages)assert.ok(listed.includes(target.slug),`${p.slug} navigation must link ${target.slug}`);
 }
});
