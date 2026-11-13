# Source Ledger & Integration Notes for India SEO Content Handoff

- **Repository:** `singhyashkumar/clearcut-remove-bg`
- **Audited Base Commit:** `bef5689b8d79e722f89341ea1b8b9ed6a487c7fc` (`main`)
- **Verification Date:** `2026-11-13`
- **Companion Content File:** `docs/seo/india-page-content.json`
- **Scope Boundary:** Content-only handoff for four planned routes (`/photo-ka-background-kaise-hataye/`, `/passport-exam-form-white-background/`, `/amazon-flipkart-meesho-product-white-background/`, `/remove-background-from-signature-png/`). Shared template infrastructure (`scripts/seo.mjs`), CSS (`public/seo.css`), test suites, verification scripts, and existing pages remain owned by Z.ai.

---

## 1. Repository Capability Sources (`REPO-*`)

Every Clearcut product claim in `docs/seo/india-page-content.json` is constrained to behavior verified in commit `bef5689b8d79e722f89341ea1b8b9ed6a487c7fc` and on live `https://clearcutt.in/`.

### `REPO-INPUT-LIMITS`
- **Primary paths:** `src/image-utils.js`, `src/main.js`, `index.html`, `vendor/bg0/image.ts`
- **Applicability date:** Repository state verified `2026-11-13` (base commit `bef5689b8d79e722f89341ea1b8b9ed6a487c7fc`).
- **Claims supported:**
  - `validateFile()` (`src/image-utils.js:1-10`) enforces non-empty files up to `MAX_BYTES = 20_000_000` (20 MB decimal) and magic-byte signatures for JPEG (`255,216,255`), PNG (`137,80,78,71,13,10,26,10`), and WebP (`RIFF....WEBP`) only.
  - `src/main.js:28,66` enforces `MAX_PIXELS = 25_000_000` (25 megapixels) after `createImageBitmap` on both main uploads and custom background photos (`#bg-file`).
  - Intake methods in `src/main.js:54-60` and `index.html:7`: `Upload Image` file chooser, drag-and-drop, and `Ctrl + V` clipboard paste.
  - HEIC/HEIF is rejected at `validateFile()` and throws an unsupported-image error in `vendor/bg0/image.ts:251`; SVG, PDF, GIF, and TIFF are rejected.
- **Used in slugs:** `photo-ka-background-kaise-hataye`, `passport-exam-form-white-background`, `amazon-flipkart-meesho-product-white-background`, `remove-background-from-signature-png`

### `REPO-MODELS-RUNTIME`
- **Primary paths:** `index.html`, `vendor/bg0/models.ts`, `vendor/bg0/index.ts`, `vendor/bg0/refinement.ts`, `vendor/bg0/image.ts`, `vendor/bg0/guard.ts`
- **Applicability date:** Repository state verified `2026-11-13`.
- **Claims supported:**
  - UI dropdown (`index.html:7`) exposes two modes: `Standard · original model (98 MB)` (`value="fast"`) and `Detailed · larger model` (`value="quality"`).
  - `Standard` runs `birefnet-lite` (`studioludens/birefnet-lite-512`, pinned revision `4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7`, `98,484,532` bytes / ~98 MB fp16 ONNX, `inputSize: 512`).
  - `Detailed` prefers `birefnet` (`naddy24/birefnet-512-webgpu`, pinned revision `ca02a86c094927479e2be583abe87f8ea73fcfda`, `473,435,223` bytes / ~473 MB fp16 ONNX, `inputSize: 512`) when hardware admission passes, and automatically falls back to `birefnet-lite` (98 MB) on `<4 GB` reported `deviceMemory`, CPU-only devices with `<4` logical cores, unsupported WebGPU `shader-f16`/buffer limits, load/inference errors, or for 7 days after a detected tab crash (`bg0:full-model-blocked:v1` in `vendor/bg0/guard.ts`).
  - Both models segment at `512×512` internal resolution; full-size export preserves source pixel dimensions without adding native-megapixel segmentation detail. In `Detailed` mode only, `createMaskRefinement()` (`vendor/bg0/refinement.ts`) runs an optional second `512px` pass on a padded crop from a `≤1024px` source when the foreground covers `<85%` of image area (excluding sparse `80–85%` crops below `40%` foreground density).
  - Model weights can be cached in browser Cache Storage (`transformers-cache`) or IndexedDB, subject to browser clearing or eviction.
