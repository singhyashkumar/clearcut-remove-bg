# Clearcut security and performance checklist

Audit baseline: `main`, commit `81605e69cdd2c72d7c2e5a2d7c6884046a4f36e9`, inspected 12 November 2026 through the connected GitHub app. This document separates implemented code from live deployment evidence. No production deployment has been performed for this change.

## Model map

| Mode | Model and pinned revision | ONNX file | Declared download size | Selection |
| --- | --- | --- | --- | --- |
| Standard/default (`fast`) | `studioludens/birefnet-lite-512` at `4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7` | `onnx/model_fp16.onnx` | 98,484,532 bytes = 98.48 MB / 93.92 MiB | Lite only; WebGPU when admitted, then WASM |
| Detailed (`quality`) | `naddy24/birefnet-512-webgpu` at `ca02a86c094927479e2be583abe87f8ea73fcfda` | `onnx/model_fp16.onnx` | 473,435,223 bytes = 473.44 MB / 451.50 MiB | Full when admitted; Lite fallback |

Definitions: `vendor/bg0/models.ts:14–31`. Both are FP16 BiRefNet background segmentation models with 512×512 inference inputs. They are not language models. Sizes above are repository constants, not independently measured downloads. Configs and ONNX runtime files add transfer overhead. The remembered 98 MB matches; 481 MB differs by approximately 7.56 MB from the current full-model constant. The source does not establish why 481 MB was remembered. No active 4.6 MB model appears in the model definitions or selection queue.

Weights load from `https://huggingface.co/<model-id>/resolve/<revision>/onnx/model_fp16.onnx` (`models.ts:modelUrl`); they are not committed model binaries. `AutoProcessor.from_pretrained` loads the processor/config and `AutoModel.from_pretrained` uses the same model ID/revision, `dtype: 'fp16'`, and the selected device (`vendor/bg0/index.ts:loadEngine`). Browser cache `transformers-cache` has an IndexedDB fallback (`getModelCache`); engine instances are reused in memory.

`src/main.js:processFile` dynamically imports the engine and invokes `removeBackground` for file selection, drop, paste and example actions. `removeBackground` filters Standard to Lite; Detailed keeps the admission queue. `runInference` calls the processor, then `engine.model({input_image:pixelValues})`, taking `logits` or `output_image` and applying sigmoid. Detailed refinement may call the same selected engine again on a subject crop (`refinement.ts:createMaskRefinement`); this is not a third model.

Detailed GPU order: Full/WebGPU → Lite/WebGPU → Lite/WASM. Full GPU requires a non-fallback adapter, shader-f16, no reported RAM below 4 GB, maxBufferSize ≥256 MiB and maxStorageBufferBindingSize ≥128 MiB. If no GPU choice was admitted, eligible CPU devices (≥4 logical cores, no reported RAM below 4 GB, non-iOS) use Full/WASM → Lite/WASM. Otherwise Lite/WASM. Full is not retried on CPU after GPU failure. A failed Lite GPU path disables GPU retries for that browser identity; a suspected full-model tab crash blocks Full for a week. A startup timeout stops the queue and asks for reload. Corrupt cache entries get one fresh-download retry. The iOS module returns an unsupported-device error and loads no separate model.

## Completed in this branch

- [x] Keep both model IDs, pinned revisions, FP16 precision and output dimensions unchanged.
- [x] Enable ONNX proxy-worker execution only for a completely CPU-only detected queue. The global proxy flag stays disabled for queues containing WebGPU, because ONNX does not support that combination.
- [x] Yield before engine startup/inference and extract full-resolution editor alpha channels in batches. Cancellation and stale-result checks prevent an old upload from replacing a newer one.
- [x] Structured backend request logs: server-generated request ID, fixed route name, status and accepted/rejected outcome. Unknown paths collapse to `unknown`; no query strings, request bodies, tokens, photos, email addresses, IPs or provider error payloads are copied into these logs.
- [x] Record verified Google sessions using signed Firebase UID/auth_time. Repeated page loads and token refreshes deduplicate by `(uid, auth_time)`.
- [x] Private login report: authenticated users can query only their own sessions. Passing another UID in a URL does not select that account.
- [x] Administrator session report: disabled unless a server-side UID allowlist is configured; requires a verified email and a Google sign-in within the last ten minutes. A client flag or email address alone grants no role.
- [x] Report responses use no-store. Sign-out/account changes clear the visible report and reject stale results.
- [x] Stream-bound JSON/payment webhook bodies before complete buffering: 16 KiB for JSON, 64 KiB for webhooks, including chunked and multibyte input.
- [x] Generic unexpected-error responses; request IDs returned for troubleshooting. Never send internal exception details to clients.
- [x] A 30-day report window and daily session cleanup at 03:15 UTC (08:45 IST). Physical deletion can lag the window by up to one scheduled interval; failed cleanup emits an operational failure.
- [x] Existing checks cover Firebase signature/audience/issuer/expiry, server-fixed price, signed payment verification, account ownership, captured amount/currency, and webhook replay handling.
- [x] Update on-page privacy text and provide the operational instructions below.
- [x] Add a read-only pull-request verification workflow with no deployment or repository write permissions. Branch protection must explicitly require this check.

## Validation

