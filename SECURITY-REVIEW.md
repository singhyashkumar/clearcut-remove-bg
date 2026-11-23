What this repo does:
Clearcutt Remove BG is a static browser application. The visitor's device downloads the model and performs background removal and editing. Expected load is many independent visitors; there is no shared application image-processing server, image database, account system, or API-key store.

Checks completed, 21 October 2026:
- npm audit: zero known vulnerabilities, including development dependencies.
- Four image validation/editor utility tests passed.
- Current tracked application/build paths reviewed for image upload, unsafe HTML insertion, outbound logging, credentials and persistence. No selected-image upload, analytics, image logging or embedded credential found in that review.
- Production Worker error log query: no events returned for the previous 180 minutes (limit 25, errors_only=true). This is a bounded query, not a complete incident or WAF audit. No application security-event stream or infrastructure access-log API is provided by this app.
- Uploaded images and masks remain local; model files and ordinary request metadata reach Hugging Face/CDNs/jsDelivr and the host. The engine/model revisions and ONNX runtime version are pinned.
- Existing private host returned HTTP 401 to an unauthenticated request, confirming its access gate.

Should fix / launch constraints:
1. GitHub project Pages uses a URL subdirectory. Absolute sample fetch and notice links would break there. The publication changes make those paths use Vite's configured base, and the Pages workflow supplies the base and public canonical URL. The main Sites build keeps its root URL.
2. Pixel-count validation occurs after browser decoding. A crafted image can pressure the visitor's browser decoder before the 25 MP rejection. This does not expose a processing server, but maximum-size/device-memory stress is not fully validated. Keep the stated size limits; a future hosted ingestion service needs a sandboxed decoder and server-side limits.
3. Inference can take minutes on slow devices. Current cancellation discards the result/UI and signals cancellation but cannot guarantee immediate interruption of shared runtime work or model transfer. A dedicated worker would be a separate performance improvement.
4. External runtime/model assets are pinned by version/revision, but are not independently verified by this app with content hashes. The public CDN/model host remains a supply-chain dependency. Do not claim fully self-hosted inference or absolute leak-proof security.
5. GitHub Pages does not promise to apply a custom _headers file. The HTML CSP is shipped, while frame, permissions and other HTTP headers must be checked against actual public responses. No unsupported HTTP-header guarantee is made.

Publication safeguards prepared:
- Standard environment/private-key ignores; no production secret is needed.
- Fixed SHA pins for the GitHub-owned Actions.
- Read-only build token; Pages write/OIDC permissions limited to deployment job.
- Dependency install scripts disabled; tests and high-severity audit gate run before build/deploy.
- Push to main automatically builds and deploys; no repeated manual upload after normal Git authentication is established.

Verdict: suitable for an initial free evaluation launch with the limits above. Security review is not a penetration test or a guarantee that no vulnerability exists.
Not checked: physical mobile compatibility, detailed/full-model corpus, adversarial decoder fuzzing, independent penetration test, full host/WAF/access logs, or future backend/billing functionality.

## Login-session reporting and request security (Workstream 3, 22 November 2026)

What the session report records:
- The `login_sessions` D1 table (migration `0004_login_sessions.sql`) stores one row per `(uid, auth_time)` with a `first_seen_at` timestamp, indexed on `first_seen_at`. A row means a verified Firebase session first observed by Clearcutt's backend: the Firebase ID token's RS256 signature, issuer, audience, expiry and `auth_time` bounds were checked before anything was written.
- `POST /api/session` records the signed UID and signed `auth_time` of the caller. `GET /api/security-report` returns only the signed-in user's own rows (at most 100, newest first). `GET /api/admin/security-report` returns at most 200 rows across accounts for allowlisted administrators with a verified email and a sign-in no older than 10 minutes.

What it does not record, and what a record does not prove:
- No IP addresses, user-agent strings, email addresses, device or browser fingerprints, query strings, request bodies, image data, tokens or provider error details are stored in the session table or written to request logs.
- A session row is the first backend observation of a signed Firebase session, not a device inventory. It does not prove every physical device, and it does not prove every Google authentication event: sign-ins that predate the deployment, sessions whose tokens were never presented to the backend, and token refreshes (which reuse the original signed `auth_time`) are all invisible or deduplicated. Accuracy claim: "a verified Firebase session first observed by Clearcutt."

Retention:
- Reports and retention both use a 30-day window (`first_seen_at >= unixepoch() - 2592000`). A scheduled Worker trigger (cron `15 3 * * *` UTC in `wrangler.jsonc`) deletes rows older than 30 days daily. Cleanup failures emit one fixed operational event, `{"type":"security_maintenance","outcome":"retention_failed"}`, without database error details.