- **Used in slugs:** `photo-ka-background-kaise-hataye`, `passport-exam-form-white-background`, `amazon-flipkart-meesho-product-white-background`, `remove-background-from-signature-png`

### `REPO-EDITOR-EXPORT`
- **Primary paths:** `index.html`, `src/main.js`, `src/image-utils.js`, `VERIFICATION.md`
- **Applicability date:** Repository state verified `2026-11-13` (browser export verification dated `2026-10-21` in `VERIFICATION.md`).
- **Claims supported:**
  - View controls toggle between `Result` (`#result-view`) and `Original` (`#original-view`).
  - Pointer tools provide `View` (`#move`), `Erase` (`#erase`), and `Restore` (`#restore`) with brush size `5–150` px (`#brush`, default `40`), feathering alpha toward `0` on erase or toward original `sourceAlpha` on restore (`src/image-utils.js:17-24`).
  - `Undo` (`#undo`, `src/main.js:6,72,78`) stores **one previous mask state only** (single-step undo, not multi-step history). `Reset cutout` (`#reset-mask`) restores `initialAlpha` (and saves the pre-reset state into the single undo slot). `New photo ↗` (`#reset`) discards the session.
  - Background options (`index.html:9`, `src/main.js:63-66`): Transparent checkerboard (`transparent`, visual guide only), pure White (`#ffffff`, verified RGBA `[255,255,255,255]` in `VERIFICATION.md`), Dark green (`#20372f`), Pink (`#f1c6c1`), Custom background color (`#color`), and Add background photo (`#bg-file`, cover-scaled).
  - `Trim empty edges` (`#crop`, `src/main.js:82-85`, `src/image-utils.js:11-16`) computes tight bounding coordinates where subject `alpha > 4` and crops `exportCanvas` to those bounds with zero margin **even when White (`#ffffff`), a solid color, or a background photo is selected**.
  - Export (`src/main.js:85-86`) creates `image/png` (`clearcut.png`) only, without watermark. Clearcut has no JPG/JPEG, SVG, PDF, or TIFF export, no cm/pixel template cropping, no DPI metadata control, and no KB file-size compression.
- **Used in slugs:** `photo-ka-background-kaise-hataye`, `passport-exam-form-white-background`, `amazon-flipkart-meesho-product-white-background`, `remove-background-from-signature-png`

### `REPO-PLATFORM-LIMITS`
- **Primary paths:** `vendor/bg0/ios.ts`, `vendor/bg0/runtime.ts`, `index.html`, `tests/model-selection.test.mjs`, `VERIFICATION.md`
- **Applicability date:** Repository state verified `2026-11-13` (Android follow-up entries dated `2026-10-25` in `VERIFICATION.md`).
- **Claims supported:**
  - Desktop Chrome and Edge (Windows, macOS, Linux) are the primary supported browsers.
  - iOS and iPadOS (`iPhone`, `iPad`, `iPod`, or touch `Macintosh` in `vendor/bg0/runtime.ts:4-5,18-26`) route to `vendor/bg0/ios.ts`, which immediately rejects with an unsupported-device error across all iOS browsers.
  - Android Chrome defaults to the original `98 MB` `Standard` (`birefnet-lite`) model (`index.html:7`, `tests/model-selection.test.mjs`), and `VERIFICATION.md` records real user reports that the 98 MB model ran across multiple days on their Android phone and friends' phones—while also recording ~2.7 GB host CPU RSS and an unverified physical-phone memory budget, meaning universal Android device support must not be claimed.
- **Used in slugs:** `photo-ka-background-kaise-hataye`, `passport-exam-form-white-background`, `amazon-flipkart-meesho-product-white-background`, `remove-background-from-signature-png`

### `REPO-PRIVACY-NETWORK`
- **Primary paths:** `src/main.js`, `scripts/seo.mjs`, `SECURITY-REVIEW.md`, `VERIFICATION.md`, `README.md`
- **Applicability date:** Security review dated `2026-10-21`; privacy policy text in `scripts/seo.mjs` dated `2026-10-23`; verified `2026-11-13`.
- **Claims supported:**
  - Selected photos, masks, and brush edits remain in browser memory on the user's device and are never uploaded to Clearcut's Cloudflare Worker/D1 backend or any image server.
  - Closing the tab or clicking `New photo ↗` discards the editing session in the application, though closing a browser tab is not a forensic RAM-erasure guarantee.
  - Clearcut is not zero-network: model/config GET requests go to Hugging Face (`huggingface.co` / `*.hf.co`), the pinned ONNX WASM runtime loads from jsDelivr (`cdn.jsdelivr.net`), the site is served via GitHub Pages / Cloudflare, and optional sign-in/reviews/checkout connect to Google Firebase and Razorpay (which receive ordinary HTTP request metadata such as IP address and headers, never user photos).
