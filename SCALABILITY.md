# Capacity plan: 1,000–2,000 concurrent visitors

## Status
The source uses browser-local inference, not a shared inference server. This removes the centralized GPU bottleneck but does not prove production capacity. No 2,000-user load test has been run. Security/backend changes in PR #1 are not deployed because backend authentication is unavailable.

## Cold-cache transfer estimate
| New users | Lite 98,484,532 bytes each | Full 473,435,223 bytes each |
| --- | --- | --- |
| 1,000 | 98.48 GB | 473.44 GB |
| 2,000 | 196.97 GB | 946.87 GB |
These are decimal weight-only estimates. Configs, JavaScript, WASM, retries and possible Full-to-Lite fallback add transfer. A full-to-lite fallback can download both weights. Weights come from pinned Hugging Face URLs, not GitHub Pages; model bytes do not count toward the site's GitHub Pages bandwidth. Warm browser cache avoids some repeated transfers but can be evicted.

## Bottlenecks and controls
| Layer | Behavior under a burst | Required control |
| --- | --- | --- |
| Static site | CDN serves HTML, scripts, images | Appropriate production host, cache headers, compressed media, verify service limits |
| Model host | Thousands of simultaneous 98/473 MB downloads | Confirm host terms, CDN capacity and throttling; provision an authorized mirror/CDN if needed |
| User device | Each phone/laptop runs its own inference | Worker responsiveness, Lite default, cancel, memory checks, full-model fallback, physical-device tests |
| Auth/API | Authenticated requests and Firebase key fetches scale with visitors | Cache verified JWKS by provider cache policy, bounded refresh, rate limits, timeout/backoff |
| Database | Membership reads and session records | Indexed queries, deduplication, quotas, retention and realistic read/write budget |
| Payments | Checkout/webhooks have separate quotas | Idempotency, capture verification, retry/reconciliation; never load-test live payments |
| Logs | Every API outcome produces an event | Restrict access, bounded retention, monitor usage and avoid unbounded payloads |

## Hosting limits checked 12 November 2026
GitHub Pages documents a soft 100 GB/month bandwidth limit, possible 429 throttling, and restrictions on primarily commercial SaaS/e-commerce use. The paid membership product should move to an appropriate production host before being promoted as a scalable commercial service. The current authorized Pages deployment is an existing project release, not proof of hosting suitability for commercial scale.
Cloudflare Workers Free documents 100,000 daily requests shared across scripts, plus CPU and database limits. A daily quota is not a concurrent-user capacity guarantee. The active account plan and backend provider remain unverified.
Sources: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits and https://developers.cloudflare.com/workers/platform/limits/ .

## Acceptance process before claiming 2,000-user readiness
1. Confirm production domain, backend, hosting plan, model-delivery rights, service limits and budget. Keep image processing usable without login if optional account services fail.
2. Use a dedicated staging host/database and test identities. Mock Firebase verification and Razorpay only in staging; no bypass may reach production.
3. Ramp through 100, 500, 1,000 and 2,000 virtual users against authorized first-party staging endpoints. Record arrival rate and request mix, not only virtual-user count. Do not direct a stress test at Hugging Face, Google or Razorpay.
4. Separate static-delivery tests, cold-cache download tests, warm-cache processing, membership reads, session recording and webhook replay tests. Measure p50/p95/p99 latency, error rate, resource usage and quota consumption. Abort on unexpected errors or budget thresholds.
5. Test real desktop and Android browsers for navigation/cancellation responsiveness and memory pressure while inference runs. A server load test cannot establish phone inference speed.
6. Establish release targets before the run and publish the measured results, traffic mix and environment. Until then, label 2,000 concurrent users as a target, not an achieved resume metric.

## Current access blockers
The connected GitHub app can release the frontend. Cloudflare CLI reports unauthenticated; no Cloudflare integration is available in this session. Backend migrations, model CDN provisioning, account quotas, production rate limits and DNS/hosting migration cannot be configured through GitHub repository contents alone. Do not store provider tokens in this public repository.
