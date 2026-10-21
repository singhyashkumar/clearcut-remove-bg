What this repo does:
Clearcut Remove BG is a static browser application. The visitor's device downloads the model and performs background removal and editing. Expected load is many independent visitors; there is no shared application image-processing server, image database, account system, or API-key store.

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