- **Used in slugs:** `photo-ka-background-kaise-hataye`, `passport-exam-form-white-background`, `amazon-flipkart-meesho-product-white-background`, `remove-background-from-signature-png`

### `REPO-PLANS-LIMITS`
- **Primary paths:** `index.html`, `src/use-cases.json`, `scripts/seo.mjs`, `worker/index.js`, `README.md`
- **Applicability date:** Repository state verified `2026-11-13`.
- **Claims supported:**
  - Single-photo workflow only (one image per run); no batch/bulk processing, no catalog CSV tool, no public API, and no automatic shadow generation.
  - Background removal works free without sign-in; Clearcut Plus is a manual 30-day pass (`₹90`, no auto-renewal) whose daily guidance is not strictly enforced in-browser and does not unlock batch processing today.
- **Used in slugs:** `amazon-flipkart-meesho-product-white-background`

---

## 2. Official External Primary Sources (`SRC-*`)

Only primary government, examination-body, marketplace-seller, and search-engine documentation was used. Portal- and category-specific rules are treated as variable across cycles and verticals.

### `SRC-PASSPORT-ICAO`
- **Authority:** Ministry of External Affairs, Government of India — Passport Seva (`mportal.passportindia.gov.in`)
- **Document:** *Guidelines for ICAO Compliant Photographs for Passport Applications*
- **Exact URL:** `https://mportal.passportindia.gov.in/pdf/Guidelines_for_ICAO_Compliant_Photographs_for_Passport_Applications.pdf`
- **Publication / Applicability Date:** Active official Passport Seva mPortal ICAO specification PDF; verified live `2026-11-13`.
- **Claims supported:**
  - Uploaded passport photographs must be colour, `630×810` pixels, with a white background and head/top-of-shoulders framing where the face occupies `80–85%` of the photograph.
  - Explicit prohibition: **"Photos should be unaltered by computer software."**
  - Requires uniform lighting without face or background shadows, natural skin tones, open clearly visible eyes, no flash reflections or eyeglass glare (glasses to be removed to avoid reflections), and no red-eye.
- **Used in slugs:** `passport-exam-form-white-background`

### `SRC-PASSPORT-BOOKLET`
- **Authority:** Ministry of External Affairs, Government of India — Passport Seva (`passportindia.gov.in`)
- **Document:** *Instructions for Filling of Passport Application Form and Supplementary Form (Booklet V3.0)*
- **Exact URL:** `https://www.passportindia.gov.in/AppOnlineProject/pdf/ApplicationformInstructionBooklet-V3.0.pdf`
- **Publication / Applicability Date:** Version 3.0, published August 2020. Both `https://www.passportindia.gov.in/AppOnlineProject/pdf/ApplicationformInstructionBooklet-V3.0.pdf` and `https://portal5.passportindia.gov.in/Online/pdf/ApplicationformInstructionBooklet-V3.0.pdf` served this V3.0 booklet on `2026-11-13`, so the booklet remains available; whether V3.0 is the newest published version was not established. Applicants should confirm the current instruction booklet and the DPC/SPC/CSC pasted-photo rule on the Passport Seva site before relying on it.
- **Claims supported:**
  - A pasted photograph is **not required** for applications submitted at a Passport Seva Kendra (PSK) or Post Office Passport Seva Kendra (POPSK).
  - Physical applications submitted at other collection centres (DPC/SPC/CSC) require one recent `4.5 cm × 3.5 cm` colour photograph on plain white background (dark dress recommended), printed on photo paper (not computer paper), unsigned, with full frontal face and both ears visible.
- **Used in slugs:** `passport-exam-form-white-background`

- **Mirror URL:** `https://portal5.passportindia.gov.in/Online/pdf/ApplicationformInstructionBooklet-V3.0.pdf` (same V3.0 content, served on `2026-11-13`).