`SECURITY_ADMIN_UIDS` configuration:
- A server-side Worker secret/variable: a comma-separated list of exact Firebase UIDs. It is separate from `REVIEW_ADMIN_UIDS` (the review-moderation allowlist) and the two are not interchangeable. There is no default administrator identity; the endpoint denies access when the allowlist is missing, empty, or does not contain the caller's UID, and it independently requires a verified email and a sign-in within the last 10 minutes. Set it with `npx wrangler secret put SECURITY_ADMIN_UIDS` (or a Worker var) in the target environment only; never commit UIDs to this repository.

Inspecting request logs:
- The Worker emits one structured JSON line per request (except CORS preflights) with fixed fields only: `type`, `request_id`, `route`, `status`, `outcome`. Route labels come from a fixed allowlist; any other path is logged as `unknown`, so client-controlled values never become a route label. Every response carries a server-generated `x-request-id` header for correlating a user report with log lines.
- View logs with `npx wrangler tail clearcut-payments` or Cloudflare dashboard → Workers → `clearcut-payments` → Logs (observability with log capture is enabled in `wrangler.jsonc`; invocation logs are off). Filter by `type:security_request` or a specific `request_id`.

Staging migration and deployment sequence:
1. Run the validation suite: `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`, `npm run verify:dist`, `npx wrangler deploy --dry-run`. The GitHub Actions deployment run `45066996105` (merge commit `a323ec3`, 22 November 2026) successfully completed `npm ci --ignore-scripts`, typecheck, tests, build and `verify:dist`, so the lockfile installs cleanly from a clean clone in CI. A local sandbox needing an `npm install --no-package-lock --ignore-scripts` fallback is an environment quirk of that machine, not evidence that clean CI installation fails; no lockfile desynchronization has been confirmed.
2. `npx wrangler d1 migrations apply clearcut-payments --local` applies migrations to the local D1 emulation (a local SQLite database on the development machine) only. It does not create or configure any remote staging environment and never touches remote data. The migration is additive — no existing table is altered — so rollback is a single statement: `DROP TABLE login_sessions;` (SQLite drops the table's associated index together with the table).
3. A separate staging configuration now exists: `wrangler.staging.jsonc`. It is completely separate from the production `wrangler.jsonc` — Worker name `clearcut-payments-staging`, D1 database `clearcut-payments-staging` (ID `160e532c-3c46-4193-a9e3-84f80a5db239`), `PAYMENT_MODE: test`, localhost-only allowed origins (`http://localhost:5173`, `http://127.0.0.1:5173`) and `workers_dev` enabled. The production `wrangler.jsonc` still targets the production Worker (`clearcut-payments`) and the production D1 database (`clearcut-payments`, ID `4e0a230f-2698-4f5f-b721-e0473c40021f`) and must not be used for staging. Staging secrets are set per environment and never committed: Razorpay TEST-mode keys and `SECURITY_ADMIN_UIDS` go in with `npx wrangler secret put <NAME> --config wrangler.staging.jsonc`; `SECURITY_ADMIN_UIDS` must never be configured as a public variable, and production credentials must never be copied into staging. Before running either staging command below, review `wrangler.staging.jsonc` and confirm the target database — the database name and ID in the command output must read `clearcut-payments-staging` / `160e532c-3c46-4193-a9e3-84f80a5db239`, never the production `clearcut-payments` / `4e0a230f-…`:
   - `npx wrangler d1 migrations apply clearcut-payments-staging --remote --config wrangler.staging.jsonc` (applies `worker/migrations` to the staging D1 database only; the migration is additive, and rollback is `DROP TABLE login_sessions;`)
   - `npx wrangler deploy --config wrangler.staging.jsonc` (deploys the `clearcut-payments-staging` Worker; verify the unauthenticated 401, session deduplication, cross-account report isolation and admin gating from step 4 against its `workers.dev` URL)
   These commands touch remote staging resources and must only be executed after reviewing the configuration and confirming the target database.
4. Production migration and deployment remain a separate, deliberate step from any staging work and require a D1 backup first (`npx wrangler d1 export` or a point-in-time restore). Only then run `npx wrangler d1 migrations apply clearcut-payments --remote`, deploy, and set the production allowlist. Never run migrations or deploys blindly against production, and never reuse staging secrets in production.

Known limitations:
- No immediate Firebase token revocation check: a recorded session relies on the ID token's signature and expiry at request time. Firebase token revocation (refresh-token reset or Admin SDK `checkRevoked`) is not implemented unless separately built and verified, so a row may exist for a session whose underlying Google grant was later revoked until the token expires.
- Retention runs daily at 03:15 UTC, so rows can persist up to ~24 hours past the 30-day boundary even though reports never return them.
- Session writes are best-effort: a D1 failure returns a generic 503 and is not retried; the user can simply retry.
- `first_seen_at` is recorded server-side at first observation; clock skew between the Worker and D1 `unixepoch()` is negligible but the value is not a client-reported event time.
- Request logs are fixed-field by construction, so troubleshooting relies on `x-request-id` correlation; no request payloads are retained anywhere for debugging.
- The frontend login-report interface is intentionally out of scope for this change.
