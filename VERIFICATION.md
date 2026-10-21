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