### `SRC-UPSC-CAF-2026`
- **Authority:** Union Public Service Commission (`upsc.gov.in`)
- **Documents:**
  1. *Examination Notice No. 08/2026-CAPF — Central Armed Police Forces (Assistant Commandants) Examination, 2026* (`https://www.upsc.gov.in/sites/default/files/ExamNotifi_CAPF_AC_Exam_2026_Eng_20022026.pdf`, dated `2026-02-20`, for 2026 examination cycle)
  2. *Indian Economic Service / Indian Statistical Service Examination, 2026 Notice* (`https://www.upsc.gov.in/sites/default/files/Exam_Notification_IES_ISS_Eng_11022026.pdf`, dated `2026-02-11`, for 2026 examination cycle)
- **Publication / Applicability Date:** Published `2026-02-11` and `2026-02-20` for 2026 UPSC Common Application Form (`upsconline.nic.in`) examinations; verified `2026-11-13`.
- **Claims supported:**
  - Candidates filling UPSC's 2026 Common Application Form (CAF) must **both** upload a scanned `.jpg` photograph (`20 KB` to `200 KB`) **and** capture a live photograph during registration.
  - For signature upload on the 2026 CAF, candidates must **sign three times (one below the other) on plain white paper using black ink** and upload the scanned `.jpg` file (`20 KB` to `100 KB`).
- **Used in slugs:** `passport-exam-form-white-background`, `remove-background-from-signature-png`

### `SRC-UPSC-ESE-2026`
- **Authority:** Union Public Service Commission (`upsc.gov.in`)
- **Document:** *Examination Notice No. 02/2026-ENGG — Engineering Services Examination, 2026*
- **Exact URL:** `https://www.upsc.gov.in/sites/default/files/Notif-ESEP-26-Engl.pdf`
- **Publication / Applicability Date:** Dated `2025-09-26` for the 2026 Engineering Services cycle (same `20 KB–300 KB` `.jpg` rule also published in `https://www.upsc.gov.in/sites/default/files/Notif-CSO-2025-CSteno-2019-2021-Engl.pdf`, application window ending `2025-10-07`).
- **Claims supported:**
  - Demonstrates intra-commission variability: specifies scanned `.jpg` photograph and signature between `20 KB` and `300 KB` each, proving that even UPSC file-size windows differ across notifications.
- **Used in slugs:** `passport-exam-form-white-background`, `remove-background-from-signature-png`

### `SRC-SSC-CAPF-2026`
- **Authority:** Staff Selection Commission, Government of India (`ssc.gov.in`)
- **Document:** *Notice — Sub-Inspector in Delhi Police and Central Armed Police Forces Examination, 2026* (`E/37/2026-C-2`)
- **Exact URL:** `https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_capf_2026.pdf`
- **Publication / Applicability Date:** 2026 examination notice (online application window `2026-09-10` to `2026-09-30`); verified live `2026-11-13`.
- **Claims supported:**
  - Candidate does not upload a pre-existing portrait file; the SSC application module captures a **live photograph** (plain background, good lighting, camera at eye level, no cap, mask, or spectacles).
  - Candidate must upload a scanned signature in `JPEG` format (`10 KB` to `20 KB`, dimension about `4.0 cm × 2.0 cm`); blurred or miniature signatures are summarily rejected.
- **Used in slugs:** `passport-exam-form-white-background`, `remove-background-from-signature-png`

### `SRC-SSC-SCRIBE-OTR`
- **Authority:** Staff Selection Commission, Government of India (`ssc.gov.in`)
- **Document:** *Candidate Portal — One Time Registration for Scribe*
- **Exact URL:** `https://ssc.gov.in/candidate-portal/one-time-registration/scribe-otr-details`
- **Publication / Applicability Date:** Updated December 2025; active live SSC Candidate Portal registration page verified `2026-11-13`.
- **Claims supported:**
  - Unlike candidate exam forms that use live capture, SSC's Scribe OTR form accepts an uploaded photograph (`20 KB` to `50 KB` in `JPEG/JPG`, about `3.5 cm × 4.5 cm`, frontal face without spectacles/cap/mask) and an uploaded horizontally aligned signature (`10 KB` to `20 KB` in `JPEG/JPG`, about `6.0 cm × 2.0 cm`), confirming workflow-specific variation within SSC.
- **Used in slugs:** `passport-exam-form-white-background`, `remove-background-from-signature-png`

