# Verification record — 2026-10-21

## Passed

- Production build: Vite 7.3.7 on Node.js 24.18.0.
- Four Node tests: empty/oversized/disguised uploads; supported magic bytes; alpha crop bounds including last pixel and empty mask; brush erase/restore.
- Full npm audit after remediation: zero known vulnerabilities at check time. This is an advisory scan, not a penetration test.
- Actual browser inference on the plant sample, fast/lite mode. Result canvas: 800x628; 288,906 fully transparent pixels, 195,952 opaque pixels, 17,542 partial-alpha pixels. Subject visibly separated from the background.
- Actual downloaded PNG inspected independently with Pillow: RGBA 800x628, alpha range 0–255. Trimmed export: RGBA 785x594, alpha range 0–255. Both saved with this delivery.
- Original/result toggle, transparent/white/photo backgrounds, erase, undo, restore and mask reset exercised in browser. White background produced [255,255,255,255] at top-left; photo background produced [237,240,245,255]. Erasing center reduced alpha to 0; undo restored original model alpha 10; restore brush recovered original-photo alpha 255.
- A disguised SVG named .png rejected through the actual file chooser with a useful error. No SVG executed.
- Cancel during preparation returned to the upload screen. Latest source includes guards against Cancel→new upload racing with dynamic engine import, and stale background-photo decodes overriding a newer selection.
- Layout screenshots at 390x844 and 1440x1000; no horizontal overflow (document scroll widths 375 and 1425 respectively).
- No browser error/warning logs in the inspected sample session.

## Privacy evidence and limits

Static review found no selected-image upload, analytics, beacon, server storage, API-key, or image logging path. Observed initial requests were GETs for the local sample, local JS, pinned model/config assets and pinned ONNX runtime. No image upload was observed. The CDP event buffer truncated during the long model transfer, so that capture is not a complete forensic network trace. Ordinary request metadata still goes to the static host, Hugging Face/CDNs and jsDelivr.

The first model download and inference took several minutes in this environment. Do not advertise guaranteed instant processing. Cache reuse reached the inference stage without another model download in the second test. Device/provider performance has not been benchmarked.

## Remaining coverage before a broad public release

- Detailed/full model, diverse hair/fur/glass/product scenes, quantitative quality comparisons, physical mobile devices and long-run memory stress are not validated.
- Drag/drop and clipboard intake are implemented but not individually exercised through the browser automation surface.
- Desktop browser and mobile layout checks do not establish iOS inference support; iOS and HEIC are explicitly unsupported.
- Interrupted network recovery, max-size raster decoder pressure, cross-browser/accessibility audit and an independent security test remain.
- Verify actual response security headers/HTTPS and rerun core processing on the hosted origin. The portable _headers file may not be honored by every static host; HTML CSP still protects document code.
- No remove.bg proprietary model access, source recovery or backend architecture verification was possible. The UI/workflow is an independent implementation with its own branding.

The source, unit checks, successful inference and exports are real; no claim of universal quality parity, perfect security, or unlimited free hosting is made.

## Clickable showcase update

The landing-page sample now toggles in place between the original JPEG and the actual previously generated transparent PNG. This demonstration uses precomputed local assets and does not start AI inference. The same photo, aspect ratio and framing are retained. The toggle is a native button with keyboard activation, descriptive labels and pressed state. Browser click and Enter activation were exercised. No upload, inference or server behavior was changed.

## Mobile failure follow-up — 2026-10-25

The initial mobile mitigation did not resolve the user's Android Chrome failure. The screenshot showed the deployed page and a caught generic processing error, not a closed tab. No physical Android device was available; do not claim physical-phone verification.

Actual single-threaded ONNX Runtime Web CPU tests on this host found that BiRefNet Lite fp16 at 512px could complete but reached about 2,704 MB process peak RSS with the JSEP runtime. Disabling CPU arena/memory-pattern reuse did not fix the footprint (about 2,847 MB). A U2NetP test through the standard CPU-only WASM build completed at about 351 MB; the actual hero-photo run with production RGB preprocessing and alpha normalization completed with 370 MB process peak RSS. These are host process observations, not measurements of Chrome's Android tab budget.

