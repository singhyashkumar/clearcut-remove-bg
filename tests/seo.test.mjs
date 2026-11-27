import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { pages, enhanceHome, renderPage, robots, sitemap, schema } from '../scripts/seo.ts';
import { renderTransparentPage } from '../scripts/content/transparent-renderer.ts';
/** Guides that intentionally carry more than the default five FAQs. */
const expectedFaqs = slug => (slug === 'remove-background-cars' ? 7 : 5);
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
 assert.ok(html.includes('Cloudflare Web Analytics collects cookie-free page-performance measurements'),'homepage privacy answer must disclose the live Cloudflare performance beacon');
 assert.equal(html.includes('No image upload service, analytics, or image storage is used.'),false,'homepage must not claim that no analytics are used');
 assert.match(html,/<!--email_off--><a href="mailto:yxsingh2@gmail\.com">Support<\/a><!--\/email_off-->/,'Cloudflare must not rewrite the homepage support link');
 assert.match(html,/<!--email_off--><a href="mailto:yxsingh2@gmail\.com\?subject=Private%20Clearcut%20feedback">Send private feedback instead<\/a><!--\/email_off-->/,'Cloudflare must not rewrite private-feedback links');
 assert.match(html,/class="migration-notice"/,'homepage must expose the dated remove.bg migration notice');
 assert.match(html,/href="\/remove-bg-shutting-down\/"/,'migration notice must link to the sourced explainer');
 assert.equal(html.includes('chatgpt.site'),false);
 assert.equal(schema['@graph'][0].name,'Clearcutt');assert.deepEqual(schema['@graph'][0].alternateName,['Clearcutt Remove BG','clearcutt.in']);
 assert.equal(schema['@graph'][2]['@type'],'FAQPage');assert.equal(schema['@graph'][2].mainEntity.length,4);
 assert.equal(schema['@graph'][3].offers.price,'0');assert.equal(JSON.stringify(schema).includes('aggregateRating'),false);
 assert.ok(html.includes('href="/favicon.ico"'));assert.ok(html.includes('href="/favicon-48.png"'));assert.ok(html.includes('href="/apple-touch-icon.png"'));
});
test('every generated page has production social metadata without fake ratings',()=>{
 for(const p of pages){const html=renderPage(p);const expectedSocial=p.slug==='remove-background-cars'?'https://clearcutt.in/artwork/guides/car-examples/car-example-01-silver-electric-crossover.jpg':'https://clearcutt.in/artwork/clearcut-social-card.png';assert.ok(html.includes(`property="og:url" content="https://clearcutt.in/${p.slug}/"`));assert.ok(html.includes(`property="og:image" content="${expectedSocial}"`));assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));assert.ok(html.includes('name="twitter:description"'));assert.ok(html.includes('href="/favicon.ico"'));assert.ok(html.includes('property="og:site_name" content="Clearcutt"'));assert.equal(/AggregateRating|"@type":"Review"/.test(html),false);}
});
test('all public HTML uses the Clearcutt brand spelling',()=>{
 const home=enhanceHome(readFileSync(new URL('../index.html',import.meta.url),'utf8'));
 assert.doesNotMatch(home,/\bClearcut\b/,'homepage must not use the retired one-t spelling');
 for(const p of pages)assert.doesNotMatch(renderPage(p),/\bClearcut\b/,`${p.slug} must not use the retired one-t spelling`);
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
   assert.equal(data['@type'],p.article?'Article':'WebPage',`${p.slug} root node must match its page type`);
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
   assert.equal(p.faqs.length,expectedFaqs(p.slug),`${p.slug} must expose exactly ${expectedFaqs(p.slug)} FAQs`);
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
   assert.equal(faqGraph[0].mainEntity.length,expectedFaqs(p.slug));
  const sectionStart=html.indexOf('<section class="faq"');
  const sectionEnd=html.indexOf('</section>',sectionStart);
  const visibleQuestions=[...html.slice(sectionStart,sectionEnd).matchAll(/<h3>(.*?)<\/h3>/g)].map(m=>m[1]);
   assert.equal(visibleQuestions.length,expectedFaqs(p.slug),`${p.slug} must render exactly ${expectedFaqs(p.slug)} visible FAQ questions, found ${visibleQuestions.length}`);
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
 const guides=pages.filter(p=>p.faqs.length===expectedFaqs(p.slug));
 assert.equal(guides.length,12,'six legacy guides, four India pages, the Hindi guide and migration explainer must expose their expected FAQ count');
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
test('privacy, authorship and editorial signals match the live implementation',()=>{
 const privacy=renderPage(pages.find(page=>page.slug==='privacy'));
 assert.match(privacy,/Cloudflare Web Analytics currently injects a cookie-free performance beacon/);
 assert.match(privacy,/page URL, referrer and browser performance measurements/);
 assert.match(privacy,/does not receive your selected photo, mask or edits/);
 assert.doesNotMatch(privacy,/security policy blocks/);
 assert.match(privacy,/<!--email_off-->yxsingh2@gmail\.com<!--\/email_off-->/,'Cloudflare must leave the privacy-request address readable');
 const contact=renderPage(pages.find(page=>page.slug==='contact'));
 assert.match(contact,/<!--email_off-->yxsingh2@gmail\.com<!--\/email_off-->/,'Cloudflare must leave the support address readable');
 assert.match(contact,/<!--email_off--><a href="mailto:yxsingh2@gmail\.com\?subject=Clearcutt%20feedback">Send private feedback<\/a><!--\/email_off-->/,'Cloudflare must leave the contact action clickable');
 const about=renderPage(pages.find(page=>page.slug==='about'));
 assert.match(about,/<section id="editorial-standards"><h2>Editorial standards<\/h2>/);
 assert.match(about,/reviewed at least every 90 days/);
 for(const p of pages){
  const html=renderPage(p);
  const data=JSON.parse([...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1])[0]);
  assert.equal(data.author.name,'Clearcutt',`${p.slug} schema author`);
  assert.equal(data.author.url,'https://clearcutt.in/',`${p.slug} author URL`);
  assert.equal(data.publisher['@id'],'https://clearcutt.in/#organization',`${p.slug} publisher identity`);
  assert.equal(data.dateModified,p.lastModified,`${p.slug} schema modification date`);
  if(p.isGuide){
   assert.match(html,new RegExp(`<time datetime="${p.lastModified}">`),`${p.slug} visible update date`);
   assert.match(html,/(?:Maintained by|लेखक) <a href="\/about\/#editorial-standards">Clearcutt<\/a>/,`${p.slug} visible authorship`);
  }else assert.equal(html.includes('class="page-meta"'),false,`${p.slug} policy page should not use the guide byline`);
 }
 const org=schema['@graph'].find(node=>node['@type']==='Organization');
 assert.ok(org.sameAs.includes('https://www.instagram.com/clearcutt.in/'),'Organization schema must identify the official Instagram account');
});
test('remove.bg migration explainer is factual, sourced and uses Article schema',()=>{
 const page=pages.find(item=>item.slug==='remove-bg-shutting-down');
 assert.ok(page,'time-sensitive migration explainer must be generated');
 const html=renderPage(page);
 assert.match(html,/https:\/\/www\.remove\.bg\/faq\//);
 assert.match(html,/https:\/\/www\.remove\.bg\/bg\/api\//);
 assert.match(html,/https:\/\/www\.canva\.com\/help\/background-remover\//);
 assert.match(html,/not affiliated with remove\.bg, Canva or Leonardo\.Ai/i);
 assert.match(html,/does not offer a public API/);
 const data=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
 assert.equal(data['@type'],'Article');
 assert.equal(data.datePublished,'2026-11-14');
 assert.equal(data.dateModified,'2026-11-20');
 assert.equal(data.author.name,'Clearcutt');
 assert.equal(data.mainEntityOfPage,'https://clearcutt.in/remove-bg-shutting-down/');
});
test('legacy pages without optional fields render no optional markup and keep title equal to H1',()=>{
 const legacy=pages.filter(p=>!p.india&&!p.article&&!['remove-background-cars','transparent-background'].includes(p.slug));
 assert.equal(legacy.length,7,'the seven remaining pages without optional fields must stay legacy');
 for(const p of legacy){
  const html=renderPage(p);
  assert.equal(html.includes('<figure class="evidence">'),false,`${p.slug} must not render evidence figures when no images are defined`);
  assert.equal(html.includes('<table'),false,`${p.slug} must not render tables when none are defined`);
  assert.equal(html.includes('primaryImageOfPage'),false,`${p.slug} must not emit primaryImageOfPage without images`);
  assert.equal(p.metaTitle,p.title,`${p.slug} metaTitle must default to title`);
  assert.equal(p.h1,p.title,`${p.slug} h1 must default to title`);
  assert.ok(html.includes(`<title>${p.title} | Clearcutt</title>`),`${p.slug} title must use the title field`);
  assert.ok(html.includes(`<h1>${p.title}</h1>`),`${p.slug} H1 must use the title field`);
  assert.equal(html.match(/<html lang="([^"]*)"/)[1],'en',`${p.slug} must default to lang en`);
 }
});
test('the transparent PNG guide targets the tool query and both guides keep their visuals',()=>{
 const html=renderPage(pages.find(page=>page.slug==='transparent-background'));
 assert.match(html,/<title>Free Transparent Background Maker \| Clearcutt<\/title>/);
 assert.match(html,/<h1>Make a Transparent PNG for Free<\/h1>/);
 assert.match(html,/<h2>How to make a transparent background PNG<\/h2><p><a href="\/#workspace">/);
 assert.match(html,/class="guide-comparison guide-comparison--transparency"/);
 assert.match(html,/href="\/seo\.css\?v=[a-f0-9]{12}"/);
 assert.match(html,/<source media="\(max-width: 767px\)" srcset="\/artwork\/guides\/transparency-960\.webp">/);
 const car=renderPage(pages.find(page=>page.slug==='remove-background-cars'));
 assert.doesNotMatch(car,/guide-comparison--cars/,'the car guide no longer uses the generic illustrated comparison');
 assert.doesNotMatch(car,/cars-960\.webp/,'the old illustrated comparison must not be referenced');
 assert.match(car,/href="\/seo\.css\?v=[a-f0-9]{12}"/);
});
test('the car guide renders the five supplied example images with responsive sources, dimensions and captions',()=>{
 const html=renderPage(pages.find(page=>page.slug==='remove-background-cars'));
 const galleryStart=html.indexOf('<section class="car-gallery"');
 const gallery=html.slice(galleryStart,html.indexOf('</section>',galleryStart));
 assert.ok(gallery.length>1000,'the car gallery must render as a section');
 assert.match(gallery,/<h2 id="car-gallery-heading">Car Background Removal Examples<\/h2>/);
 assert.match(gallery,/Explore vehicle images processed with Clearcutt’s Standard model\./);
 assert.match(gallery,/Inspect glass, mirrors, wheel gaps and fine edges in your own results before downloading/);
 const base='/artwork/guides/car-examples';
 const dims={'car-example-01-silver-electric-crossover':[1600,819],'car-example-02-black-sports-car':[1600,800],'car-example-03-futuristic-electric-sedan':[1600,800],'car-example-04-blue-coupe-rear-view':[1600,800],'car-example-05-offroad-suv-rocky-scene':[1536,1024]};
 const items=[...gallery.matchAll(/<li><figure class="car-gallery-item">([\s\S]*?)<\/figure><\/li>/g)].map(m=>m[1]);
 assert.equal(items.length,5,'all five supplied images must be present in the page HTML');
 for(const [index,item] of items.entries()){
  const name=Object.keys(dims)[index];
  const [width,height]=dims[name];
  assert.ok(item.includes(`${base}/${name}.jpg`),`image ${index+1} must reference its JPEG fallback`);
  assert.match(item,new RegExp(`<source type="image/webp" srcset="${base}/${name}-480\\.webp 480w, ${base}/${name}-960\\.webp 960w" sizes="`),`image ${index+1} must offer both WebP widths`);
  assert.match(item,/sizes="\(max-width: 767px\) calc\(100vw - 70px\), 736px"/,`image ${index+1} must declare full-column responsive sizes`);
  assert.match(item,new RegExp(`alt="[^"]{20,}" width="${width}" height="${height}"`),`image ${index+1} must declare intrinsic dimensions and descriptive alt text`);
  assert.match(item,/<figcaption>[^<]+<\/figcaption>/,`image ${index+1} needs a caption`);
  if(index===0)assert.match(item,/fetchpriority="high"/,'the first gallery image may carry fetch priority');
  else assert.match(item,/ loading="lazy"/,`image ${index+1} must lazy-load below the fold`);
 }
 assert.equal((gallery.match(/fetchpriority="high"/g)||[]).length,1,'exactly one gallery image may carry fetch priority');
 assert.ok(html.indexOf('<h2>Prepare the vehicle image</h2>')>galleryStart,'the gallery must appear before the detailed guide sections');
 assert.doesNotMatch(html,/guide-comparison--cars|AI-generated illustration/,'the generic illustrated comparison must be gone');
 // The gallery presents opaque JPEGs only, without accuracy claims.
 assert.doesNotMatch(gallery,/transparent|alpha|perfect|measured|guarantee/i,'gallery copy must stay honest about the opaque JPEGs');
 // No invented vehicle makes or models.
 assert.doesNotMatch(html,/Toyota|Ford|Chevrolet|BMW|Mercedes|Audi|Tesla|Hyundai|Kia|Mahindra|Suzuki|Honda|Nissan|Volkswagen|Porsche|Ferrari|Lamborghini/i,'examples must stay generic vehicle descriptions');
});
test('the car gallery shows one full-width image per row at every viewport width',()=>{
 const css=readFileSync(new URL('../public/seo.css',import.meta.url),'utf8');
 // Strictly one column: the grid declares a single track and no breakpoint
 // overrides it back to two or three columns.
 assert.match(css,/\.car-gallery-grid\{list-style:none;margin:20px 0 0;padding:0;display:grid;grid-template-columns:minmax\(0,1fr\);gap:16px\}/,'the gallery grid must be single-column by default');
 assert.doesNotMatch(css,/\.car-gallery-grid\{[^}]*repeat\(2/,'no two-column rule may remain');
 assert.doesNotMatch(css,/\.car-gallery-grid\{[^}]*repeat\(3/,'no three-column rule may remain');
 assert.doesNotMatch(css,/@media\(max-width:1023px\)\{\.car-gallery-grid/,'the tablet column override must be gone');
 assert.doesNotMatch(css,/@media\(max-width:767px\)\{\.car-gallery-grid\{[^}]*grid-template-columns/,'the mobile override must not change the column count');
 // Images scale naturally to the full gallery width; no fixed frame ratio,
 // no cropping, no stretching — the fifth image keeps its 3:2 ratio.
 const frame=css.match(/\.car-gallery-frame\{[^}]*\}/)?.[0];
 assert.ok(frame,'the dark frame rule must stay');
 assert.doesNotMatch(frame,/aspect-ratio/,'the fixed 2/1 frame ratio must be gone');
 assert.match(frame,/background:#0c0e0d/,'the dark frame must stay');
 assert.match(frame,/border-radius:14px/,'the rounded corners must stay');
 assert.match(frame,/padding:10px/,'the frame padding must stay');
 assert.match(css,/\.car-gallery-frame picture,\.car-gallery-frame img\{display:block;width:100%;height:auto\}/,'picture and img must scale full-width at natural height');
 const imgRule=css.match(/\.car-gallery-frame img\{[^}]*\}/)?.[0];
 assert.doesNotMatch(imgRule,/object-fit|max-height/,'no crop or clip may force the fifth image into another ratio');
 // Every gallery item spans the full available gallery width.
 assert.match(css,/\.car-gallery-item\{margin:0\}/);
 assert.doesNotMatch(css,/\.car-gallery-grid\{[^}]*max-width/,'the gallery must fill the existing content column without extra narrowing');
 // The rendered page must not reference the retired card sizes.
 const html=renderPage(pages.find(page=>page.slug==='remove-background-cars'));
 assert.doesNotMatch(html,/241px|calc\(50vw - 40px\)/,'the former three-column/two-column card widths must be gone');
 assert.equal((html.match(/sizes="\(max-width: 767px\) calc\(100vw - 70px\), 736px"/g)||[]).length,5,'all five images must carry the full-column sizes value');
});
test('the car guide exposes the silver crossover as primaryImageOfPage and in its social cards',()=>{
 const html=renderPage(pages.find(page=>page.slug==='remove-background-cars'));
 const data=JSON.parse([...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1])[0]);
 assert.deepEqual(data.primaryImageOfPage,{'@type':'ImageObject',url:'https://clearcutt.in/artwork/guides/car-examples/car-example-01-silver-electric-crossover.jpg',name:'Silver electric-style crossover viewed from the front three-quarter angle on a black background',width:1600,height:819});
 assert.match(html,/property="og:image" content="https:\/\/clearcutt\.in\/artwork\/guides\/car-examples\/car-example-01-silver-electric-crossover\.jpg"/);
 assert.match(html,/property="og:image:width" content="1600"/);
 assert.match(html,/property="og:image:height" content="819"/);
 assert.match(html,/property="og:image:alt" content="Silver electric-style crossover viewed from the front three-quarter angle on a black background"/);
 assert.match(html,/name="twitter:image" content="https:\/\/clearcutt\.in\/artwork\/guides\/car-examples\/car-example-01-silver-electric-crossover\.jpg"/);
 assert.ok(existsSync(new URL('../public/artwork/guides/car-examples/car-example-01-silver-electric-crossover.jpg',import.meta.url).pathname),'the primary image must exist in the tree that ships to the production build');
});
test('the transparent guide keeps the checkerboard and labels the car JPEG as opaque with its background included',()=>{
 const html=renderPage(pages.find(page=>page.slug==='transparent-background'));
 // The checkerboard comparison stays the page's primary transparency demonstration.
 assert.match(html,/class="guide-comparison guide-comparison--transparency"/);
 assert.match(html,/Illustration: a checkerboard represents transparency/);
 const checkerboardAt=html.indexOf('guide-comparison--transparency');
 const headingAt=html.indexOf('<h2>Transparent PNG vs. JPEG with a Fixed Background</h2>');
 assert.ok(headingAt>0,'the opaque-JPEG comparison section must render');
 assert.ok(html.indexOf('<h2>Why PNG and not JPG</h2>')<headingAt,'the comparison follows the PNG-vs-JPEG section');
 assert.ok(checkerboardAt<headingAt,'the checkerboard demonstration stays ahead of the supplementary example');
 const section=html.slice(headingAt,html.indexOf('</section>',headingAt));
 assert.match(section,/The vehicle image below is an opaque JPEG: its black background is baked into the image pixels\./);
 assert.match(section,/when you select Transparent in Clearcutt and download PNG, the file keeps genuinely transparent pixels/);
 assert.match(section,/car-example-01-silver-electric-crossover\.jpg/,'the supplementary figure must reference the supplied JPEG');
 assert.match(section,/car-example-01-silver-electric-crossover-480\.webp 480w, \/artwork\/guides\/car-examples\/car-example-01-silver-electric-crossover-960\.webp 960w/);
 assert.match(section,/alt="Opaque JPEG of a silver electric-style crossover with its black background baked into the image pixels"/);
 assert.match(section,/<img class="guide-visual-image" src="\/artwork\/guides\/car-examples\/car-example-01-silver-electric-crossover\.jpg"/,'the supplementary image must reuse the guide-visual-image class so it scales to the content column');
 assert.match(section,/width="1600" height="819" loading="lazy" decoding="async"/,'the intrinsic dimensions and lazy loading must stay on the img element');
 // The reused class is the one that sets display:block, width:100% and height:auto,
 // which keeps the 1600px image inside the content column without overflow.
 const comparisonCss=readFileSync(new URL('../public/seo.css',import.meta.url),'utf8');
 assert.match(comparisonCss,/\.guide-visual-image\{display:block;width:100%;height:auto/,'guide-visual-image must keep its full-width scaling rule');
 assert.match(section,/Opaque JPEG example: the black background is part of the image pixels\. It is not a transparent PNG and contains no alpha channel\./);
 // The transparent page must not be touched by the car-gallery redesign.
 assert.doesNotMatch(html,/car-gallery/,'the transparent page must stay free of gallery markup');
 assert.match(section,/sizes="\(max-width: 767px\) calc\(100vw - 48px\), 756px"/,'the supplementary figure keeps its own sizes value');
 // Neither guide may claim the supplied JPEGs are transparent.
 for(const slug of ['remove-background-cars','transparent-background']){
  const pageHtml=renderPage(pages.find(p=>p.slug===slug));
  assert.doesNotMatch(pageHtml,/transparent JPEG/i);
  assert.doesNotMatch(pageHtml,/(JPEG|JPG)[^<.]{0,40}is (a )?transparent/i);
 }
});
test('the typed transparent renderer stays byte-for-byte identical to the shared renderer',()=>{
 const p=pages.find(page=>page.slug==='transparent-background');
 const shared=renderPage(p);
 const linksHtml=pages.map(x=>`<li><a href="https://clearcutt.in/${x.slug}/">${x.title.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')}</a></li>`).join('');
 const typed=renderTransparentPage({linksHtml,lastModified:p.lastModified});
 assert.equal(typed,shared,'the typed renderer must reproduce the shared renderer byte for byte');
});
test('the car example assets ship in the repository and stay inside their photographic budget',()=>{
 const dir=new URL('../public/artwork/guides/car-examples/',import.meta.url);
 const names=['car-example-01-silver-electric-crossover','car-example-02-black-sports-car','car-example-03-futuristic-electric-sedan','car-example-04-blue-coupe-rear-view','car-example-05-offroad-suv-rocky-scene'];
 for(const name of names){
  const jpeg=readFileSync(new URL(`${name}.jpg`,dir));
  assert.equal(jpeg.subarray(0,3).toString('hex'),'ffd8ff',`${name}.jpg must be a real JPEG fallback`);
  const small=statSync(new URL(`${name}-480.webp`,dir)).size;
  const large=statSync(new URL(`${name}-960.webp`,dir)).size;
  assert.ok(small<=35_000,`${name}-480.webp must stay at or below 35 KB, got ${small} bytes`);
  assert.ok(large<=90_000,`${name}-960.webp must stay at or below 90 KB, got ${large} bytes`);
 }
 // Every car-examples URL referenced by either page must resolve to a real file.
 for(const slug of ['remove-background-cars','transparent-background']){
  const html=renderPage(pages.find(p=>p.slug===slug));
  for(const match of html.matchAll(/(?:src|srcset)="([^"]*car-examples[^"]*)"/g)){
   for(const candidate of match[1].split(',')){
    const file=candidate.trim().split(/\s+/)[0];
    if(!file)continue;
    assert.ok(existsSync(new URL(`../public${file}`,import.meta.url).pathname),`${file} must exist under public/`);
   }
  }
 }
});
test('guide pages render responsive lightweight visuals while policy pages stay media-free',()=>{
 // The car guide is covered by the dedicated gallery tests below; the transparent
 // guide's comparison plus the supplementary opaque-example figure are covered by
 // the dedicated tests below as well.
 const visualSlugs=['how-to-remove-background','remove-background-products','remove-background-portraits','remove-background-animals','transparent-background','photo-ka-background-kaise-hataye','passport-exam-form-white-background','amazon-flipkart-meesho-product-white-background','remove-background-from-signature-png'];
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
 assert.ok(html.includes('<title>Meta Title Variant | Clearcutt</title>'),'metaTitle must drive the <title>');
 assert.ok(html.includes('property="og:title" content="Meta Title Variant | Clearcutt"'),'metaTitle must drive the og:title');
 assert.ok(html.includes('name="twitter:title" content="Meta Title Variant | Clearcutt"'),'metaTitle must drive the twitter:title');
 assert.ok(html.includes('<h1>Visible Heading Variant</h1>'),'h1 must drive the visible heading');
 assert.equal(html.includes(`<title>${base.title} | Clearcutt</title>`),false,'original title must not leak into the meta title');
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
test('generated page CSP allows the Cloudflare beacon and same-origin RUM while keeping restrictive defaults',()=>{
 for(const p of pages){
  const html=renderPage(p);
  const csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
  assert.match(csp,/^default-src 'none'/,'CSP must keep default-src none');
  assert.ok(csp.includes("img-src 'self' data:"),'CSP must allow self-hosted and data images');
  assert.ok(csp.includes("style-src 'self'"),'CSP must keep style-src self');
  assert.ok(csp.includes("font-src 'self'"),'CSP must keep font-src self');
  assert.ok(csp.includes("script-src https://static.cloudflareinsights.com"),'CSP must allow the Cloudflare Web Analytics beacon host');
  assert.ok(csp.includes("connect-src 'self'"),'CSP must allow same-origin RUM delivery to /cdn-cgi/rum');
  assert.ok(csp.includes("object-src 'none'"),'CSP must keep object-src none');
  assert.ok(csp.includes("base-uri 'none'"),'CSP must keep base-uri none');
  assert.ok(csp.includes("form-action 'none'"),'CSP must keep form-action none');
  const scriptSources=csp.match(/script-src ([^;]*)/)[1].trim().split(/\s+/);
  assert.deepEqual(scriptSources,['https://static.cloudflareinsights.com'],'CSP script-src must allow the beacon host and nothing else');
  const connectSources=csp.match(/connect-src ([^;]*)/)[1].trim().split(/\s+/);
  assert.deepEqual(connectSources,["'self'"],'CSP connect-src must allow self and nothing else');
  assert.equal(csp.includes("'unsafe-inline'"),false,'CSP must not allow inline script or styles from any source');
  assert.equal(csp.includes("'unsafe-eval'"),false,'CSP must not allow eval');
  const external=[...new Set([...csp.matchAll(/https?:\/\/[^\s;]+/g)].map(m=>m[0]))];
  assert.deepEqual(external,['https://static.cloudflareinsights.com'],'CSP must open no external source other than the Cloudflare beacon host');
 }
});
test('homepage CSP allows the Cloudflare beacon while keeping every existing script, connect and framing source',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
 const directive=name=>csp.match(new RegExp(`${name} ([^;]*)`))[1].trim().split(/\s+/);
 const scriptSources=directive('script-src');
 assert.ok(scriptSources.includes('https://static.cloudflareinsights.com'),'homepage script-src must allow the Cloudflare Web Analytics beacon host');
 for(const source of ["'self'","blob:","https://checkout.razorpay.com","https://cdn.razorpay.com","https://apis.google.com","https://www.gstatic.com/firebasejs/13.0.0/","https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/","'wasm-unsafe-eval'"])
  assert.ok(scriptSources.includes(source),`homepage script-src must keep ${source}`);
 assert.equal(scriptSources.some(s=>s==='*'||/^https?:$/.test(s)||s.startsWith('*.')),false,'homepage script-src must not gain a broad wildcard or scheme source');
 const connectSources=directive('connect-src');
 assert.ok(connectSources.includes("'self'"),'homepage connect-src must keep self for same-origin RUM delivery');
 for(const source of ["blob:","https://asia-south1-clearcut-remove-bg.cloudfunctions.net","https://api.razorpay.com","https://identitytoolkit.googleapis.com","https://securetoken.googleapis.com","https://accounts.google.com","https://www.googleapis.com","https://huggingface.co","https://cdn.jsdelivr.net"])
  assert.ok(connectSources.includes(source),`homepage connect-src must keep ${source}`);
 for(const source of ["https://clearcut-remove-bg.firebaseapp.com","https://accounts.google.com","https://checkout.razorpay.com"])
  assert.ok(directive('frame-src').includes(source),`homepage frame-src must keep ${source}`);
 assert.match(csp,/^default-src 'self'/,'homepage must keep default-src self');
 assert.ok(/object-src 'none'/.test(csp),'homepage must keep object-src none');
 assert.ok(/base-uri 'none'/.test(csp),'homepage must keep base-uri none');
 assert.ok(csp.includes("form-action https://checkout.razorpay.com https://api.razorpay.com https://*.razorpay.com"),'homepage must keep the Razorpay form-action allowlist');
 assert.ok(csp.includes("worker-src 'self' blob:"),'homepage must keep worker-src self and blob');
});
test('sitemap URL count follows the generated page list dynamically',()=>{
 const expected=['',...pages.map(p=>`${p.slug}/`)];
 for(const path of expected)assert.ok(sitemap.includes(`<loc>https://clearcutt.in/${path}</loc>`),`sitemap must list ${path||'homepage'}`);
 const count=(sitemap.match(/<loc>/g)||[]).length;
 assert.equal(count,pages.length+1,'sitemap must contain exactly one URL per page plus the homepage');
 assert.equal(new Set(expected).size,expected.length,'page slugs must stay unique');
});
test('sitemap publishes one accurate ISO 8601 lastmod for every canonical URL',()=>{
 assert.ok(sitemap.includes('<loc>https://clearcutt.in/</loc><lastmod>2026-11-20T17:41:15Z</lastmod>'),'homepage lastmod must reflect the 20 November 2026 homepage change');
 const entries=[...sitemap.matchAll(/<url><loc>(https:\/\/clearcutt\.in\/[^<]*)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g)];
 assert.equal(entries.length,pages.length+1,'every sitemap URL must carry exactly one lastmod');
 const byPath=new Map(entries.map(([,loc,lastmod])=>[new URL(loc).pathname.replace(/\/$/,'')||'/',lastmod]));
 for(const [path,lastmod] of byPath)assert.match(lastmod,/^(?:\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)$/,`${path} lastmod must be ISO 8601 (date or UTC date-time), got ${lastmod}`);
 // URLs whose meaningful content changed in the 20 November 2026 accuracy update
 // (squash commit 507a76e, 2026-11-20T17:41:15Z) carry that actual UTC instant.
 for(const slug of ['remove-background-products','remove-background-portraits','privacy','passport-exam-form-white-background','amazon-flipkart-meesho-product-white-background','remove-background-from-signature-png','remove-bg-shutting-down']){
  assert.equal(byPath.get(`/${slug}`),'2026-11-20T17:41:15Z',`${slug} lastmod must be the 20 November 2026 update instant`);
 }
 assert.equal(byPath.get('/about'),'2026-11-22T08:40:02Z','about lastmod must be the documentation-alignment instant');
 // Pages with no meaningful change keep their already accurate date-only values
 // and are never falsely marked as freshly updated.
 assert.equal(byPath.get('/how-to-remove-background'),'2026-11-14');
 assert.equal(byPath.get('/remove-background-animals'),'2026-11-14');
 assert.equal(byPath.get('/remove-background-cars'),'2026-11-27T16:36:00Z','the car guide lastmod must be the one-image-per-row gallery redesign instant');
 assert.equal(byPath.get('/photo-ka-background-kaise-hataye'),'2026-11-25T04:22:00Z','the Hinglish guide was content-corrected on 25 November 2026');
 assert.equal(byPath.get('/transparent-background'),'2026-11-27T15:32:00Z','the transparent guide keeps the 27 November 2026 opaque-example instant — the redesign touched only the car page');
 assert.equal(byPath.get('/photo-background-hindi'),'2026-11-25T04:22:00Z','the Hindi guide was content-corrected on 25 November 2026');
 assert.equal(byPath.get('/contact'),'2026-11-13');
 // Page metadata dates also reflect actual content updates.
 const expectedDates={'remove-background-products':'2026-11-20','remove-background-portraits':'2026-11-20','privacy':'2026-11-20','passport-exam-form-white-background':'2026-11-20','amazon-flipkart-meesho-product-white-background':'2026-11-20','remove-background-from-signature-png':'2026-11-20','remove-bg-shutting-down':'2026-11-20','about':'2026-11-22','transparent-background':'2026-11-27','photo-background-hindi':'2026-11-25','photo-ka-background-kaise-hataye':'2026-11-25','remove-background-cars':'2026-11-27','contact':'2026-11-13'};
 for(const [slug,date] of Object.entries(expectedDates))assert.equal(pages.find(p=>p.slug===slug).lastModified,date,`${slug} page lastModified must reflect its actual content update`);
 // The Hindi guide keeps its original publication date.
 assert.equal(pages.find(p=>p.slug==='photo-background-hindi').datePublished,'2026-11-20');
 // No entry may carry a build-time or future timestamp.
 for(const [,loc,lastmod] of entries)assert.ok(lastmod.slice(0,10)<='2026-11-27',`lastmod ${lastmod} for ${loc} must not be a build or future timestamp`);
});
test('sitemap URLs stay canonical and complete',()=>{
 const locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
 assert.equal(new Set(locs).size,locs.length,'sitemap URLs must be unique');
 for(const loc of locs){
  const url=new URL(loc);
  assert.equal(url.origin,'https://clearcutt.in',`sitemap URLs must be canonical absolute HTTPS URLs: ${loc}`);
  assert.equal(url.search,'',`sitemap URLs must not carry query strings: ${loc}`);
  assert.equal(url.hash,'',`sitemap URLs must not carry fragments: ${loc}`);
  assert.match(url.pathname,/\/$/,'non-homepage sitemap URLs must end with the trailing slash');
  assert.doesNotMatch(loc,/404\.html/,'sitemap must not list the noindex 404 page');
 }
 for(const p of pages)assert.ok(locs.includes(`https://clearcutt.in/${p.slug}/`),`${p.slug} must appear in the sitemap with its canonical URL`);
 assert.ok(locs.includes('https://clearcutt.in/'),'the homepage must appear in the sitemap');
});
test('generated robots.txt matches the source robots file and keeps crawler access intact',()=>{
 const source=readFileSync(new URL('../public/robots.txt',import.meta.url),'utf8');
 assert.equal(robots,source,'the generated robots.txt must be byte-identical to public/robots.txt');
 assert.match(robots,/Disallow: \/THIRD_PARTY_NOTICES\.md/,'the third-party notices file must be excluded from crawling');
 assert.match(robots,/User-agent: \*\nAllow: \//,'all crawlers including Bingbot must stay allowed on the site');
 assert.match(robots,/Sitemap: https:\/\/clearcutt\.in\/sitemap\.xml/,'robots.txt must keep declaring the sitemap');
});
test('product documentation accurately describes PNG and JPG output',()=>{
 const llms=readFileSync(new URL('../public/llms.txt',import.meta.url),'utf8');
 assert.match(llms,/PNG \(transparent\) or JPG \(opaque\) files without a watermark/,'llms.txt intro must describe both output formats');
 assert.match(llms,/maximum file size in KB/,'llms.txt must describe the JPG file-size limit');
 assert.match(llms,/exact pixel dimensions/,'llms.txt must describe the JPG dimension option');
 assert.match(llms,/JPG fills transparent areas with white/,'llms.txt must describe JPG opacity behaviour');
 assert.equal(/exports PNG files\b/.test(llms),false,'llms.txt must not claim PNG-only export');
 const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
 assert.match(readme,/transparent PNG or opaque JPG files without a watermark/,'README intro must describe both output formats');
 assert.match(readme,/maximum file size \(KB\) and exact pixel dimensions/,'README must describe the JPG download options');
 assert.equal(/PNG download without watermark/.test(readme),false,'README must not describe a PNG-only download');
 const about=renderPage(pages.find(p=>p.slug==='about'));
 assert.match(about,/PNG or JPG export without a watermark/,'About page must describe both output formats');
 assert.match(about,/maximum file size in KB or exact pixel dimensions/,'About page must describe the JPG download controls');
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
  assert.ok(html.includes(`<title>${source.title} | Clearcutt</title>`),`${p.slug} rendered title`);
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
test('the site exposes sixteen crawlable URLs covering every page exactly once',()=>{
 const expected=['',...pages.map(p=>`${p.slug}/`)];
 assert.equal(pages.length,15,'nine legacy pages, four India pages, the Hindi guide and the migration explainer');
 assert.equal((sitemap.match(/<loc>/g)||[]).length,16,'sitemap must list 16 URLs');
 for(const path of expected)assert.ok(sitemap.includes(`<loc>https://clearcutt.in/${path}</loc>`),`sitemap missing ${path||'home'}`);
 assert.equal(new Set(expected).size,expected.length,'slugs must stay unique');
 for(const p of pages)assert.ok(sitemap.includes(`<loc>https://clearcutt.in/${p.slug}/</loc>`));
});
test('the Devanagari and Hinglish guides retain independent canonicals and reciprocal alternates',()=>{
 const routes=[['hi','photo-background-hindi'],['hi-Latn','photo-ka-background-kaise-hataye']];
 for(const [language,slug] of routes){
  const html=renderPage(pages.find(p=>p.slug===slug));
  assert.ok(html.includes(`<html lang="${language}">`));
  assert.ok(html.includes(`rel="canonical" href="https://clearcutt.in/${slug}/"`));
  for(const [alt,altSlug] of routes)assert.ok(html.includes(`rel="alternate" hreflang="${alt}" href="https://clearcutt.in/${altSlug}/"`));
 }
 const hindi=renderPage(pages.find(p=>p.slug===routes[0][1]));
 assert.match(hindi,/<h1>फ़ोटो का बैकग्राउंड कैसे हटाएँ\?<\/h1>/);
 assert.match(hindi,/अक्सर पूछे जाने वाले सवाल/);
});
test('the Hindi and Hinglish guides accurately describe both PNG and JPG exports',()=>{
 const hindi=renderPage(pages.find(p=>p.slug==='photo-background-hindi'));
 const hinglish=renderPage(pages.find(p=>p.slug==='photo-ka-background-kaise-hataye'));
 for(const html of [hindi,hinglish]){
  assert.match(html,/Download JPG/,'both guides must name the JPG download');
  assert.match(html,/Download PNG/,'both guides must keep the PNG download');
 }
 // Hindi (Devanagari): both formats, JPG opacity with white fill, size and
 // dimension controls, white padding on differing aspect ratios.
 assert.match(hindi,/अपारदर्शी तस्वीर के लिए JPG सेव करें/,'meta description must describe the opaque JPG option');
 assert.match(hindi,/JPG पारदर्शी हिस्सों को सफ़ेद भर देता है/);
 assert.match(hindi,/अधिकतम फ़ाइल साइज़ \(KB\)/);
 assert.match(hindi,/सही चौड़ाई-ऊँचाई \(pixels\)/);
 assert.match(hindi,/सफ़ेद पैडिंग के साथ फिट होती है/);
 assert.match(hindi,/PNG में पारदर्शिता बनी रहती है/);
 // Hinglish: same facts in the romanised voice.
 assert.match(hinglish,/free transparent PNG ya opaque JPG banayein/,'meta description must describe both formats');
 assert.match(hinglish,/JPG opaque hota hai—transparent areas white fill hote hain/);
 assert.match(hinglish,/Limit JPG file size se maximum file size \(KB\)/);
 assert.match(hinglish,/Set JPG dimensions se exact width aur height \(pixels\)/);
 assert.match(hinglish,/aspect ratio alag hone par photo apne proportions mein white padding ke saath fit hoti hai/);
 assert.match(hinglish,/full-resolution PNG ya JPG file download karta hai/,'the format/limits paragraph must state both formats without an unconditional transparency label');
 assert.match(hinglish,/full-resolution PNG ya JPG file download karta hai[\s\S]{0,60}Transparent chuna hai toh PNG transparency rakhta hai/,'the conditional explanation must follow immediately in the format/limits paragraph');
 assert.doesNotMatch(hinglish,/full-resolution PNG \(transparent\)|PNG \(transparent\) ya JPG file/,'the misleading always-transparent PNG wording must never return to the format/limits paragraph');
});
test('the translated guides never claim PNG-only export or an external JPG converter',()=>{
 const hindi=renderPage(pages.find(p=>p.slug==='photo-background-hindi'));
 const hinglish=renderPage(pages.find(p=>p.slug==='photo-ka-background-kaise-hataye'));
 assert.doesNotMatch(hindi,/कन्वर्टर/,'the external-converter claim must be gone from the Hindi guide');
 assert.doesNotMatch(hindi,/PNG देता है\. अगर/,'the PNG-only claim must be gone from the Hindi guide');
 assert.doesNotMatch(hindi,/PNG ही रखें/);
 assert.doesNotMatch(hinglish,/alag resize|alag converter|kisi alag .*tool ka upyog/,'the external-converter claim must be gone from the Hinglish guide');
 assert.doesNotMatch(hinglish,/hamesha full-resolution PNG file/,'the PNG-only claim must be gone from the Hinglish guide');
 assert.doesNotMatch(hinglish,/PNG lene ke baad/);
 // Neither guide may promise official acceptance; the Hinglish correction
 // states the disclaimer explicitly.
 assert.match(hinglish,/acceptance guarantee nahi karta/);
 assert.match(hindi,/स्वीकृति की गारंटी नहीं देता/);
});
test('the Hinglish guide distinguishes the Transparent selection from other backgrounds and never labels PNG as always transparent',()=>{
 const hindi=renderPage(pages.find(p=>p.slug==='photo-background-hindi'));
 const hinglish=renderPage(pages.find(p=>p.slug==='photo-ka-background-kaise-hataye'));
 // Check each location individually: the workflow bullet, FAQ 1 and FAQ 5 must
 // EACH carry the conditional behaviour — PNG keeps transparency only for the
 // Transparent selection; a White, custom colour or background photo is
 // included in the PNG as-is; JPG is opaque with white fill.
 const bulletStart=hinglish.indexOf('<li>3. Check aur save karein:');
 assert.ok(bulletStart>-1,'the Hinglish workflow bullet 3 must be rendered');
 const bullet=hinglish.slice(bulletStart,hinglish.indexOf('</li>',bulletStart));
 const segment=(marker)=>{
  const start=hinglish.lastIndexOf(marker);
  assert.ok(start>-1,`the rendered FAQ must contain: ${marker}`);
  return hinglish.slice(start,hinglish.indexOf('</p>',start));
 };
 const locations=[
  ['workflow step 3',bullet],
  ['FAQ 1',segment('<h3>Clearcutt se photo ka background free mein kaise hataye?</h3>')],
  ['FAQ 5',segment('<h3>Background hatane ke baad safed colour ya doosri photo kaise lagayein?</h3>')]
 ];
 for(const clause of ['Transparent chuna hai toh PNG transparency rakhta hai','White, custom colour ya background photo chuna hai toh wahi background PNG mein aata hai','JPG opaque hota hai—transparent areas white fill hote hain'])
  for(const [label,text] of locations)
   assert.ok(text.includes(clause),`${label} must explain: ${clause}`);
 // Download buttons must never be labelled as unconditionally transparent.
 assert.doesNotMatch(hinglish,/'Download PNG' \(transparent\)|Download PNG \(transparent\)|result PNG \(transparent\)/,'PNG transparency depends on the selected background');
 assert.doesNotMatch(hindi,/Download PNG \(transparent\)|result PNG \(transparent\)/);
 // The Devanagari FAQ must offer both formats without payment or sign-in.
 assert.match(hindi,/बिना वॉटरमार्क PNG या JPG डाउनलोड करने के लिए भुगतान या साइन‑इन की ज़रूरत नहीं है/);
});
test('visible FAQ answers exactly match their FAQPage structured data on the translated guides',()=>{
 const unescape=value=>value.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&amp;','&');
 for(const slug of ['photo-background-hindi','photo-ka-background-kaise-hataye']){
  const html=renderPage(pages.find(p=>p.slug===slug));
  const data=JSON.parse([...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>m[1])[0]);
  const faqNode=data['@graph']?.find(node=>node['@type']==='FAQPage')??(data['@type']==='FAQPage'?data:null);
  assert.ok(faqNode,`${slug} must keep its FAQPage structured data`);
  const expected=faqNode.mainEntity.map(item=>[item.name,item.acceptedAnswer.text]);
  const visible=[...html.matchAll(/<h3>([^<]+)<\/h3><p>(.*?)<\/p>/g)].map(match=>[unescape(match[1]),unescape(match[2])]);
  assert.equal(visible.length,expected.length,`${slug} must render one visible answer per structured question`);
  assert.deepEqual(visible,expected,`${slug} visible FAQ content must stay synchronised with its structured data`);
 }
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
 const forbidden=[/alpha\s*>\s*\d/,/forensic/i,/schema markup|JSON-LD|structured data|meta description|keyword/i,/rank #1|first on Google|top of search/i,/official(ly)? certifi(ed|cation)|government certified/i,/works? on (all|every) (Android|phone|device)s?/i,/universal(ly)? (supported|compatible)/i,/exports? (?:PNG|raster PNG) files? only|exports? PNG only/i];
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
  assert.doesNotMatch(text,/resiz(e|es|ing) (your |the )?(photo|image|cutout)s? (in|with|using) Clearcutt/i);
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
 const legacy=pages.filter(p=>!p.india&&!p.article);
 for(const p of legacy){
  const html=renderPage(p);
  assert.equal(html.includes('india'),false,`${p.slug} must not contain india markers`);
  assert.equal(html.includes('callout'),false,`${p.slug} must not render callouts`);
  assert.equal(html.includes('class="sources"'),false,`${p.slug} must not render sources rows`);
  assert.equal(html.includes('editorial-note'),false,`${p.slug} must not render editorial notes`);
  const aside=html.match(/<aside aria-label="Related guides"><h2>Explore Clearcutt<\/h2><ul>([\s\S]*?)<\/ul>/)[1];
  const listed=[...aside.matchAll(/href="https:\/\/clearcutt\.in\/([a-z-]+)\/"/g)].map(m=>m[1]);
  assert.equal(listed.length,pages.length,`${p.slug} guide navigation must list every generated page`);
  for(const target of pages)assert.ok(listed.includes(target.slug),`${p.slug} navigation must link ${target.slug}`);
 }
});
