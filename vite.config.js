import { defineConfig } from 'vite';
const runtimeBase='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/';
export default defineConfig({
 base:process.env.PUBLIC_BASE_PATH || '/',
 plugins:[{name:'site-metadata',transformIndexHtml(html){return process.env.PUBLIC_SITE_URL ? html.replaceAll('https://clearcut-local-studio.lilacsun4096.chatgpt.site/',process.env.PUBLIC_SITE_URL) : html;}},{name:'external-runtime-assets',enforce:'pre',transform(code,id){
  if(!id.includes('onnxruntime-web'))return;
  return code.replace(/new URL\(["'](ort-wasm[^"']+\.wasm)["'],\s*import\.meta\.url\)/g,(_,file)=>`new URL('${runtimeBase}${file}')`);
 }}],
 build:{target:'es2022'},server:{headers:{'X-Content-Type-Options':'nosniff'}},preview:{headers:{'X-Content-Type-Options':'nosniff'}}
});