Mobile/low-memory devices now use a separate U2NetP 320px CPU path with a 4,574,861-byte model, immutable source revision and verified SHA-256. It loads a smaller CPU-only WASM binary, uses one thread, serializes cancelled/retried inference and disposes all input and output tensors. Desktop BiRefNet behavior is retained. An explicit Mobile selector allows exercising the same mobile path in a desktop browser; reload before switching runtime families. Large mobile working photos retain the earlier 2 MP / 2048px bounds. U2NetP can lose fine-edge detail; the upload note states this tradeoff.

The local hero inference returned alpha range 0–1, 75,076 nearly transparent mask pixels and 24,424 nearly opaque pixels out of 102,400. A composited result was rendered and visually inspected: subject retained, background removed, some residual edge fragments. No quality-parity claim. Error messages now retain stage, execution provider and sanitized underlying causes instead of replacing all failures with the same generic message.

Validation before deployment: clean npm ci; 31 passing Node tests; successful production build. New regression tests cover mobile routing in both quality modes, RGB/NCHW normalization, finite black-image preprocessing, mask normalization and sanitized failure context. Live browser inference and the user's physical-phone retest remain pending at commit time.

## Restore original quality by user request — 2026-10-25

The user confirmed the 4.6 MB mobile path works without errors but removes too much of the subject and explicitly requested the original approximately 98 MB model again. Standard now selects the original pinned BiRefNet Lite on Android as well as desktop. Device type no longer silently routes Standard or Detailed to U2NetP. Low memory (4.6 MB) remains an explicit selector. Existing mobile photo bounds and early bitmap release remain. Mobile ONNX sessions use a single WASM thread; existing provider selection and GPU-to-CPU fallback remain intact. Labels and the upload note describe the actual selected model. Runtime-family changes still require a reload to avoid mixing differently initialized ONNX builds.

Validation: 31 tests and production build pass; regression test explicitly covers Android and desktop defaulting to the original model. Prior direct WASM inference established that the original model runs on this host but needs much more memory than U2NetP. This change does not establish that a physical phone can run BiRefNet without the earlier memory failure. Physical Android verification remains pending.

Follow-up preference: the 4.6 MB option is hidden/disabled during the normal original-model flow and is offered only after a non-cancellation processing failure. Clicking the offer reloads into an explicit low-memory URL; the page says to choose the photo again. It never silently downgrades a successful original-model run. Invalid file validation and cancellation do not display the fallback. The user reports that the original model previously worked for several days on their phone and friends' phones; memory is a measured risk, not a confirmed explanation of their earlier caught error. Connection/cache/runtime failures remain possible; preserve diagnostics for the next observed error.

## Restore full original-quality pipeline — 2026-10-25

The user still reports worse quality after restoring the 98 MB model default. A diff against 9889cd1 found remaining behavior differences: original-mode photos on phones still passed through the new 2 MP / 2048px resize, model admission disallowed the full model on all phones and <=4 GB devices, and WASM thread settings were forced. The original engine file is now restored byte-for-byte from 9889cd1. Model admission matches that commit; the sole models.ts difference is the type union supporting the explicit fallback result. Standard and Detailed now pass the exact original compressed file to the original engine without the new downscaling. Only the opted-in low-memory model retains the resized photo path. Early bitmap release, cancellation handling, sanitized failure details and the user-requested error-only fallback remain.

The result status names the actual model and download size, to distinguish BiRefNet Lite (98 MB), BiRefNet Detailed (473 MB) and U2NetP (4.6 MB). No claim that these changes explain every observed quality difference without comparing the user's exact original and prior output. Validation: 32 tests pass, including exact file identity for both original modes and restored Android model admission; production build passes. Physical-phone retest remains pending.

## Remove 4.6 MB model — 2026-10-25

By explicit user request, removed the U2NetP runtime, tensor preprocessing, mode routing and photo-resize helpers, fallback controls, URL-mode handling, model type and active model notice. Removed its direct ONNX Runtime dependency declaration; ONNX Runtime remains as the original Transformers.js transitive dependency. Historical records above describe past versions. Kept the existing 98 MB Standard / 473 MB Detailed pipeline, original photo resolution, actual-model result status, early bitmap release and sanitized failure context. Retained original model-selection and error-diagnostic tests; deleted tests for removed functionality.

Validation: 26 retained tests pass; production build passes and no longer emits the mobile runtime chunk. The original models and engine remain unchanged.
