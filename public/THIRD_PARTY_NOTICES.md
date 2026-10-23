# Third-party notices

Clearcut uses an adapted BG0 browser engine from https://github.com/opencoredev/bg0 (commit 86add82f03e23fadf63ea9262a3984ddbc77e772), Apache License 2.0. See /BG0-LICENSE.txt in this distribution and vendor/bg0/LICENSE in source. Modifications: fast model selection, omission of HEIC decoding and iOS assets. The upstream Transformers runtime recovery patch is applied deterministically during builds.

BiRefNet full: naddy24/birefnet-512-webgpu at ca02a86c094927479e2be583abe87f8ea73fcfda, derived from onnx-community/BiRefNet_512x512-ONNX and ZhengPeng7/BiRefNet_512x512. MIT model license.
BiRefNet lite: studioludens/birefnet-lite-512 at 4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7, derived from ZhengPeng7/BiRefNet_lite. MIT model license.
Model cards: https://huggingface.co/naddy24/birefnet-512-webgpu and https://huggingface.co/studioludens/birefnet-lite-512 . Upstream model project: https://github.com/ZhengPeng7/BiRefNet . Model weights are downloaded at runtime, not included in this site archive.

Transformers.js: https://github.com/huggingface/transformers.js, Apache-2.0, copyright Hugging Face. License: /TRANSFORMERS-LICENSE.txt.
ONNX Runtime: https://github.com/microsoft/onnxruntime, MIT, copyright Microsoft Corporation. License: /ONNX-LICENSE.txt. Runtime artifacts download from a pinned jsDelivr path.

The HEIC and iOS native runtimes are not distributed or loaded by this application.

Sample photography: https://www.pexels.com/photo/green-leaf-plant-3097770/ under the Pexels license https://www.pexels.com/license/ .

Landing-page cat photo: Pexels photo 1170986, https://www.pexels.com/photo/1170986/ under https://www.pexels.com/license/. Original and BG0 cutout reused from the Apache-2.0 BG0 example assets.
Fonts: Poppins and Open Sans, SIL Open Font License; licenses in fonts/. Fonts are served locally.
