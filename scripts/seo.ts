import type { Plugin } from 'vite';
import type { EvidenceImage, EvidenceTable, GuideFaq, GuideSection, LegacyGuideSource } from './content/types.ts';

type ContextualLink = { href: string; anchorText: string; placement: string };
type IndiaSection = {
 id: string;
 heading: string;
 callout?: { level: string; text: string };
 paragraphs?: string[];
 bullets?: string[];
 sourceIds?: string[];
 contextualLinks?: ContextualLink[];
};
type IndiaSource = {
 slug: string; canonicalUrl: string; title: string; description: string; h1: string; lang: string; lead: string;
 sections: IndiaSection[];
 contextualLinks?: ContextualLink[];
 faqs?: { question: string; answer: string }[];
};
type PageFields = {
 slug: string; title: string; description: string; metaTitle: string; h1: string; lang: string;
 faqs: readonly GuideFaq[]; lastModified: string; explicitLang: boolean; isGuide: boolean;
 article?: boolean; datePublished?: string;
 images?: readonly EvidenceImage[]; tables?: readonly EvidenceTable[];
 primaryImage?: EvidenceImage;
};
type Page = PageFields & (
 { india?: false; sections: readonly GuideSection[] } |
 { india: true; sections: readonly IndiaSection[]; lead: string; indiaBody: string; editorialDate: string; indiaCta: string }
);
type GuideMedia = { name: string; width: number; height: number; alt: string; caption: string; afterFirstSection?: boolean };

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { carPage } from './content/car-page.ts';
import { transparentPage } from './content/transparent-page.ts';
import { renderTransparentPage } from './content/transparent-renderer.ts';
import { renderGuideComparison } from './content/guide-comparison.ts';
import { renderCarGallery, renderOpaqueExampleSection, carPrimaryImage } from './content/car-examples.ts';
import { comparisonStylesheet } from './content/guide-styles.ts';
import { hindiDescription, hindiFaqs, hindiSections, hindiSlug, hindiTitle, hinglishSlug } from './content/hindi-page.ts';
const site = 'https://clearcutt.in/';
const githubProfile = 'https://github.com/singhyashkumar/clearcut-remove-bg';
const instagramProfile = 'https://www.instagram.com/clearcutt.in/';
const releaseDate = '2026-11-14';
// Content-update bookkeeping: dates must reflect when a page's meaningful content
// actually changed, never the build time or the current date.
// - contentUpdate*: the 20 November 2026 accuracy update (squash commit 507a76e,
//   committed 2026-11-20T17:41:15Z): JPG-export documentation, refreshed Amazon/
//   Flipkart/Meesho sourcing, the About contact section and the homepage brand
//   correction.
// - docsUpdate*: this documentation-alignment change set (About export wording).
const contentUpdateDate = '2026-11-20';
const contentUpdateInstant = '2026-11-20T17:41:15Z';
const docsUpdateDate = '2026-11-22';
const docsUpdateInstant = '2026-11-22T08:40:02Z';
// 25 November 2026 JPG-export accuracy correction: the Hindi and Hinglish guides
// only (commit instant pinned in the sitemap below).
const contentCorrectionDate = '2026-11-25';
const contentCorrectionInstant = '2026-11-25T04:22:00Z';
// 27 November 2026 visual update: the car guide gained a gallery of genuine
// owner-supplied car examples and the transparent guide gained the opaque-JPEG
// comparison (commit instant pinned in the sitemap below).
const visualUpdateDate = '2026-11-27';
const visualUpdateInstant = '2026-11-27T15:32:00Z';
const pageDates: Record<string, string> = {
 'remove-background-products': contentUpdateDate,
 'remove-background-portraits': contentUpdateDate,
 about: docsUpdateDate,
 privacy: contentUpdateDate,
 contact: '2026-11-13',
 'remove-background-cars': visualUpdateDate,
 'transparent-background': visualUpdateDate,
};
const policySlugs = new Set(['about', 'privacy', 'contact']);
const socialImage = `${site}artwork/clearcut-social-card.png`;
const faviconLinks = '<link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48"><link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">';
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const md = (value: string) => escape(value).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,'<a href="$2">$1</a>');
const protectEmails = (html: string) => html.replace(/<a href="mailto:[^"]+"[^>]*>.*?<\/a>|yxsingh2@gmail\.com/g, match => `<!--email_off-->${match}<!--/email_off-->`);
const legacySources: readonly LegacyGuideSource[] = [
 ['how-to-remove-background','How to Remove an Image Background for Free','Learn to remove backgrounds, refine edges and export transparent PNGs with Clearcutt.',[
 ['The short answer','Clearcutt removes a photo background directly in your browser at no cost. Open the editor in desktop Chrome or Edge, select, drop or paste a JPG, PNG or WebP photo, and the AI model runs on your device. Compare the result with your original, correct the edges with the Erase and Restore brushes, then download a PNG without a watermark. No installation is needed, and background removal works without signing in.'],
 ['Step 1 — Choose your photo','Open the editor and select, drop or paste a JPG, PNG or WebP. The limit is 20 MB and 25 megapixels, and a sharp image with a clearly visible subject is easier to inspect and refine. If you want to try the workflow before using one of your own photos, load the sample photo in the editor first.'],
 ['Step 2 — Run the model on your device','Standard mode downloads about 98 MB on first use; Detailed mode can download up to 473 MB. Browser caching can help later runs, but files can be cleared or evicted. Keep the tab open and allow time for your device to finish. Your photo is processed in the browser.'],
 ['Step 3 — Refine and check the edges','Compare Original and Result to see where the mask went wrong. Use Erase and Restore with the circular brush cursor to correct it: Erase removes leftover background, and Restore brings back missing parts of the subject. A smaller brush gives you more control around hair, product edges and small gaps.'],
 ['Step 4 — Pick a background and download','Keep the checkerboard for transparency, choose a solid color, or add a background photo. Trim empty edges if the cutout leaves unused canvas around the subject, then download the PNG before closing the tab. The export keeps your photo’s dimensions and does not add a watermark. If you need an alpha-transparent file, the [transparent background guide](/transparent-background/) explains how PNG transparency behaves in other apps.'],
 ['What to expect and current limits','The editor handles one photo at a time, and batch processing and a public API are not available. HEIC photos from iPhones are not supported, and desktop Chrome or Edge is recommended. Both AI models compute the mask at 512 pixels internally, so very fine edge detail can still need brush work even though the export keeps the original dimensions. For subject-specific advice, see the [product photo](/remove-background-products/) and [portrait](/remove-background-portraits/) guides.']],
 [['Do I need to install software or create an account?','No. Clearcutt runs in a desktop browser, and background removal works without signing in. A Google account is only used for optional features such as publishing a review or managing a Plus membership.'],
 ['Why is the first background removal slower?','The first run downloads an AI model to your browser: roughly 98 MB in Standard mode and up to roughly 473 MB in Detailed mode. Later runs can reuse the cached model files, although the browser can clear or evict that cache.'],
 ['Which files can I use with Clearcutt?','JPG, PNG and WebP images up to 20 MB and 25 megapixels. HEIC photos from iPhones are not supported in the current release, and iOS browsers are not supported.'],
 ['Are my photos uploaded to a server?','No. The photo, the mask and your edits stay in browser memory on your device and are not uploaded to Clearcutt’s payment backend. Model files are downloaded from Hugging Face and its content delivery network.'],
 ['Can I process several photos at once?','Not currently. The editor works on one photo per run, and batch processing is not available today.']]],
 ['remove-background-products','Remove Product Photo Backgrounds for Free','Create product cutouts and white-background listing images with Clearcutt’s private browser editor.',[
 ['Cut out a product in your browser','Photograph one product, upload the JPG, PNG or WebP to Clearcutt, and let the model run on your device. Check the cutout with Original and Result, clean the mask with Erase and Restore, then choose white or transparency and download a PNG at full output size without a watermark. Your product photos are never uploaded to a server.'],
 ['Prepare a clear product photo','Photograph one product in even lighting with space around its edges. A plain contrasting backdrop helps you inspect the cutout. Sharp focus matters more than the camera: a crisp outline gives the model cleaner edges to find, and it makes your brush corrections easier to judge.'],
 ['White background or transparent PNG','Choose white for a consistent catalog appearance, or transparency for packaging and design layouts. Check your marketplace’s own listing rules: Clearcutt does not certify compliance. Export PNG to retain transparent areas. The [transparent background guide](/transparent-background/) explains how to verify alpha transparency in the exported file.'],
 ['Inspect the details','Check handles, cables, holes and reflective edges. Use Erase and Restore to clean the mask. Glass and shiny surfaces may retain background colors and need further editing. Zooming into the edges while comparing Original and Result is the fastest way to find leftover fragments or missing parts.'],
 ['Work through a catalog, one photo at a time','The editor handles one photo per run, so refresh the editor between products and download each PNG before starting the next. Batch processing is not available today, and there is no public API or marketplace integration. For the full tool-by-tool workflow, see the [background removal guide](/how-to-remove-background/).'],
 ['What Clearcutt does not do','Clearcutt does not generate realistic shadows or reflections, resize or compress images, or produce synthetic studio lighting. Keep the product’s real condition visible and follow your platform’s image rules. An honest listing photo serves you better than a polished but misleading one.']],
 [['Does Clearcutt make my product photos compliant with marketplace requirements?','No. Clearcutt removes and replaces backgrounds; it does not certify compliance with any marketplace’s listing rules. Always check the current requirements of the platform you sell on before uploading.'],
 ['Can I export a JPG for my product listings?','Yes. Choose Download JPG for an opaque photo or Download PNG to keep transparency. Both export without a watermark and preserve the photo dimensions unless Trim empty edges is enabled.'],
 ['Can I process a whole product catalog at once?','Not currently. The editor works on one photo per run and batch processing is not available today. There is no public API for automation either.'],
 ['Why does my glass or shiny product keep some of the old background?','Transparent and reflective surfaces confuse edge detection because the product literally shows the background. Use the Erase and Restore brushes to correct the mask; heavy reflections may need retouching in another editor.'],
 ['Does Clearcutt add product shadows for marketplace photos?','No. Clearcutt does not generate synthetic shadows or reflections. A neutral white or solid background keeps the listing consistent; anything more needs to be photographed or edited deliberately.']]],
 ['remove-background-portraits','Remove Portrait Backgrounds for Free','Cut out people, change a profile photo background and refine portrait edges locally with Clearcutt.',[
 ['The short answer for portraits','Open the editor in desktop Chrome or Edge, upload a sharp JPG, PNG or WebP portrait, and the model runs on your device. Refine the edge with Erase and Restore, then keep transparency, choose white or a custom color, and download a PNG at full output size without a watermark. Nothing is uploaded, which matters for photos of identifiable people.'],
 ['Start with a well-lit portrait','Choose a sharp photo with the person’s outline visible. Even lighting and a slight contrast between the person and the backdrop give the model cleaner edges to find. Use photos you own or have permission to edit, especially for pictures of other people.'],
 ['Refine hair, glasses and clothing','Hair, veils, glasses and clothing similar to the backdrop can need correction. Use a small Restore brush to recover the subject and Erase to remove remaining fragments. Work at a zoom level where you can see individual strands, and check the result against both light and dark backgrounds before saving.'],
 ['Choose the new background','Keep a transparent PNG for presentations, white for a clean profile look, or a custom color to match a brand. You can also place the cutout over a background photo. Choose PNG to preserve transparency or JPG for a solid background. The [transparent background guide](/transparent-background/) covers alpha checks in other apps.'],
 ['Understand the result','Clearcutt edits a subject mask; it does not retouch skin or reconstruct hair that was never visible in the photo. Both AI models use 512px internally. Full-size export preserves image dimensions but does not add native-resolution segmentation detail.'],
 ['Honest limits for official photos','Passport, visa and exam authorities typically specify exact dimensions, background shade and print requirements, and they generally expect an unedited, properly photographed original. Clearcutt does not resize images or certify any photo as compliant. Check the official requirements of the authority you are applying to before using any edited photo. For the general tool workflow, see the [background removal guide](/how-to-remove-background/).']],
 [['Are my portrait photos uploaded anywhere?','No. The photo, the mask and your edits stay in browser memory on your device. This is especially relevant for portraits of identifiable people: nothing is sent to Clearcutt’s payment backend.'],
 ['Can I use a Clearcutt cutout as a passport or ID photo?','Usually not. Authorities typically require unedited photos meeting exact size, background and print specifications. Clearcutt does not resize images or certify compliance. Follow the official requirements of the authority concerned.'],
 ['How do I fix hair that lost strands or gained background fragments?','Zoom in and use a small Restore brush to bring back missing strands and a small Erase brush to remove leftover background. Check the edge against both light and dark backgrounds, since a mask that looks fine on one can fail on the other.'],
 ['Why does my result look lower detail at the edges?','Both AI models compute the mask at 512 pixels internally. The export keeps your photo’s full dimensions, but it does not add native-resolution segmentation detail, so fine edges can still need brush work.'],
 ['Can I put my portrait on a custom background color or photo?','Yes. Keep the checkerboard for transparency, pick white or a custom color, or add a background photo in the editor. Download PNG to keep transparency or JPG for an opaque image. Both formats export without a watermark.']]],
 ['remove-background-animals','Remove Animal and Pet Photo Backgrounds','Make pet cutouts, inspect fur edges and save transparent animal PNGs with Clearcutt.',[
 ['The short answer for pet photos','Upload a sharp photo of your pet, let the model find the animal on your device, refine fur edges with the brushes, and download a transparent PNG at full output size and without a watermark. Desktop Chrome or Edge is recommended, and your photo stays on your device.'],
 ['Choose a clear animal photo','Start with a sharp photo where ears, paws and tail are visible. Contrast between fur and backdrop makes the edge easier to inspect. A pet that fills the frame with a plain background behind it gives the model the cleanest outline to work with.'],
 ['Standard or Detailed mode','Standard mode uses the original 98 MB model and is enough for most pet photos; Detailed mode can download up to 473 MB and can help with fine fur against a similar-colored backdrop. If your computer has limited memory or a slow connection, try Standard first and only switch to Detailed when the fur edges clearly need it.'],
 ['Refine fur and small gaps','Inspect whiskers, the spaces between legs and the tail. Erase leftover background and Restore missing parts of the animal with small brush strokes. Fine fur on a similar-colored backdrop may need another editor; perfect edge separation is not guaranteed.'],
 ['Export for a creative project','Keep transparency for a collage or invitation, or add a color or background photo. Your selected image stays on your device. The current editor handles one photo at a time. The [background removal guide](/how-to-remove-background/) walks through every tool if you are new to the editor.']],
 [['Is Clearcutt good with fur and whiskers?','Often, but not always. The model handles clear fur edges well, while fine fur against a similar-colored backdrop can need brush work. Whiskers and the gaps between legs are worth checking closely before you download.'],
 ['Which mode should I use for pet photos?','Start with Standard mode, the original 98 MB model, which is enough for most pets. Switch to Detailed mode, up to 473 MB, when fine fur against a similar-colored backdrop clearly needs more accuracy.'],
 ['Does the download have a watermark or reduced size?','No. The PNG downloads at full output size without a watermark. If you need to crop the empty canvas around the pet, use the Trim empty edges option before downloading.'],
 ['Can I make a cutout of my dog or cat for a print or invitation?','Yes. Keep the transparent background and place the PNG into your layout, or choose a solid color in the editor. The [transparent background guide](/transparent-background/) explains how to check the transparency in other apps.'],
 ['Does Clearcutt blur or replace the background behind my pet automatically?','No. Clearcutt removes the background and lets you choose the replacement yourself: transparency, a solid color, or a photo you add. It does not blur backgrounds or generate new ones.']]],
 carPage,
 transparentPage,
 ['about','About Clearcutt Remove BG','Learn what Clearcutt supports, how local image processing works, and what the free editor and Plus membership provide.',[
 ['An independent image editor','Clearcutt removes backgrounds in your browser with an open-source BG0/BiRefNet-based engine. The website is hosted through GitHub Pages and Cloudflare. Clearcutt is independent and is not affiliated with remove.bg or Canva.'],
 ['Where to find Clearcutt',`Browse the [Clearcutt source code on GitHub](${githubProfile}) or follow [@clearcutt.in on Instagram](${instagramProfile}) for tutorials and product updates.`],
 ['What works today','The editor supports JPG, PNG and WebP up to 20 MB and 25 megapixels, original/result comparison, Erase and Restore, background replacement, trimming and PNG or JPG export without a watermark. JPG downloads can target a maximum file size in KB or exact pixel dimensions, and JPG fills transparent areas with white. Desktop Chrome or Edge is recommended. iOS and HEIC are unsupported.'],
 ['Clear pricing and limitations','Processing currently works without sign-in. Plus is a one-time ₹90 payment for 30 days, renewed manually. The backend stores the account badge and expiry. Daily limits are guidance and are not enforced today; Plus does not yet unlock batch processing. Read the current pricing before paying. Demonstration artwork is original AI-generated artwork, not measured model output.'],
 ['Editorial standards','Clearcutt maintains its guides against the current editor and the sources cited on each page. Product claims are updated when behaviour changes, and dated India guidance is reviewed at least every 90 days or sooner when an official source changes. Illustrations and AI-generated artwork are labelled; measured benchmarks must publish their device, browser, model, input and date. Send factual corrections through the Contact page.']]],
 ['privacy','Clearcutt Privacy Policy','How Clearcutt handles local images, Google sign-in, reviews, payment references, model downloads and membership data.',[
 ['Photos and edits','Selected photos, masks and edits remain in browser memory; they are not uploaded to the payment backend. Clearing the editor or closing the tab discards the editing session. Downloads are stored where your browser saves files. Model files may remain in browser cache. Closing a tab is not a guarantee of forensic memory erasure.'],
 ['Accounts and payments','Firebase provides Google sign-in and can remember the login until you sign out or clear browser data. Cloudflare D1 stores the validated account ID, verified Google email, order and payment references, plan, expiry and webhook identifiers. These records restore membership and prevent duplicate payment processing. Razorpay hosts payment entry; Clearcutt does not store card numbers, CVVs, banking passwords or UPI credentials.'],
 ['Third-party connections and performance analytics','GitHub Pages and Cloudflare serve the website, Google/Firebase provide authentication, and Razorpay handles payments. Model requests go to Hugging Face and its CDNs; the runtime downloads from jsDelivr. Those providers receive ordinary network metadata, such as IP addresses and request headers. Cloudflare Web Analytics currently injects a cookie-free performance beacon. It sends the page URL, referrer and browser performance measurements such as loading, paint and layout-shift timings to Cloudflare; it does not receive your selected photo, mask or edits. Cloudflare states that the beacon does not use cookies or browser storage and that source IP addresses received during request handling are discarded at the nearest data centre rather than stored in its core analytics databases or logs.'],
 ['Retention and requests','Account and payment metadata currently remain in the backend; an automatic deletion schedule and self-service deletion are not implemented. Payment records may need retention for support and applicable obligations. See Contact for the current support channel. Never post private account or payment information in a public issue. This policy describes the implementation reviewed on 14 November 2026 and will be updated when practices change.'],
 ['Public reviews','Signed-in users may submit one display name, rating and written review. Reviews are stored with the Firebase account ID and published immediately. Public responses do not expose account IDs or email addresses. Administrators may remove abusive or irrelevant content; deleting a review removes the saved review. Moderation decisions are logged for accountability.'],
 ['Contact for privacy requests','Email yxsingh2@gmail.com to request correction or deletion of your account information. Identify the Google account concerned; Clearcutt may need to verify account ownership. Do not send passwords or payment instrument credentials. Financial records that must be retained may be excluded from deletion.']]],
 ['contact','Contact Clearcutt and Get Help','Troubleshoot the editor, report a technical issue and learn what to do if a payment is charged but membership is not active.',[
 ['Processing help','Use current desktop Chrome or Edge, check your connection for the first model download, and try Standard mode if memory is limited. Save your edits before refreshing. iOS and HEIC are unsupported. See the background removal guide for the complete workflow.'],
 ['Charged but Plus is missing','Do not pay again. Sign into the same Google account used at checkout and return to the site so membership can refresh. Keep the Razorpay payment receipt for private support. A different Google account does not inherit the original account’s membership.'],
 ['Private support and data requests','Email yxsingh2@gmail.com for membership, payment activation, account correction or deletion requests. For a payment problem, include the Google account used at checkout, the payment date and Razorpay reference. Never send card numbers, CVVs, passwords, OTPs or UPI PINs. For technical bugs, describe your browser, operating system, error and steps to reproduce. The GitHub issue tracker is public: keep personal data out of reports.'],
 ['Renewal and paid-launch status','Access lasts 30 days and renewal requires another deliberate payment; there is no automatic subscription charge. Refund terms still need to be finalized before a broader paid launch. Contact support before paying again if a transaction is unclear.']]]
];
const legacyPages = legacySources.map(([slug,title,description,sections,faqs,fields]): Page => {
 const o=typeof fields==='object'&&fields!==null?fields:{};
 return {slug,title,description,sections,faqs:faqs||[],metaTitle:o.metaTitle||title,h1:o.h1||title,lang:o.lang||'en',images:o.images||[],tables:o.tables||[],primaryImage:o.primaryImage,explicitLang:!!o.lang,lastModified:o.lastModified||pageDates[slug]||releaseDate,isGuide:!policySlugs.has(slug)};
});
const links = () => pages.map(p => `<li><a href="${site}${p.slug}/">${escape(p.title)}</a></li>`).join('');
// Editorial sanitizers: strip internal implementation details (alpha thresholds, forensic RAM erasure)
// from published india-page prose; practical limits (512px masks and model sizes) stay.
const sanitizeProse = (value: string) => value
 .replace(/\s*\(alpha\s*>\s*\d+\)/g,'')
 .replace(/\s*\(halaanki tab band karna forensic RAM erasure ki guarantee nahi hota\)/g,'')
 .replace(/\s*\(closing a tab is not a forensic RAM-erasure guarantee\)/g,'');