- New responsiveness tests verify byte-identical alpha extraction, cancellation between batches, a task-based fallback, and CPU-only/WebGPU proxy selection.
- Browser diagnostic: 25-megapixel extraction completed in 274 ms with seven animation-frame callbacks during the work. This is a synthetic loop measurement, not an end-to-end BiRefNet benchmark on a user's phone.
- Browser ONNX CPU proxy smoke test ran an Identity graph and returned 42 with proxy enabled. This verifies worker initialization and tensor transfer on the preview browser, not a full BiRefNet run.
- Security tests exercise real in-memory SQLite tables, session deduplication, cross-account denial, admin denial/default/recent-sign-in rules, redaction, byte limits and retention. Existing payment tests remain required.
- Frontend production build and Worker deployment dry-run passed. Dependency audit reports zero vulnerabilities. All 18 targeted security/UI/responsiveness/payment tests passed. The broad local run has one existing artwork test blocked by the missing 1.99 MB hero GIF: GitHub Contents returns an empty body for that large binary, and the blob connector rejects binary content. Existing repository artwork is untouched; the PR workflow runs against a complete checkout. Browser verification used the Vite preview, not the deployed production bundle.

## Deployment sequence — not completed

1. Review the diff and run `npm ci --ignore-scripts`, `npm test`, `npm audit --audit-level=high`, `npm run build`, and `npx wrangler deploy --dry-run`.
2. Confirm the actual domain and backend. The audited repository uses **clearcutt.in** (two t's), while the request says ClearCut.in. `VITE_PAYMENT_API_BASE_URL` is deployment configuration; the source alone does not verify its active value. The checked-in HTML also permits a Firebase Cloud Functions origin. Deploying the Worker will not update an unrelated Cloud Functions backend.
3. Use a staging backend first. Back up D1, inspect pending migrations, and apply `0003_login_sessions.sql` with `npx wrangler d1 migrations apply clearcut-payments --remote` only in the intended account/environment. Never run this blindly against a production database.
4. Configure `SECURITY_ADMIN_UIDS` through server configuration using verified Firebase UIDs from the owner. It is intentionally absent from committed config. Never use a VITE variable, public email, shared token, or default administrator identity.
5. Deploy the Worker before the frontend. Verify `/api/session`, the own-account report, admin denial and the cron trigger. The frontend should point to this exact backend. Frontend-first deployment leaves reports unavailable until the backend catches up.
6. Enable/review provider log access and retention. `wrangler.jsonc` enables explicit console logs but disables automatic invocation logs, to avoid adding raw request URL metadata. Provider platform/access logs are separate and may retain metadata; review their settings. No external monitoring vendor has been added. Existing free allowances apply and are not an unlimited-zero-cost guarantee.
7. Confirm deployed CSP, TLS, allowed origins, Google authorized domains and API restrictions. Remove localhost from the production origin allowlist after testing; keep it in a separate development config. Do not weaken the current CSP to make a test pass.
8. Verify Standard and Detailed on a physical Android device and desktop, with/without WebGPU, cold/warm cache, offline/network interruption, cancellation and large input. Confirm editor/download pixels and model quality before release.
9. Merge only after review and passing checks. The existing Pages workflow publishes on main pushes; this branch does not deploy itself.

## Remaining security work and limits

- [ ] Branch protection: the connected GitHub branch metadata reports `main` protection disabled. Require reviewed PRs and passing checks in repository settings. No administrative policy was changed here.
- [ ] Add provider-side request-rate limits/abuse controls and budget alerts. Existing checkout order-count checks are not a general API rate limiter and can race under concurrent requests. Logging is detection, not DDoS prevention.
- [ ] Configure operational alerts for repeated 401/403, payment/webhook rejections, 5xx, and retention failures. No alert destination or monitoring account has been supplied, so none was invented.
- [ ] Firebase revocation/disabled-user checks: the existing verifier validates signed token claims but does not query revocation status. A previously issued token can remain usable until expiry. Add a supported revocation check with the required server-side credentials before claiming immediate logout/revocation enforcement.
- [ ] Confirm provider log access, retention, backups and cleanup monitoring. Logs are not tamper-proof or a complete forensic history.
- [ ] Sign-in popup failures, client sign-out and processing activity remain local and are not accepted as authoritative server authentication records. The login report is a record of verified sessions first observed by this backend, not every Google authentication event or every physical device.
- [ ] Production headers, Firebase console restrictions, deployed backend identity, Cloudflare settings and physical-device performance remain unverified without those environments. No pentest or independent security certification has been performed.
- [ ] CPU fallback after a GPU attempt remains unproxied; flipping ONNX's global proxy setting after initialization risks breaking the runtime. GPU compilation, native canvas readback and PNG encoding can still cause pauses. A dedicated full inference/image worker is a larger follow-up requiring end-to-end device tests.

## Using reports and logs

After deployment, sign in and use **Login report** beside the account controls. Users see their own verified sign-in and first-observed times. For administrators, GET `/api/admin/security-report` with a fresh Firebase bearer token in the Authorization header from an allowlisted UID; do not put tokens in URLs, terminal history or shared screenshots. The response is capped at 200 current-window records; user reports at 100.

Filter hosting console logs by `type = security_request`, then route/status/request_id. Review access failures and unexpected 5xx, correlate with provider dashboards, and investigate without copying raw credentials. A 200 webhook outcome means accepted, including an ignored or duplicate event; it does not by itself prove that a new payment entitlement was granted. Payment request logs likewise record endpoint outcomes, not financial ledger entries. Consult the existing orders/webhook/entitlements tables for accounting truth.

If reports fail after deployment, verify migration and backend routing first. Session/report failures do not remove membership or charge users. Roll back the frontend and Worker to their known-good versions if needed; leave the additive login_sessions table in place until data retention is handled deliberately. Do not drop payment or account tables as rollback.

Sources: [ONNX environment flags](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html), [Chrome long tasks](https://developer.chrome.com/docs/modern-web-guidance/guides/performance/break-up-long-tasks), [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [Firebase sessions/revocation](https://firebase.google.com/docs/auth/admin/manage-sessions).