### `SRC-IBPS-PO-XVI-2026`
- **Authority:** Institute of Banking Personnel Selection (`ibps.in`)
- **Documents:**
  1. *Detailed Notification — Common Recruitment Process for Recruitment of Probationary Officers / Management Trainees in Participating Banks (CRP PO/MT-XVI for Vacancies of 2027-28)* (`https://www.ibps.in/wp-content/uploads/Detailed-Notification_CRP-PO-XVI_Final_V1_30.06.2026.pdf`, dated `2026-06-30`)
  2. *Tentative Calendar of Online CRP for RRBs & PSBs (2025-2026)* (`https://www.ibps.in/wp-content/uploads/IBPS_CALENDAR_2025-26-for-Website.pdf`, dated `2025-01-15`)
- **Publication / Applicability Date:** Published `2026-06-30` (CRP PO/MT-XVI for 2027–28 vacancies) and `2025-01-15` (CRP XV 2025–26 summary); verified `2026-11-13`.
- **Claims supported:**
  - Requires uploading a recent passport-style colour photograph (`4.5 cm × 3.5 cm`, `200×230` pixels preferred, `20 KB` to `50 KB` in `.jpeg` format) against a light-coloured, preferably white background, **in addition to** capturing a live photograph via webcam or mobile phone during registration.
  - Requires uploading the applicant's signature signed on white paper with black ink (`140×60` pixels preferred, `10 KB` to `20 KB` in `.jpeg` format; signatures in capital letters are not accepted).
- **Used in slugs:** `passport-exam-form-white-background`, `remove-background-from-signature-png`

### `SRC-IBPS-REGIONAL-SCAN`
- **Authority:** IBPS Registration Portal (`ibpsreg.ibps.in`)
- **Document:** *Guidelines for Scanning and Uploading Photograph & Signature (RIICO Recruitment Cycle)*
- **Exact URL:** `https://ibpsreg.ibps.in/riicosep25/uploads/loadpdf.php?file=k7m5p+fQ15e6w9TW0NzK2pubmdWyp5rXppSo3aRx&t=1LHArOLA2di0yczXwNDa083LmNWypw%3D%3D`
- **Publication / Applicability Date:** September 2025 recruitment portal guidelines; verified `2026-11-13`.
- **Claims supported:**
  - Certain IBPS-administered recruitment notices require signing inside a `7 cm × 2 cm` box on white A4 paper, scanning at minimum `200 dpi` (`140×60` pixels, `10–20 KB` `.jpg`/`.jpeg`), and explicitly state: *"Photograph of signature taken using hand mobile phone will not be accepted."*
- **Used in slugs:** `remove-background-from-signature-png`

### `SRC-NTA-UGCNET-2025`
- **Authority:** National Testing Agency (`nta.ac.in` / `ugcnet.nta.ac.in`)
- **Documents:**
  1. *UGC-NET June 2025 Information Bulletin* (`https://ugcnet.nta.ac.in/images/information-bulletin-for-ugc-net-june-2025-16042025.pdf`, published `2025-04-16`)
  2. *NTA Public Notice — Specifications for Candidate's Photograph and Signature* (`https://nta.ac.in/Download/Notice/Notice_20200716081822.pdf`, dated `2020-07-15`)
- **Publication / Applicability Date:** Published `2025-04-16` (UGC-NET June 2025 cycle) and `2020-07-15` (NTA general notice); verified `2026-11-13`.
- **Claims supported:**
  - Candidate photograph must be uploaded in `JPG/JPEG` format (`10 KB` to `200 KB`), showing `80%` face (without mask) including ears against a white background, with no cap or goggles; NTA also warns that Polaroid and computer-generated photos are not acceptable.
  - Candidate signature must be full signature in running handwriting (capital-letter full name is rejected) on white paper with blue or black ink pen, scanned in `JPG/JPEG` format between `4 KB` and `30 KB`.
- **Used in slugs:** `passport-exam-form-white-background`, `remove-background-from-signature-png`

Applicability note: the photograph figures (10 KB to 200 KB, 80% face including ears on a white background) and signature figures (4 KB to 30 KB, running hand, not capital letters) above are quoted from the dated cycle bulletin listed here, together with the NTA public notice of 15.07.2020. NTA publishes a bulletin for each session, so these are illustrative: applicants must follow the notification and information bulletin for their own exam cycle. Do not present these figures as permanent NTA rules.