const mdProse = (value: string) => {
 const sanitized=sanitizeProse(value);
 if(!sanitized.trim())throw new Error('Prose sanitizer produced empty text');
 return md(sanitized);
};
// India landing pages from docs/seo/india-page-content.json (content verified in PR #13, commit 8954e63).
const indiaDoc: { siteOrigin: string; verifiedDate: string; pages: IndiaSource[] } = JSON.parse(readFileSync(new URL('../docs/seo/india-page-content.json',import.meta.url),'utf8'));
if(indiaDoc.siteOrigin!==site)throw new Error('india-page-content.json siteOrigin must match the site origin');
const indiaReferenceLinks: Record<string, readonly [string, string]> ={'REPO-INPUT-LIMITS':['Clearcutt input requirements','/how-to-remove-background/'],'REPO-MODELS-RUNTIME':['Clearcutt model and runtime notes','/how-to-remove-background/'],'REPO-EDITOR-EXPORT':['Clearcutt editor and export notes','/how-to-remove-background/'],'REPO-PLATFORM-LIMITS':['Clearcutt platform support notes','/about/'],'REPO-PRIVACY-NETWORK':['Clearcutt privacy policy','/privacy/'],'REPO-PLANS-LIMITS':['Clearcutt pricing and plans','/#plans']};
const indiaExternalLinks: Record<string, readonly [string, string]> ={'SRC-PASSPORT-ICAO':['Passport Seva ICAO photograph guidelines','https://mportal.passportindia.gov.in/pdf/Guidelines_for_ICAO_Compliant_Photographs_for_Passport_Applications.pdf'],'SRC-PASSPORT-BOOKLET':['Passport Seva application instruction booklet','https://www.passportindia.gov.in/AppOnlineProject/pdf/ApplicationformInstructionBooklet-V3.0.pdf'],'SRC-UPSC-CAF-2026':['UPSC 2026 examination notices','https://www.upsc.gov.in/sites/default/files/ExamNotifi_CAPF_AC_Exam_2026_Eng_20022026.pdf'],'SRC-UPSC-ESE-2026':['UPSC Engineering Services 2026 notice','https://www.upsc.gov.in/sites/default/files/Notif-ESEP-26-Engl.pdf'],'SRC-SSC-CAPF-2026':['SSC SI in Delhi Police and CAPF 2026 notice','https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_capf_2026.pdf'],'SRC-SSC-SCRIBE-OTR':['SSC scribe one-time registration','https://ssc.gov.in/candidate-portal/one-time-registration/scribe-otr-details'],'SRC-IBPS-PO-XVI-2026':['IBPS CRP PO/MT-XVI notification','https://www.ibps.in/wp-content/uploads/Detailed-Notification_CRP-PO-XVI_Final_V1_30.06.2026.pdf'],'SRC-IBPS-REGIONAL-SCAN':['IBPS photograph and signature scanning guidelines','https://ibpsreg.ibps.in/riicosep25/uploads/loadpdf.php?file=k7m5p+fQ15e6w9TW0NzK2pubmdWyp5rXppSo3aRx&t=1LHArOLA2di0yczXwNDa083LmNWypw%3D%3D'],'SRC-NTA-UGCNET-2025':['NTA UGC-NET June 2025 bulletin','https://ugcnet.nta.ac.in/images/information-bulletin-for-ugc-net-june-2025-16042025.pdf'],'SRC-AMAZON-IN-IMAGES':['Amazon India seller guide','https://sell.amazon.in/beginners-guide'],'SRC-FLIPKART-LISTING':['Flipkart Seller Hub listing guide','https://seller.flipkart.com/seller-blog/how-to-list-products-on-flipkart'],'SRC-FLIPKART-FASHION':['Flipkart fashion photography guide','https://seller.flipkart.com/seller-blog/ecommerce-fashion-photography'],'SRC-MEESHO-CATALOG':['Meesho supplier catalog guides','https://supplier.meesho.com/sell-online/accessories'],'SRC-MYNTRA-CATALOG':['Myntra Seller University cataloging guidelines','https://seller-university.myntra.com/listing-and-cataloging/']};
const citationFor=(id: string)=>{
 const internal=indiaReferenceLinks[id];
 if(internal)return `<a class="citation" href="${internal[1]}">${escape(internal[0])}</a>`;
 const external=indiaExternalLinks[id];
 if(!external)throw new Error(`Unknown source id: ${id}`);
 return `<a class="citation" href="${escape(external[1])}" rel="noopener nofollow">${escape(external[0])}</a>`;
};
const renderIndiaSection=(section: IndiaSection)=>{
 const parts=[`<section${section.id?` id="${escape(section.id)}"`:''}><h2>${escape(section.heading)}</h2>`];
 if(section.callout)parts.push(`<aside class="callout callout-${escape(section.callout.level)}" role="note"><p>${mdProse(section.callout.text)}</p></aside>`);
 for(const paragraph of section.paragraphs||[])parts.push(`<p>${mdProse(paragraph)}</p>`);
 if(section.bullets)parts.push(`<ul>${section.bullets.map(bullet=>`<li>${mdProse(bullet)}</li>`).join('')}</ul>`);
 for(const link of section.contextualLinks||[])parts.push(`<p class="contextual"><a href="${escape(link.href)}">${escape(link.anchorText)}</a></p>`);
 const ids=section.sourceIds||[];
 if(ids.length)parts.push(`<p class="sources">Sources: ${ids.map(citationFor).join(' · ')}</p>`);
 parts.push('</section>');
 return parts.join('');
};
// India pages whose meaningful content was updated on 20 November 2026 (commit
// 507a76e): JPG export documentation on the passport and signature pages and the
// refreshed Amazon/Flipkart/Meesho sourcing. The Hinglish guide received only the
// brand-spelling sweep then; its genuine content correction is dated separately
// below (25 November JPG-export accuracy fix), as are other page-specific dates.
const indiaContentUpdate = new Set(['passport-exam-form-white-background','amazon-flipkart-meesho-product-white-background','remove-background-from-signature-png']);
const indiaCorrectionDates: Record<string, string> = {'photo-ka-background-kaise-hataye': contentCorrectionDate};
const indiaPages=indiaDoc.pages.map((page): Page =>{
 const existingSlugs=new Set(legacyPages.map(p=>p.slug));
 if(existingSlugs.has(page.slug))throw new Error(`India page ${page.slug} collides with an existing page`);
 if(new URL(page.canonicalUrl).href!==`${site}${page.slug}/`)throw new Error(`India page ${page.slug} canonicalUrl mismatch`);
 const allSlugs=[...existingSlugs,...indiaDoc.pages.map(p=>p.slug)];
 const bySection=new Map<string, ContextualLink[]>();
 for(const link of page.contextualLinks||[]){
  if(link.placement==='primary-cta')continue;
  const target=new URL(link.href,site).pathname.replace(/\/$/,'').slice(1);
  if(target&&!allSlugs.includes(target))throw new Error(`India page ${page.slug} contextual link ${link.href} does not target a generated page`);
  const sectionId=link.placement.startsWith('section:')?link.placement.slice('section:'.length):null;
  if(sectionId)bySection.set(sectionId,[...(bySection.get(sectionId)||[]),link]);
 }
 const renderedSections=page.sections.map(section=>renderIndiaSection({...section,contextualLinks:bySection.get(section.id)||[]})).join('');
 const faqs=(page.faqs||[]).map((f): GuideFaq =>[f.question,sanitizeProse(f.answer)]);
 if(faqs.length!==5)throw new Error(`India page ${page.slug} must expose exactly five FAQs`);
 const primaryCta=(page.contextualLinks||[]).find(l=>l.placement==='primary-cta');
 return {slug:page.slug,title:page.title,metaTitle:page.title,description:page.description,h1:page.h1,lead:mdProse(page.lead),lang:page.lang,explicitLang:true,faqs,india:true,sections:page.sections,indiaBody:renderedSections,indiaCta:primaryCta?primaryCta.anchorText:'Open the free background remover',editorialDate:indiaDoc.verifiedDate,lastModified:indiaCorrectionDates[page.slug] ?? (indiaContentUpdate.has(page.slug)?contentUpdateDate:releaseDate),isGuide:true};
});
const newsPages: Page[] = [{
 slug:'remove-bg-shutting-down',
 title:'Is remove.bg Shutting Down? What Changes on 1 December 2026',
 metaTitle:'remove.bg Is Moving to Canva: What Changes on 1 December 2026',
 h1:'Is remove.bg shutting down? What changes on 1 December 2026',
 description:'remove.bg says its standalone background-removal service is moving to Canva on 1 December 2026, while API users are directed to Leonardo.Ai. Here is what is confirmed and where Clearcutt fits.',
 lang:'en',explicitLang:true,lastModified:contentUpdateDate,datePublished:releaseDate,isGuide:true,article:true,
 sections:[
  ['What remove.bg confirms','Yes—the standalone remove.bg experience is changing. The [official remove.bg FAQ](https://www.remove.bg/faq/) says its background-removal functionality is moving into Canva. The [official remove.bg API page](https://www.remove.bg/bg/api/) says that, starting 1 December 2026, API background removal moves to Leonardo.Ai. Clearcutt is independent and is not affiliated with remove.bg, Canva or Leonardo.Ai.'],
  ['What is changing on 1 December 2026','For people removing backgrounds through the remove.bg website, the official destination is Canva. For developers using the self-service API, remove.bg points to Leonardo.Ai. The companies may update migration details, so check the official FAQ before making account, subscription or API decisions.'],
  ['What remove.bg users should do now','Review the official migration FAQ, save any account records you need, and test your replacement workflow before the change date. If you depend on an API, bulk processing, JPG or WebP output, mobile support or integrations, Clearcutt is not a like-for-like replacement.'],
  ['Where Clearcutt can help','Clearcutt is useful for one photo at a time in current desktop Chrome or Edge. The photo, mask and edits stay in browser memory; Standard mode downloads about 98 MB on first use, while Detailed can download up to about 473 MB. You can refine edges with Erase and Restore, choose a background and export a PNG without a watermark. HEIC, iOS, batch processing and a public API are not supported.'],
  ['Sources and review date','This explainer was checked on 14 November 2026 against the [remove.bg migration FAQ](https://www.remove.bg/faq/), the [remove.bg API migration notice](https://www.remove.bg/bg/api/) and [Canva’s Background Remover help page](https://www.canva.com/help/background-remover/). It will be updated if those official sources change.']
 ],
 faqs:[
  ['Is remove.bg shutting down?','The standalone service is moving into Canva. remove.bg’s official FAQ describes the change as a migration of its background-removal functionality to Canva, beginning on 1 December 2026.'],
  ['When does the remove.bg change happen?','The official remove.bg API page says the migration starts on 1 December 2026. Check remove.bg’s migration FAQ for the latest timing and account instructions.'],
  ['Where are remove.bg API users being sent?','The official API page directs API background removal to Leonardo.Ai, which is also part of Canva. Clearcutt does not offer a public API and is not an API replacement.'],
  ['Is Clearcutt affiliated with remove.bg or Canva?','No. Clearcutt is an independent browser-based editor and is not affiliated with remove.bg, Canva or Leonardo.Ai.'],
  ['Can Clearcutt replace remove.bg for bulk or mobile workflows?','No. Clearcutt currently processes one photo at a time in desktop Chrome or Edge, exports PNG or JPG, and does not support an API, batch processing, HEIC or iOS.']
 ]
}];
const hindiPage: Page = {
 slug: hindiSlug, title: hindiTitle, metaTitle: hindiTitle, h1: hindiTitle, description: hindiDescription,
 lang: 'hi', explicitLang: true, article: true, isGuide: true,
 datePublished: '2026-11-20', lastModified: contentCorrectionDate,
 sections: hindiSections, faqs: hindiFaqs,
};
export const pages=[...legacyPages,...indiaPages,...newsPages,hindiPage];
const guideMedia: Record<string, GuideMedia> = {
 'how-to-remove-background':{name:'workflow',width:960,height:340,alt:'Illustrated three-step Clearcutt workflow showing upload, edge refinement and PNG download',caption:'Illustrated walkthrough — your own photo and result will be different.'},
 'photo-ka-background-kaise-hataye':{name:'workflow',width:960,height:340,alt:'Clearcutt mein upload, edge refine aur PNG download ka illustrated three-step workflow',caption:'Illustrated walkthrough — aapki photo aur result alag honge.'},
 'remove-background-products':{name:'products',width:960,height:600,alt:'Illustration of a shoe product photo on white with background colour choices',caption:'Illustration: check the current listing rules for the marketplace and product category you use.'},
 'amazon-flipkart-meesho-product-white-background':{name:'products',width:960,height:600,alt:'Illustration of a product photo on a white background with alternative colour choices',caption:'Illustration only — marketplace rules vary by platform and category, so check the current listing requirements.'},
 'remove-background-portraits':{name:'portraits',width:960,height:600,alt:'Illustrated portrait cutout shown on two background colours with hair and glasses highlighted for inspection',caption:'AI-generated illustrative portrait. Inspect hair, glasses and shoulders against more than one background.'},
 'remove-background-animals':{name:'animals',width:960,height:600,alt:'Illustrated animal cutout showing a squirrel on a solid background and a transparency checkerboard',caption:'AI-generated illustration. Fine fur and whiskers are areas to inspect before downloading.'},
 'passport-exam-form-white-background':{name:'passport',width:960,height:600,alt:'Illustrative portrait beside a warning to check current official photo instructions before editing',caption:'Illustrative portrait, not an accepted ID-photo example. Editing may be prohibited and acceptance is never guaranteed.',afterFirstSection:true},
 'remove-background-from-signature-png':{name:'signature',width:960,height:600,alt:'Demonstration sheet marked SAMPLE with a reminder that ink-only transparency is not guaranteed',caption:'Controlled demonstration, not a real signature or model-output claim. Inspect the exported PNG on a dark background.'}
};
const renderGuideVisual=(p: Page)=>{
 if(p.slug==='transparent-background')return renderGuideComparison('transparency');
 if(p.slug==='remove-background-cars')return renderCarGallery();
 const media=guideMedia[p.slug];
 if(!media)return '';
 return `<figure class="guide-visual"><img class="guide-visual-image" src="/artwork/guides/${media.name}-960.webp" srcset="/artwork/guides/${media.name}-480.webp 480w, /artwork/guides/${media.name}-960.webp 960w" sizes="(max-width: 767px) calc(100vw - 48px), 756px" width="${media.width}" height="${media.height}" alt="${escape(media.alt)}" decoding="async" fetchpriority="high"><figcaption>${escape(media.caption)}</figcaption></figure>`;
};
const renderWorkflowDemo=(p: Page)=>p.slug==='how-to-remove-background'?`<details class="guide-demo"><summary>Watch the 3-step illustrated walkthrough</summary><figure><picture><source media="(prefers-reduced-motion: reduce)" srcset="/artwork/how-to/download.webp"><img src="/artwork/guides/workflow.gif" width="480" height="360" loading="lazy" decoding="async" alt="Three illustrated Clearcutt steps: upload a photo, refine the cutout, then download a PNG"></picture><figcaption>This short illustration plays once. It is not a recording of model output.</figcaption></figure></details>`:'';
const description = 'Remove image backgrounds for free with Clearcutt. Create transparent PNGs, add white or colored backgrounds, and refine cutouts privately on your device.';
export const schema = {'@context':'https://schema.org','@graph':[
 {'@type':'WebSite','@id':`${site}#website`,name:'Clearcutt',alternateName:['Clearcutt Remove BG','clearcutt.in'],url:site,inLanguage:'en'},
 {'@type':'Organization','@id':`${site}#organization`,name:'Clearcutt',alternateName:'Clearcutt Remove BG',url:site,logo:{'@type':'ImageObject',url:`${site}favicon-512.png`,width:512,height:512},sameAs:[githubProfile,instagramProfile]},
 {'@type':'FAQPage','@id':`${site}#faq`,mainEntity:[
  {'@type':'Question',name:'Is Clearcutt free to use?',acceptedAnswer:{'@type':'Answer',text:'The current Clearcutt background remover is free to use without a watermark or required account. Processing runs on the user’s device.'}},
  {'@type':'Question',name:'Are images uploaded or saved by Clearcutt?',acceptedAnswer:{'@type':'Answer',text:'Selected photos, masks and edits remain in browser memory and are not uploaded to Clearcutt’s payment backend. Model files may be cached by the browser.'}},
  {'@type':'Question',name:'Why does the first background removal take longer?',acceptedAnswer:{'@type':'Answer',text:'The first run downloads an AI model of approximately 98 MB in Standard mode or up to approximately 473 MB in Detailed mode. Browser caching can help later runs.'}},
  {'@type':'Question',name:'Which image formats does Clearcutt support?',acceptedAnswer:{'@type':'Answer',text:'Clearcutt accepts JPG, PNG and WebP images up to 20 MB and 25 megapixels. HEIC and iOS are not supported in the current release.'}}
 ]},
 {'@type':'WebApplication',name:'Clearcutt Remove BG',url:site,applicationCategory:'MultimediaApplication',operatingSystem:'Windows, macOS, Linux',browserRequirements:'Current desktop Chrome or Edge; JavaScript and WebAssembly required',description,offers:{'@type':'Offer',price:'0',priceCurrency:'INR',description:'Free single-image background removal and PNG export'}}
]};
export function enhanceHome(html: string) {
 const guides = `<section class="seo-guides reference-container" aria-labelledby="guides-heading"><h2 id="guides-heading">Background removal guides and help</h2><p>Find practical steps for your photo and learn how Clearcutt handles your images.</p><nav aria-label="Guides"><ul>${links()}</ul></nav><p><a href="https://github.com/singhyashkumar/clearcut-remove-bg/issues">Report a technical issue</a> · Keep private account and payment information out of public reports.</p></section>`;
 const migrationNotice = `<aside class="migration-notice" aria-label="remove.bg service update"><p><strong>remove.bg is moving to Canva on 1 December 2026.</strong> <a href="/remove-bg-shutting-down/">See what is changing and whether Clearcutt fits your workflow →</a></p></aside>`;
 const feedback = `<section class="reviews-section reference-container" id="reviews" aria-labelledby="reviews-heading"><header class="reviews-heading"><div><span class="eyebrow">REAL USER FEEDBACK</span><h2 id="reviews-heading">Clearcutt reviews</h2><p>Reviews come from signed-in users and are published immediately. They are not verified purchases or Google reviews.</p></div><p class="reviews-summary" id="reviews-summary" role="status">Loading published reviews…</p></header><ul class="reviews-list" id="reviews-list" aria-label="Published Clearcutt reviews"></ul><p class="reviews-empty" id="reviews-empty">No published reviews yet.</p><div class="review-compose"><div><h3>Share your experience</h3><p>One review per Google account. Be specific and honest; do not include private information.</p><p><a href="mailto:yxsingh2@gmail.com?subject=Private%20Clearcut%20feedback">Send private feedback instead</a></p></div><form id="review-form"><fieldset class="review-rating"><legend>Your rating</legend>${[1,2,3,4,5].map(value=>`<label><input type="radio" name="rating" value="${value}" required><span aria-hidden="true">★</span><span class="sr-only">${value} star${value===1?'':'s'}</span></label>`).join('')}</fieldset><label for="review-name">Public display name</label><input id="review-name" name="display_name" type="text" minlength="2" maxlength="50" autocomplete="nickname" required><label for="review-body">Your review</label><textarea id="review-body" name="body" minlength="20" maxlength="1000" rows="5" required></textarea><span class="review-count" id="review-count">0 / 1000</span><div class="review-actions"><button class="section-cta" id="review-signin" type="button">Sign in to review</button><button class="section-cta" id="review-submit" type="submit">Submit review</button><button class="review-delete" id="review-delete" type="button" hidden>Delete my review</button></div><p class="review-status" id="review-status" role="status" aria-live="polite">Checking sign-in…</p></form></div><section class="review-admin" id="review-admin" hidden aria-labelledby="review-admin-heading"><div class="review-admin-heading"><h3 id="review-admin-heading">Review moderation</h3><button id="review-admin-refresh" type="button">Refresh queue</button></div><ul id="review-admin-list"></ul><p id="review-admin-status" role="status" aria-live="polite"></p></section></section>`;
 return protectEmails(html.replace(/<title>.*?<\/title>/,'<title>Remove Background from Image for Free | Clearcutt Remove BG</title>')
 .replace('No image upload service, analytics, or image storage is used.','No image upload or image-storage service is used. Cloudflare Web Analytics collects cookie-free page-performance measurements and page URLs, but never receives your selected photo, mask or edits.')
 .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${description}">`)
 .replace('</head>',`<meta name="robots" content="index,follow,max-image-preview:large"><script type="application/ld+json">${JSON.stringify(schema)}</script></head>`)
 .replace('<main>',`<main>${migrationNotice}`)
 .replace('<section class="final-cta">',`${feedback}${guides}<section class="final-cta">`)
 .replace('</footer>','<a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/contact/">Contact</a><a href="mailto:yxsingh2@gmail.com">Support</a></footer>'));
}
const evidenceImage=(image: EvidenceImage)=>{
 if(!image||typeof image.src!=='string'||!image.src)throw new Error('Evidence images need a src');
 if(typeof image.alt!=='string'||!image.alt)throw new Error(`Evidence image ${image.src} needs alt text`);
 if(!Number.isInteger(image.width)||image.width<=0||!Number.isInteger(image.height)||image.height<=0)throw new Error(`Evidence image ${image.src} needs positive integer width and height`);
 const srcset=typeof image.srcset==='string'&&image.srcset?` srcset="${escape(image.srcset)}"`:'';
 const sizes=typeof image.sizes==='string'&&image.sizes?` sizes="${escape(image.sizes)}"`:'';
 return {html:`<img src="${escape(image.src)}" alt="${escape(image.alt)}" loading="lazy" decoding="async" width="${image.width}" height="${image.height}"${srcset}${sizes}>`};
};
function renderPageBase(p: Page) {
 const url=`${site}${p.slug}/`;
 const pageTitle=p.metaTitle||p.title;
 const data: Record<string, unknown> = {'@context':'https://schema.org','@type':p.article?'Article':'WebPage',name:p.title,description:p.description,url,isPartOf:{'@id':`${site}#website`},breadcrumb:{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Clearcutt Remove BG',item:site},{'@type':'ListItem',position:2,name:p.title,item:url}]}};
 data.author={'@type':'Organization','@id':`${site}#organization`,name:'Clearcutt',url:site};
 data.publisher={'@id':`${site}#organization`};
 data.dateModified=p.lastModified;
 if(p.article){data.headline=p.h1||p.title;data.datePublished=p.datePublished;data.mainEntityOfPage=url;}
 if(p.explicitLang)data.inLanguage=p.lang;
 if(p.images&&p.images.length){const first=p.images[0];data.primaryImageOfPage={'@type':'ImageObject',url:new URL(first.src,url).href,name:first.alt,width:first.width,height:first.height};}
 if(p.primaryImage){data.primaryImageOfPage={'@type':'ImageObject',url:new URL(p.primaryImage.src,url).href,name:p.primaryImage.alt,width:p.primaryImage.width,height:p.primaryImage.height};}
 if(p.faqs.length)data['@graph']=[{'@type':'FAQPage','@id':`${url}#faq`,mainEntity:p.faqs.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}];
 const figures=(p.images||[]).map(({src,alt,caption,...rest})=>`<figure class="evidence">${evidenceImage({src,alt,...rest}).html}${caption?`<figcaption>${escape(caption)}</figcaption>`:''}</figure>`).join('');
 const tables=(p.tables||[]).map(({caption,head,rows})=>`<div class="table-wrap"${caption?` role="group" aria-label="${escape(caption)}"`:''}><table>${caption?`<caption>${escape(caption)}</caption>`:''}<thead><tr>${head.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('');
 const visual=renderGuideVisual(p);
 // Pages with a dedicated primary image (currently the car guide) reference that
 // image in the social cards; every other page keeps the default social card.
 const pageSocial=p.primaryImage
  ?{image:new URL(p.primaryImage.src,url).href,width:String(p.primaryImage.width),height:String(p.primaryImage.height),alt:p.primaryImage.alt}
  :{image:socialImage,width:'1200',height:'630',alt:'Clearcutt Remove BG — private, on-device image background removal'};
 const visualBeforeSections=guideMedia[p.slug]?.afterFirstSection?'':visual;
 const insertAfterFirstSection=(body: string)=>guideMedia[p.slug]?.afterFirstSection?body.replace('</section>',`</section>${visual}`):body;
 const legacyBody=p.india?'':insertAfterFirstSection(p.sections.map(([h,t])=>`<section${p.slug==='about'&&h==='Editorial standards'?' id="editorial-standards"':''}><h2>${escape(h)}</h2><p>${md(t)}</p>${figures}${tables}</section>`).join(''));
 // The transparent guide gains the supplementary opaque-JPEG comparison after the
 // "Why PNG and not JPG" section; the typed renderer performs the same insertion.
 const legacyBodyWithSupplement=p.slug==='transparent-background'
  ?legacyBody.replace('<section><h2>Graphics and logos</h2>',`${renderOpaqueExampleSection()}<section><h2>Graphics and logos</h2>`)
  :legacyBody;
 const indiaBody=p.india?insertAfterFirstSection(p.indiaBody):'';
 const contentBody=p.india?`${indiaBody}<p class="editorial-note">Editorially checked on ${p.editorialDate}. Product behaviour can change; this guide is reviewed against the current editor and the official sources listed on this page.</p><p><a class="cta" href="/#workspace">${escape(p.indiaCta)} →</a></p>`:`${legacyBodyWithSupplement}${renderWorkflowDemo(p)}`;
 const pageMeta=p.isGuide?`<p class="page-meta">Maintained by <a href="/about/#editorial-standards">Clearcutt</a> · Last updated <time datetime="${p.lastModified}">${new Date(`${p.lastModified}T00:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}</time></p>`:'';
 return `<!doctype html><html lang="${p.lang||'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(pageTitle)} | Clearcutt</title><meta name="description" content="${escape(p.description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="referrer" content="no-referrer"><meta property="og:site_name" content="Clearcutt Remove BG"><meta property="og:title" content="${escape(pageTitle)} | Clearcutt"><meta property="og:description" content="${escape(p.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:image" content="${pageSocial.image}"><meta property="og:image:width" content="${pageSocial.width}"><meta property="og:image:height" content="${pageSocial.height}"><meta property="og:image:alt" content="${escape(pageSocial.alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(pageTitle)} | Clearcutt"><meta name="twitter:description" content="${escape(p.description)}"><meta name="twitter:image" content="${pageSocial.image}"><meta name="twitter:image:alt" content="${escape(pageSocial.alt)}"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; script-src https://static.cloudflareinsights.com; connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'"><link rel="canonical" href="${url}"><link rel="stylesheet" href="/seo.css"><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><a class="skip" href="#content">Skip to content</a><header><a class="brand" href="/">◩ clearcutt.</a><nav aria-label="Main"><a href="/#workspace">Remove background</a><a href="/how-to-remove-background/">How to use</a><a href="/#plans">Pricing</a></nav></header><main id="content"><p class="breadcrumb"><a href="/">Home</a><span aria-hidden="true"> / </span>${escape(p.title)}</p><h1>${escape(p.h1||p.title)}</h1><p class="lead">${p.india?p.lead:escape(p.description)}</p>${pageMeta}${visualBeforeSections}${contentBody}${p.faqs.length?`<section class="faq" aria-labelledby="faq-heading"><h2 id="faq-heading">Frequently asked questions</h2>${p.faqs.map(([q,a])=>`<h3>${escape(q)}</h3><p>${p.india?mdProse(a):md(a)}</p>`).join('')}</section>`:''}<p><a class="cta" href="/#workspace">Open the free background remover →</a></p>${p.slug==='contact'?'<p><a href="mailto:yxsingh2@gmail.com?subject=Clearcutt%20feedback">Send private feedback</a> · <a href="https://github.com/singhyashkumar/clearcut-remove-bg/issues">Open the public issue tracker</a></p>':''}<aside aria-label="Related guides"><h2>Explore Clearcutt</h2><ul>${links()}</ul></aside></main><footer><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/contact/">Contact</a><a href="/THIRD_PARTY_NOTICES.md">Open-source notices</a></footer></body></html>`;
}
export function renderPage(p: Page) {
 const stylesheet = ['transparent-background','remove-background-cars'].includes(p.slug) ? comparisonStylesheet : '/seo.css';
 const sharedHtml=protectEmails(renderPageBase(p))
  .replace('property="og:site_name" content="Clearcutt Remove BG"','property="og:site_name" content="Clearcutt"')
  .replace('<link rel="stylesheet" href="/seo.css">',`${faviconLinks}<link rel="stylesheet" href="${stylesheet}">`);
 if(p.slug===hindiSlug||p.slug===hinglishSlug){
  const hindi=p.slug===hindiSlug;
  const alternates=`<link rel="alternate" hreflang="hi" href="${site}${hindiSlug}/"><link rel="alternate" hreflang="hi-Latn" href="${site}${hinglishSlug}/">`;
  const switchLink=hindi
   ? `<p><a href="/${hinglishSlug}/" lang="hi-Latn">Hinglish mein padhein</a></p>`
   : `<p><a href="/${hindiSlug}/" lang="hi">हिंदी (देवनागरी) में पढ़ें</a></p>`;
  let html=sharedHtml.replace('</head>',`${alternates}</head>`).replace('<p class="page-meta">',`${switchLink}<p class="page-meta">`);
  if(hindi)html=html
   .replace('>Skip to content<','>मुख्य सामग्री पर जाएँ<')
   .replace('aria-label="Main"','aria-label="मुख्य नेविगेशन"')
   .replace('>Remove background<','>बैकग्राउंड हटाएँ<')
   .replace('>How to use<','>इस्तेमाल करने का तरीका<')
   .replace('>Pricing<','>कीमत<')
   .replace('>Home<','>होम<')
   .replace('>Maintained by ', '>लेखक ')
   .replace('· Last updated ', '· अपडेट ')
   .replace('>Frequently asked questions<','>अक्सर पूछे जाने वाले सवाल<')
   .replace('>Open the free background remover →<','>मुफ़्त एडिटर खोलें →<')
   .replace('aria-label="Related guides"','aria-label="संबंधित गाइड"')
   .replace('>Explore Clearcutt<','>Clearcutt की अन्य गाइड<')
   .replace('>About<','>परिचय<')
   .replace('>Privacy<','>गोपनीयता<')
   .replace('>Contact<','>संपर्क<')
   .replace('>Open-source notices<','>ओपन सोर्स नोटिस<');
  return html;
 }
 if(p.slug!=='transparent-background')return sharedHtml;
 const typedHtml=renderTransparentPage({linksHtml:links(),lastModified:p.lastModified});
 if(typedHtml!==sharedHtml){
  let mismatch=0;
  while(mismatch<typedHtml.length&&mismatch<sharedHtml.length&&typedHtml[mismatch]===sharedHtml[mismatch])mismatch++;
  throw new Error(`Transparent page TypeScript parity failed at byte ${mismatch} (typed ${typedHtml.length}, legacy ${sharedHtml.length})`);
 }
 return typedHtml;
}
// Byte-identical to public/robots.txt. Disallow controls crawling only and does
// not guarantee deindexing; no primary content page or crawler (including
// Bingbot) is blocked.
export const robots=`User-agent: *\nAllow: /\nDisallow: /THIRD_PARTY_NOTICES.md\n\nSitemap: ${site}sitemap.xml\n`;
// Sitemap lastmod: actual modification instants (ISO 8601 UTC) for URLs whose
// content changed at a known commit time; date-only values are preserved where
// that accurate day is already recorded and no newer change exists. Never set
// these to the build timestamp or the current date.
export const sitemapLastmod: Record<string, string> = {
 'remove-background-products': contentUpdateInstant,
 'remove-background-portraits': contentUpdateInstant,
 'about': docsUpdateInstant,
 'privacy': contentUpdateInstant,
 'passport-exam-form-white-background': contentUpdateInstant,
 'amazon-flipkart-meesho-product-white-background': contentUpdateInstant,
 'remove-background-from-signature-png': contentUpdateInstant,
 'remove-bg-shutting-down': contentUpdateInstant,
 'photo-ka-background-kaise-hataye': contentCorrectionInstant,
 'photo-background-hindi': contentCorrectionInstant,
 'remove-background-cars': visualUpdateInstant,
 'transparent-background': visualUpdateInstant,
};
export const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site}</loc><lastmod>${contentUpdateInstant}</lastmod></url>${pages.map(p=>`<url><loc>${site}${p.slug}/</loc><lastmod>${sitemapLastmod[p.slug] ?? p.lastModified}</lastmod></url>`).join('')}</urlset>\n`;
export function seoPlugin(): Plugin {let outDir: string;return {name:'clearcut-seo',configResolved(config){outDir=resolve(config.root,config.build.outDir);},transformIndexHtml:enhanceHome,closeBundle(){for(const p of pages){const directory=resolve(outDir,p.slug);mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,'index.html'),renderPage(p));}writeFileSync(resolve(outDir,'robots.txt'),robots);writeFileSync(resolve(outDir,'sitemap.xml'),sitemap);}};}

