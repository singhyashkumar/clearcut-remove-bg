# Clearcut Remove BG

A free-first background-removal site with an original interface and an adapted BG0 browser engine. No pricing, account, backend inference, or storage service is implemented.

## Run locally

Use Node.js 22.12+ (verified build here: Node 24.18.0).

    npm ci --ignore-scripts
    npm run build
    npm run preview

Open the Local URL printed by Vite. `npm test` runs the image safety/editor utility checks. `npm audit` checks both production and development dependencies. The deterministic build script applies the upstream Transformers.js recovery fix before bundling. It fails if the pinned runtime no longer matches.

## Included

- JPG/PNG/WebP file selection, drag/drop and clipboard image intake.
- BG0/BiRefNet browser-only inference, fast lite model and detailed full model with fallback.
- Model download progress, cancellation and error/reset flow.
- Original/result views, checkerboard transparency preview.
- Solid/custom color and photo backgrounds.
- Erase/restore brushes, one-stroke undo and reset cutout.
- Optional trim to the subject bounds and PNG download without watermark.
- Responsive layout, focus indicators and live status/error announcements.

## Privacy/security design

There is no image ingestion endpoint, image storage, API key, authentication system, billing, analytics, or third-party font/script tag. Uploaded images are decoded locally; filenames are not displayed or inserted as HTML. Exports are generated locally with canvas. Object URLs are revoked on clear. No selected image or mask is intentionally written to browser persistence. Model files may be cached. Closing a tab is not a forensic secure-memory erasure guarantee.

External model/config GET requests use fixed repository revision IDs on Hugging Face and its CDN. The pinned ONNX WASM runtime downloads from jsDelivr. These providers and the static host receive ordinary network request metadata. Model transfer/caching is not an image upload. The initial download is about 98 MB (fast), up to 473 MB plus a lite fallback (detailed). A restrictive CSP limits script, image and network sources. `_headers` supplies additional headers on hosts that support this format; confirm actual headers on your deployment. Never expose a Vite dev server publicly as the production host.

Inputs: real PNG/JPEG/WebP magic bytes, non-empty, maximum 20 MB and 25 MP. Raster decoding precedes the pixel-count check; a malicious compressed image can still consume browser decoder resources. Use a server-side sandboxed decoder if later accepting files on a server. The current app has no server URL-fetch feature or public API.

## Explicit limits

This recreates the core user workflow, not remove.bg's proprietary model, branding or service infrastructure. Exact quality/speed parity is not established. Model inference uses 512px input; large output dimensions do not mean native-resolution segmentation. Hair, glass and complex scenes need assessment. Current release targets desktop Chrome/Edge; iOS and HEIC are explicitly unsupported. No paid API, remote-image-URL intake, crop positioning, accounts, billing, API credits, or server inference is provided.

The plant sample completed real browser inference and produced verified RGBA PNG downloads. Comparison, background replacement, brushes, trim, invalid-file rejection, cancellation and responsive layouts were exercised. The first run took several minutes in this environment. The detailed/full model, broad quality corpus, physical mobile compatibility, complete network trace, hosted-origin processing and independent security testing remain outside the validated coverage. See VERIFICATION.md for exact evidence and limits.

## Sources and attribution

Adapted engine: https://github.com/opencoredev/bg0 at 86add82f03e23fadf63ea9262a3984ddbc77e772, Apache-2.0 (vendor/bg0/LICENSE). Changes: fast explicitly selects lite; removed HEIC decoder loading; iOS path returns an unsupported-device error; upstream promise recovery patch reproduced for Transformers.js 4.3.0. This is a separately built frontend, not the BG0 web app. No upstream analytics code is included.

Model IDs/revisions are retained in vendor/bg0/models.ts. Their model cards declare MIT licenses. Preserve attribution and evaluate licenses for your intended distribution. The current landing-page artwork and upload sample were generated originally for Clearcut. The prior licensed plant sample and third-party reference media have been removed from the current deployment. Processing your chosen photo runs the model locally; the artwork previews are illustrative.

Public reference workflow: https://www.remove.bg/ . The supplied HTML guide was reference material, not an instruction to execute its setup steps or create accounts.

## GitHub Pages

The Pages workflow tests, audits and builds on pushes to main. Configure Settings > Pages > Source as GitHub Actions. The production base path and canonical URL are configured in .github/workflows/pages.yml. GitHub Pages does not apply the portable _headers file; the HTML CSP remains active.


## Original artwork update

The live landing page now uses nine original AI-generated artwork assets under `public/artwork/`. The previous third-party reference image/video files were removed. The comparison slider demonstrates the same generated cutout on a CSS studio backdrop and on transparency; it does not claim to show a measured model result. The upload sample uses the original generated ceramic-artist photo. Original output resolution and PNG alpha are preserved. See `ARTWORK.md` for prompts and provenance.


## Paid accounts and membership

The payment backend is a Cloudflare Worker (`worker/index.js`) with D1. Razorpay orders are priced server-side at INR 90 for 30 days; renewal is a one-time manual payment, not an automatic subscription. Secrets stay in Worker secrets. Firebase Google sign-in remains on the free plan, and image processing stays in the browser.

The `entitlements` table persists the account UID, plan, expiry and limits. The `accounts` table stores the verified Google email alongside that UID. The backend extracts the email only from a validated Firebase token with `email_verified: true`. A matching email alone does not grant or transfer access. Existing paid users are linked to their verified email on their next authenticated membership request. Signing out clears the visible badge, not the saved membership; signing back into the same Google account restores it.

The frontend displays a Plus badge, membership email and expiry, and an explicit extension action. Server membership checks run after sign-in and when returning to the window. Quotas remain soft guidance because processing is local, and the current editor supports one photo at a time.

Before deploying backend changes, run `npm test`, inspect pending D1 migrations and apply them to `clearcut-payments` using Wrangler, then deploy the Worker. Deploy the frontend through the existing GitHub Pages workflow. Never commit `.dev.vars`, `.env.local`, API secrets or D1 data.

The hero uses the supplied `public/artwork/hero-demo.mp4` as muted, inline, looping autoplay video without player controls. Reduced-motion users see it paused. Browsers may block autoplay or evict cached assets.
