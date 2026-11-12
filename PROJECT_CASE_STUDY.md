# Clearcut — browser-based AI background remover

## Project overview
A web application that runs BiRefNet segmentation locally through Transformers.js and ONNX Runtime, preserving photo privacy and exporting transparent PNGs. Adapted from the Apache-2.0 BG0 engine; model weights and runtime are third-party components, not models trained by this project.

## Architecture
Vite and JavaScript frontend; FP16 BiRefNet Lite (98.48 MB) and Full (473.44 MB), pinned Hugging Face revisions, WebGPU/WASM selection, browser model caching, canvas cutout editor and PNG export. Existing Google authentication and Razorpay membership code are separate from image inference.

## Engineering work
- CPU-only ONNX inference uses a proxy worker; WebGPU queues keep proxy mode disabled for compatibility.
- Full-resolution alpha extraction yields between batches and checks cancellation, preserving pixels and dimensions.
- Automated tests cover model admission, alpha output, cancellation, payments and UI utilities. Pull-request CI runs tests, dependency audit, frontend build and Worker packaging dry-run.
- Security logging and protected login-report implementation are prepared separately in PR #1; they require backend access and migration before release.

## Measured evidence
A synthetic 25 MP alpha extraction took 274 ms with seven paint callbacks in the preview browser. An ONNX Identity graph returned 42 with CPU proxy enabled. These are diagnostic checks, not claims of equivalent end-to-end BiRefNet speed on every device. Full-model inference on physical phones remains to be benchmarked.

## Resume entry
**Clearcut | Browser-based AI Background Removal**
- Built and maintained an image-editing web application using JavaScript, Vite, Transformers.js, ONNX Runtime and pretrained BiRefNet segmentation models.
- Implemented CPU-worker inference and cooperative pixel processing to improve UI responsiveness while retaining image dimensions and model precision.
- Added automated validation and pull-request CI covering model selection, image utilities, cancellation and payment verification.

Describe security reporting as implemented in a review branch until its backend is deployed. Do not claim model training, zero security vulnerabilities in the whole application, unlimited free infrastructure, quantified user adoption or unmeasured speedups.
