# Third-party notices

Clearcut uses an adapted BG0 browser engine from https://github.com/opencoredev/bg0 (commit 86add82f03e23fadf63ea9262a3984ddbc77e772), Apache License 2.0. See /BG0-LICENSE.txt in this distribution and vendor/bg0/LICENSE in source. Modifications: fast model selection, omission of HEIC decoding and iOS assets. The upstream Transformers runtime recovery patch is applied deterministically during builds.

BiRefNet full: naddy24/birefnet-512-webgpu at ca02a86c094927479e2be583abe87f8ea73fcfda, derived from onnx-community/BiRefNet_512x512-ONNX and ZhengPeng7/BiRefNet_512x512. MIT model license.
BiRefNet lite: studioludens/birefnet-lite-512 at 4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7, derived from ZhengPeng7/BiRefNet_lite. MIT model license.
Model cards: https://huggingface.co/naddy24/birefnet-512-webgpu and https://huggingface.co/studioludens/birefnet-lite-512 . Upstream model project: https://github.com/ZhengPeng7/BiRefNet . Model weights are downloaded at runtime, not included in this site archive.

Transformers.js: https://github.com/huggingface/transformers.js, Apache-2.0, copyright Hugging Face. License: /TRANSFORMERS-LICENSE.txt.
ONNX Runtime: https://github.com/microsoft/onnxruntime, MIT, copyright Microsoft Corporation. License: /ONNX-LICENSE.txt. Runtime artifacts download from a pinned jsDelivr path.

The HEIC and iOS native runtimes are not distributed or loaded by this application.




Current website artwork: original AI-generated imagery created for Clearcut on 2026-10-23 using the built-in image generation tool. Generation prompts and provenance are documented in ARTWORK.md in the source repository. Gallery cutouts are illustrative artwork, not measurements of Clearcut inference quality.

Poppins and Open Sans: SIL Open Font License; license files in fonts/. Canva Sans typeface is recorded separately from the removed reference images: https://static.remove.bg/fonts/canva-sans-latin.woff2 . Font reuse permissions remain unverified.

Mobile/low-memory model: U²-NetP by Xuebin Qin et al., Apache-2.0 (https://github.com/xuebinqin/U-2-Net). RemBG ONNX export mirrored at https://huggingface.co/edgetools/u2netp, pinned revision 25dee37ab19c5b6ad64ba6578eba63f1ae07720c. SHA-256: 309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8. Uses the 320×320 RGB normalization and fused saliency output described by rembg. Weights download at runtime; no photo is uploaded.
