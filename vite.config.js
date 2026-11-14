import { defineConfig, loadEnv } from 'vite';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { seoPlugin } from './scripts/seo.mjs';
const runtimeBase='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/';
const artworkMasters=['animals.png','cars.png','efficiency.png','feature.png','graphics.png','hero.png','inspiration.png','people.png','products.png','hero-demo.mp4'];
export default defineConfig(({mode})=>{
const env=loadEnv(mode,process.cwd(),'');
const paymentApi=env.VITE_PAYMENT_API_BASE_URL||process.env.VITE_PAYMENT_API_BASE_URL;
const apiBase=env.VITE_API_BASE_URL||process.env.VITE_API_BASE_URL||paymentApi;
return {
 base:process.env.PUBLIC_BASE_PATH || '/',
 plugins:[{name:'site-metadata',transformIndexHtml(html,context){if(!context.server)html=html.replace(' http://127.0.0.1:5001','');if(apiBase){try{const origin=new URL(apiBase).origin;html=html.replace("connect-src 'self'",`connect-src 'self' ${origin}`);}catch{throw new Error('The configured API base URL must be valid.');}}return html;}},seoPlugin(),{name:'prune-artwork-masters',closeBundle(){const artwork=resolve(process.cwd(),'dist','artwork');for(const file of artworkMasters)rmSync(resolve(artwork,file),{force:true});}},{name:'external-runtime-assets',enforce:'pre',transform(code,id){
  if(!id.includes('onnxruntime-web'))return;
  return code.replace(/new URL\(["'](ort-wasm[^"']+\.wasm)["'],\s*import\.meta\.url\)/g,(_,file)=>`new URL('${runtimeBase}${file}')`);
 }}],
 build:{target:'es2022'},server:{headers:{'X-Content-Type-Options':'nosniff'},fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/functions/**']}},preview:{headers:{'X-Content-Type-Options':'nosniff'}}
};
});

