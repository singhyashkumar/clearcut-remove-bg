import { defineConfig, loadEnv } from 'vite';
const runtimeBase='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/';
export default defineConfig(({mode})=>{
const env=loadEnv(mode,process.cwd(),'');
const paymentApi=env.VITE_PAYMENT_API_BASE_URL||process.env.VITE_PAYMENT_API_BASE_URL;
return {
 base:process.env.PUBLIC_BASE_PATH || '/',
 plugins:[{name:'site-metadata',transformIndexHtml(html,context){if(!context.server)html=html.replace(' http://127.0.0.1:5001','');if(paymentApi){try{const origin=new URL(paymentApi).origin;html=html.replace("connect-src 'self'",`connect-src 'self' ${origin}`);}catch{throw new Error('VITE_PAYMENT_API_BASE_URL must be a valid URL.');}}return process.env.PUBLIC_SITE_URL ? html.replaceAll('https://clearcut-local-studio.lilacsun4096.chatgpt.site/',process.env.PUBLIC_SITE_URL) : html;}},{name:'external-runtime-assets',enforce:'pre',transform(code,id){
  if(!id.includes('onnxruntime-web'))return;
  return code.replace(/new URL\(["'](ort-wasm[^"']+\.wasm)["'],\s*import\.meta\.url\)/g,(_,file)=>`new URL('${runtimeBase}${file}')`);
 }}],
 build:{target:'es2022'},server:{headers:{'X-Content-Type-Options':'nosniff'},fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/functions/**']}},preview:{headers:{'X-Content-Type-Options':'nosniff'}}
};
});