### `SRC-AMAZON-IN-IMAGES`
- **Authority:** Amazon Seller Central India (`sellercentral.amazon.in`)
- **Documents:**
  1. *Uploading Images — Official Amazon India Moderator Guide (`Noor_Amazon_`, referencing Seller Central Help `G1881`)* (`https://sellercentral.amazon.in/seller-forums/discussions/t/41489053-40d6-493e-b5c1-dd8611082354`, published `2025-03-05`, referencing `https://sellercentral.amazon.in/help/hub/reference/G1881`)
  2. *Amazon-Compliant Product Images (`sellercentral.amazon.in`)* (`https://sellercentral.amazon.in/seller-forums/discussions/t/3cd8bb69-073a-4e6e-83f2-42c71cbbde17`, updated `2025-12-19`)
- **Publication / Applicability Date:** Published `2025-03-05` / updated `2025-12-19`; verified live `2026-11-13`.
- **Claims supported:**
  - Amazon India MAIN product image requires a pure white background (`RGB: 255, 255, 255`), product occupying at least `85%` of the image frame, full product in frame without props/unincluded accessories/packaging (unless packaging is a product feature), and zero text, logos, borders, watermarks, or badges.
  - Technical image requirements: `500` to `10,000` pixels on the longest side (`1,000+` pixels preferred to enable zoom); accepted formats are `JPEG` (preferred), `TIFF`, `PNG`, and non-animated `GIF`.
  - Category-specific rules vary even on Amazon.in (e.g., footwear single shoe left-facing at 45°; adult clothing on standing model; children's clothing and clothing accessories/multipacks flat-lay with no model).
- **Used in slugs:** `amazon-flipkart-meesho-product-white-background`

Citation note (2026-11-13): the authoritative Seller Central Help page (G1881, https://sellercentral.amazon.in/help/hub/reference/G1881) redirects to the Amazon seller sign-in wall and could not be verified publicly. The figures above therefore rest on the public Amazon-moderated Seller Forums threads listed here. Do not describe them as quoted from Amazon's official help documentation. Amazon India sellers should confirm the current wording inside their own Seller Central account.


### `SRC-FLIPKART-LISTING`
- **Authority:** Flipkart Seller Hub (`seller.flipkart.com`)
- **Document:** *How to List Products on Flipkart Seller Hub?*
- **Exact URL:** `https://seller.flipkart.com/seller-blog/how-to-list-products-on-flipkart`
- **Publication / Applicability Date:** Dated `2026-06-29` on Flipkart Seller Hub; verified live `2026-11-13`.
- **Claims supported:**
  - Flipkart Seller Hub manual listing workflow instructs sellers to upload high-resolution, multi-angle product images on a white background (adding lifestyle shots where applicable) and routes listings through Flipkart quality check (QC) approval.
- **Used in slugs:** `amazon-flipkart-meesho-product-white-background`

### `SRC-FLIPKART-FASHION`
- **Authority:** Flipkart Seller Hub (`seller.flipkart.com`)
- **Document:** *8 Essential Tips to Master E-commerce Fashion Photography*
- **Exact URL:** `https://seller.flipkart.com/seller-blog/ecommerce-fashion-photography`
- **Publication / Applicability Date:** Published `2023-07-19` (page metadata updated `2023-10-16`); active Flipkart Seller Hub guide verified live `2026-11-13`.
- **Claims supported:**
  - Flipkart fashion photography guidance explicitly recommends neutral backgrounds including **white, grey, or beige walls** (or category-appropriate simple/textured backdrops) and model/mannequin/flat-lay positioning, proving Flipkart does not mandate pure `#ffffff` cutouts across every fashion vertical.
- **Used in slugs:** `amazon-flipkart-meesho-product-white-background`

### `SRC-MEESHO-CATALOG`
- **Authority:** Meesho Supplier Panel (`supplier.meesho.com`)
- **Documents:**
  1. *Learn How to Sell on Meesho* (`https://supplier.meesho.com/how-it-works`, published `2022-04-21`, active supplier onboarding page)
  2. *Sell Accessories Online & Sell Kurtis Online on Meesho* (`https://supplier.meesho.com/sell-online/accessories` and `https://supplier.meesho.com/sell-online/kurtis`, active 2026 category supplier pages)
- **Publication / Applicability Date:** Active official `supplier.meesho.com` documentation, verified `2026-11-13`.
- **Claims supported:**
  - Detailed category-specific image guidelines are available inside the Meesho Supplier Panel. The old product-count claim is omitted because its public source could not be re-verified.
  - Public category upload guides specify uploading a clear front product image in **`JPEG` format** without any logo, watermark, prop, or partial product view.
- **Used in slugs:** `amazon-flipkart-meesho-product-white-background`

### `SRC-MYNTRA-CATALOG`
- **Authority:** Myntra Seller University (`seller-university.myntra.com`)
- **Documents:**
  1. *Listing and Cataloging* (`https://seller-university.myntra.com/listing-and-cataloging/`)
  2. *Apparels — Category Guidelines* (`https://seller-university.myntra.com/apparels/`)
- **Publication / Applicability Date:** Active 2026 Myntra Seller University training portal modules; verified `2026-11-13`.
- **Claims supported:**
  - Myntra DIY and MAS Cataloging use category-specific image guideline documents (covering Ethnic Wear, Men's Wear, Women's Western Wear, Innerwear, Kids' Wear, etc.) alongside dedicated makeup/hair styling and sizing rules, so sellers must follow their vertical's cataloging sheet rather than assuming an isolated pure-white cutout is accepted.
- **Used in slugs:** `amazon-flipkart-meesho-product-white-background`

### `SRC-GOOGLE-FAQPAGE`
- **Authority:** Google Search Central (`developers.google.com`)
- **Document:** *FAQPage Structured Data & Google Search Documentation Updates*
- **Exact URL:** `https://developers.google.com/search/docs/appearance/structured-data/faqpage`
- **Publication / Applicability Date:** Policy updated August/September 2023; active Google Search Central documentation verified `2026-11-13`.
- **Claims supported:**
  - Google Search displays FAQ rich results **only for well-known, authoritative government and health websites**. Implementing `FAQPage` JSON-LD on `clearcutt.in` maintains clean 1:1 structured-data parity with visible page FAQs, but does **not** make Clearcut eligible for Google FAQ rich results.
- **Used in slugs:** Referenced in `editorialNotes.faqSchemaEligibility` across all four pages.

---

## 3. Corrected Integration Notes for Z.ai Infrastructure Merge

When Z.ai wires `docs/seo/india-page-content.json` into `scripts/seo.mjs` and the build pipeline:

1. **Title & Meta Length Guidance (Not Ranking Guarantees):** Each approved `renderedTitle` (`<60` chars including ` | Clearcut`) and `description` (`<155` chars) is editorial length hygiene to reduce visual truncation—not a ranking factor, ranking timeline promise, or guarantee against Google rewriting titles/snippets.
2. **1:1 `FAQPage` Schema Without Rich-Result Claims:** Render the 5 `faqs` per page in visible HTML and serialize the exact same `question`/`answer` strings into `FAQPage.mainEntity` JSON-LD, while recognizing `clearcutt.in` is not a government/health site and is therefore ineligible for Google Search FAQ rich results (`SRC-GOOGLE-FAQPAGE`). Never emit `AggregateRating` or `Review` schema.
3. **CSP & Real Visual Evidence Only:** `scripts/seo.mjs` currently sets `default-src 'none'` without `img-src 'self'` on generated guides, which blocks images. Add `img-src 'self'` only when embedding genuine, unretouched Clearcut output images (with recorded input dimensions, model, date, and brush/trim state). Never publish AI-generated or edited mockups as model outputs.
4. **Sitemap, `llms.txt`, and Search Console Scope:** Adding these four slugs expands `dist/sitemap.xml` from `10` to `14` URLs (requiring matching updates in `scripts/verify-dist.mjs` and `scripts/verify-live.mjs`, plus guide links in `public/llms.txt`). After deployment, resubmit `https://clearcutt.in/sitemap.xml` and use URL Inspection / Request Indexing **only for canonical HTML pages**—do **not** submit `/llms.txt` to Request Indexing.


Illustrative-cycle note: SRC-SSC-CAPF-2026 (application window 10.09.2026-30.09.2026), SRC-UPSC-CAF-2026 (notices dated 11.02.2026 and 20.02.2026), SRC-UPSC-ESE-2026 (26.09.2025) and SRC-IBPS-REGIONAL-SCAN (September 2025) are cited to show that photo and signature rules differ by commission, workflow and even notice. Each of those cycles may be closed by the time this page is read; applicants must read the notification for their own exam cycle.


## Release corrections applied

The content corrections in release-corrections.json were applied on 2026-11-13. Signature-specific segmentation outcomes remain unbenchmarked; public copy states uncertainty and does not promise ink-only transparency or claim observed sheet-selection behaviour. Exact-size exam examples remain tied to the cited notification cycle.
