import { readFileSync, writeFileSync } from 'node:fs';
for (const file of ['dist/transformers.js','dist/transformers.web.js','src/backends/onnx.js']) {
 const path = `node_modules/@huggingface/transformers/${file}`;
 let text = readFileSync(path,'utf8');
 for (const [before, after] of [['webInitChain.then(load)', 'webInitChain.then(load, load)'], ['webInferenceChain.then(run)', 'webInferenceChain.then(run, run)']]) {
  if (!text.includes(before) && !text.includes(after)) throw new Error(`Runtime patch does not match ${file}`);
  text = text.replaceAll(before,after);
 }
 writeFileSync(path,text);
}

// Transformers.js 4.3.0 otherwise requests the default GPU again for FP16.
// Check the adapter already selected by the editor and passed to ONNX.
for (const file of ['dist/transformers.js', 'dist/transformers.web.js', 'src/utils/dtypes.js']) {
 const path = `node_modules/@huggingface/transformers/${file}`;
 let text = readFileSync(path, 'utf8');
 if (file === 'src/utils/dtypes.js') {
  const before = "import { apis } from '../env.js';";
  const after = "import { apis, env } from '../env.js';";
  if (!text.includes(before) && !text.includes(after)) throw new Error(`Runtime patch does not match ${file}`);
  text = text.replace(before, after);
 }
 const before = 'const adapter = await navigator.gpu.requestAdapter();';
 const after = 'const adapter = env.backends.onnx?.webgpu?.adapter ?? await navigator.gpu.requestAdapter();';
 if (!text.includes(before) && !text.includes(after)) throw new Error(`Runtime patch does not match ${file}`);
 writeFileSync(path, text.replace(before, after));
}
