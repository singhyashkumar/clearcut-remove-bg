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
