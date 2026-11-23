import {fitInside,fitJpeg} from './jpeg-size.ts';
import {AlphaHistory} from './alpha-history.ts';
import {errorDetails,processingFailure} from './processing-diagnostics.ts';
import {yieldToBrowser,readAlphaChannels} from './ui-scheduling.ts';
import {validateFile,MAX_PIXELS,alphaBounds,brushAlpha} from './image-utils.ts';
import type { Entitlement } from './membership.ts';
import type { GoogleUser } from './firebase-auth.ts';

type EditorElements = {
 canvas: HTMLCanvasElement;
 original: HTMLImageElement;
 file: HTMLInputElement;
 'bg-file': HTMLInputElement;
 color: HTMLInputElement;
 crop: HTMLInputElement;
 brush: HTMLInputElement;
 'brush-value': HTMLOutputElement;
 quality: HTMLSelectElement;
 progress: HTMLProgressElement;
 undo: HTMLButtonElement;
 download: HTMLButtonElement;
 'download-jpg': HTMLButtonElement;
 'jpg-max-kb': HTMLInputElement;
 'jpg-width': HTMLInputElement;
 'jpg-height': HTMLInputElement;
 'google-signin': HTMLButtonElement;
 'razorpay-checkout': HTMLButtonElement;
};
type Tool = 'view' | 'erase' | 'restore';
type Point = { x: number; y: number };
type Order = { key_id: string; order_id: string; amount: number; currency: string };
type PaymentProof = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type PaymentResponses = {
 createOrder: Order;
 entitlement: { entitlement: Entitlement | null };
 verifyPayment: { entitlement: Entitlement | null };
};

declare global {
 interface Window {
  Razorpay?: new (options: {
   key: string; order_id: string; amount: number; currency: string;
   name: string; description: string; modal: { ondismiss(): void };
   handler(result: PaymentProof): void;
  }) => { open(): void; on(event: 'payment.failed', callback: () => void): void };
 }
}

function $<Id extends string>(id: Id): Id extends keyof EditorElements ? EditorElements[Id] : HTMLElement {
 return document.getElementById(id) as Id extends keyof EditorElements ? EditorElements[Id] : HTMLElement;
}
const canvas=$('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true})!;
const canvasWrap=$('canvas-wrap'),brushCursor=$('brush-cursor');
let controller: AbortController | null = null;
let source: ImageBitmap | null = null, bg: ImageBitmap | null = null;
let basePixels: ImageData | null = null;
let alpha: Uint8Array | null = null, initialAlpha: Uint8Array | null = null;
let sourceAlpha: Uint8Array | null = null;
const alphaHistory = new AlphaHistory();
let strokePointer: number | null = null;
let tool: Tool = 'view', lastPoint: Point | null = null, sourceUrl: string | null = null;
let busy=false,background='transparent',frame=0,runId=0,bgRevision=0;
const cutout=document.createElement('canvas'),cutCtx=cutout.getContext('2d')!;
function fail(message: string){$('error').textContent=message;$('error').hidden=false;}
function panels(mode: 'upload' | 'processing' | 'editor'){$('showcase').hidden=mode!=='upload';$('upload-panel').hidden=mode!=='upload';$('processing').hidden=mode!=='processing';$('editor').hidden=mode!=='editor';}
function setTool(value: Tool){tool=value;for(const id of ['move','erase','restore'])$(id).classList.toggle('active',(id==='move'?'view':id)===value);canvas.style.cursor='default';if(value==='view')canvasWrap.classList.remove('brush-visible');else if(canvas.matches(':hover'))canvasWrap.classList.add('brush-visible');if(value!=='view')showResult();}
function showResult(){canvas.hidden=false;$('original').hidden=true;$('result-view').classList.add('active');$('original-view').classList.remove('active');}
function release(){cancelAnimationFrame(frame);frame=0;strokePointer=null;lastPoint=null;source?.close();source=null;bg?.close();bg=null;basePixels=alpha=initialAlpha=sourceAlpha=null;alphaHistory.clear();if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=null;$('original').removeAttribute('src');canvas.width=canvas.height=cutout.width=cutout.height=1;$('undo').disabled=true;$('file').value='';$('bg-file').value='';$('edit-status').textContent='';}
function reset(){++runId;controller?.abort();controller=null;busy=false;release();panels('upload');$('error').hidden=true;}
function render(){
 if(!basePixels||!alpha)return;
 const pixels=new ImageData(new Uint8ClampedArray(basePixels.data),canvas.width,canvas.height);
 for(let i=0;i<alpha.length;i++)pixels.data[i*4+3]=alpha[i];
 cutCtx.putImageData(pixels,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
 if(bg){const scale=Math.max(canvas.width/bg.width,canvas.height/bg.height);ctx.drawImage(bg,(canvas.width-bg.width*scale)/2,(canvas.height-bg.height*scale)/2,bg.width*scale,bg.height*scale);}
 else if(background!=='transparent'){ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);}
 ctx.drawImage(cutout,0,0);
}
function queueRender(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});}
async function processFile(input: File | null){
 if(busy)return;
 busy=true;const thisRun=++runId;
 $('error').hidden=true;
 try{await validateFile(input);}catch(e){if(thisRun===runId){busy=false;fail(e instanceof Error ? e.message : 'Choose a JPG, PNG or WebP image.');}return;}
 const file=input!;
 let bitmap: ImageBitmap | null = null,processingStage='preparing',processingProvider='unknown';
 try{bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>MAX_PIXELS)throw new Error('Choose a photo up to 25 megapixels. Resize this photo and try again.');}
 catch(e){bitmap?.close();if(thisRun!==runId)return;busy=false;fail(e instanceof Error && e.message.includes('25 megapixels')?e.message:'This image could not be decoded. Please try another JPG, PNG or WebP.');return;}
 if(thisRun!==runId){bitmap.close();return;}
 release();controller=new AbortController();const localController=controller;panels('processing');$('status').textContent='Preparing the AI engine…';$('progress').value=0;
 try{
  bitmap.close();bitmap=null;
  if(thisRun!==runId)return;
  await yieldToBrowser();
  if(thisRun!==runId)return;
  const {removeBackground}=await import('../vendor/bg0/index.ts');
  if(thisRun!==runId)return;
  const result=await removeBackground(file,{quality:$('quality').value==='quality'?'quality':'fast',signal:localController.signal,onProgress:p=>{if(thisRun!==runId)return;processingStage=p.stage;processingProvider=p.provider??processingProvider;$('progress').value=p.progress;$('status').textContent=p.message+(p.download?` · ${Math.round(p.download.loadedBytes/1e6)} / ${Math.round(p.download.totalBytes/1e6)} MB`:'');}});
  if(thisRun!==runId)return;
  const original=await createImageBitmap(result.sourceBlob??file);if(thisRun!==runId){original.close();return;}source=original;
  const output=await createImageBitmap(result.blob);if(thisRun!==runId){output.close();return;}
  canvas.width=cutout.width=output.width;canvas.height=cutout.height=output.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(output,0,0);const resultPixels=ctx.getImageData(0,0,canvas.width,canvas.height);output.close();
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);basePixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  const channels=await readAlphaChannels(resultPixels.data,basePixels.data,localController.signal);
  if(thisRun!==runId)return;
  alpha=channels.alpha;sourceAlpha=channels.sourceAlpha;initialAlpha=alpha.slice();
  sourceUrl=URL.createObjectURL(result.sourceBlob??file);$('original').src=sourceUrl;background='transparent';$('crop').checked=false;setTool('view');showResult();selectSwatch('transparent');
  const modelLabel=result.model==='birefnet-lite'?'BiRefNet Lite (98 MB)':'BiRefNet Detailed (473 MB)';
  const engineLabel=result.provider==='webgpu'?'WebGPU':'WebAssembly';
  $('dimensions').textContent=`${canvas.width} × ${canvas.height} px`;
  $('edit-status').textContent=`Background removed with ${modelLabel} using ${engineLabel}.`;
  render();panels('editor');
 }catch(e){if(thisRun!==runId)return;release();panels('upload');if(errorDetails(e).code!=='cancelled'&&errorDetails(e).name!=='AbortError'){fail(processingFailure(e,processingStage,processingProvider));}}
 finally{bitmap?.close();if(thisRun===runId){busy=false;controller=null;}}
}
function selectSwatch(value: string){document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(b=>b.classList.toggle('selected',b.dataset.color===value));}
$('upload').onclick=()=>$('file').click();$('file').onchange=()=>{const input=$('file');const file=input.files?.[0];input.value='';if(file)processFile(file);};
$('cancel').onclick=reset;$('reset').onclick=reset;
$('sample').onclick=async()=>{if(busy)return;try{const r=await fetch(`${import.meta.env.BASE_URL}artwork/hero-sample.webp`);if(!r.ok)throw Error();const blob=await r.blob();await processFile(new File([blob],'clearcut-example.webp',{type:'image/webp'}));}catch{fail('The sample could not load. Please choose a photo.');}};
let dragDepth=0;document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('dragenter',e=>{e.preventDefault();if(e.dataTransfer?.types.includes('Files')){dragDepth++;$('workspace').classList.add('dragging');}});document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('workspace').classList.remove('dragging');}});document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('workspace').classList.remove('dragging');const f=e.dataTransfer?.files[0];if(f)processFile(f);});
window.addEventListener('paste',e=>{const image=[...e.clipboardData?.items ?? []].find(i=>i.kind==='file'&&i.type.startsWith('image/'));if(image){e.preventDefault();processFile(image.getAsFile());}});
$('original-view').onclick=()=>{canvas.hidden=true;$('original').hidden=false;$('original-view').classList.add('active');$('result-view').classList.remove('active');};$('result-view').onclick=showResult;
document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(b=>b.onclick=()=>{bgRevision++;background=b.dataset.color!;bg?.close();bg=null;selectSwatch(background);showResult();render();});
$('color').oninput=()=>{bgRevision++;background=$('color').value;bg?.close();bg=null;selectSwatch('');showResult();render();};
$('bg-file').onchange=async()=>{const input=$('bg-file');const f=input.files?.[0];input.value='';if(!f)return;const ticket=runId,revision=++bgRevision;try{await validateFile(f);const b=await createImageBitmap(f);if(b.width*b.height>MAX_PIXELS){b.close();throw Error('Background photos must be up to 25 megapixels.');}if(!basePixels||ticket!==runId||revision!==bgRevision){b.close();return;}bg?.close();bg=b;selectSwatch('');showResult();render();}catch(e){fail(e instanceof Error ? e.message : 'Could not load the background photo.');}};
for(const [id,value] of [['move','view'],['erase','erase'],['restore','restore']] as const)$(id).onclick=()=>setTool(value);
function updateBrushCursor(e: PointerEvent){const wrap=canvasWrap.getBoundingClientRect();brushCursor.style.left=`${e.clientX-wrap.left}px`;brushCursor.style.top=`${e.clientY-wrap.top}px`;}
function resizeBrushCursor(){const size=`${$('brush').value}px`;brushCursor.style.width=size;brushCursor.style.height=size;}
$('brush').oninput=()=>{$('brush-value').value=$('brush').value;resizeBrushCursor();};resizeBrushCursor();
function paint(e: PointerEvent){if(!alpha||!sourceAlpha)return;const rect=canvas.getBoundingClientRect();const point={x:(e.clientX-rect.left)*canvas.width/rect.width,y:(e.clientY-rect.top)*canvas.height/rect.height};const radius=Number($('brush').value)*canvas.width/rect.width/2;const start=lastPoint??point;const count=Math.max(1,Math.ceil(Math.hypot(point.x-start.x,point.y-start.y)/Math.max(1,radius/3)));for(let n=1;n<=count;n++)brushAlpha(alpha,sourceAlpha,canvas.width,canvas.height,start.x+(point.x-start.x)*n/count,start.y+(point.y-start.y)*n/count,radius,tool==='restore');lastPoint=point;queueRender();}
canvas.addEventListener('pointerdown',e=>{
 updateBrushCursor(e);
 if(tool==='view'||!alpha||e.button!==0||strokePointer!==null)return;
 alphaHistory.capture(alpha);
 $('undo').disabled=!alphaHistory.canUndo;
 strokePointer=e.pointerId;
 lastPoint=null;
 canvas.setPointerCapture(e.pointerId);
 paint(e);
});
canvas.addEventListener('pointermove',e=>{
 updateBrushCursor(e);
 if(strokePointer===e.pointerId)paint(e);
});
canvas.addEventListener('pointerleave',()=>{if(strokePointer===null)canvasWrap.classList.remove('brush-visible');});
canvas.addEventListener('pointerenter',e=>{if(tool!=='view'&&alpha){canvasWrap.classList.add('brush-visible');updateBrushCursor(e);}});
function endStroke(e: PointerEvent){
 if(strokePointer!==e.pointerId)return;
 strokePointer=null;
 lastPoint=null;
}
canvas.addEventListener('pointerup',endStroke);
canvas.addEventListener('pointercancel',endStroke);
canvas.addEventListener('lostpointercapture',endStroke);
$('undo').onclick=()=>{
 if(strokePointer!==null)return;
 const previous=alphaHistory.undo();
 if(!previous)return;
 alpha=previous;
 $('undo').disabled=!alphaHistory.canUndo;
 render();
};
$('reset-mask').onclick=()=>{
 if(!alpha||!initialAlpha||strokePointer!==null)return;
 alphaHistory.capture(alpha);
 $('undo').disabled=!alphaHistory.canUndo;
 alpha=initialAlpha.slice();
 render();
};
for(const preset of document.querySelectorAll<HTMLButtonElement>('[data-jpg-width][data-jpg-height]')){
 preset.onclick=()=>{
  const {jpgWidth,jpgHeight}=preset.dataset;
  if(!jpgWidth||!jpgHeight)return;
  $('jpg-width').value=jpgWidth;
  $('jpg-height').value=jpgHeight;
  $('edit-status').textContent=`JPG dimensions set to ${jpgWidth} × ${jpgHeight} px.`;
 };
}
async function downloadCutout(format: 'png' | 'jpg'){
 if(!alpha)return;
 const sizeInput=$('jpg-max-kb'),widthInput=$('jpg-width'),heightInput=$('jpg-height');
 const exactSize=format==='jpg'&&(widthInput.value!==''||heightInput.value!=='');
 if(format==='jpg'){
  widthInput.required=heightInput.required=exactSize;
  const invalid=[sizeInput,widthInput,heightInput].find(input=>!input.checkValidity());
  if(invalid){
   invalid.closest('details')!.open=true;
   invalid.reportValidity();
   return;
  }
  if(exactSize&&widthInput.valueAsNumber*heightInput.valueAsNumber>MAX_PIXELS){
   $('edit-status').textContent='Choose JPG dimensions up to 25 megapixels.';
   return;
  }
 }
 const maxBytes=format==='jpg'&&sizeInput.value ? sizeInput.valueAsNumber*1000 : undefined;
 const exportRun=runId;
 $('error').hidden=true;
 const pngButton=$('download'),jpgButton=$('download-jpg');
 pngButton.disabled=jpgButton.disabled=true;
 const label=format.toUpperCase();
 try{
  render();
  const exportCanvas=document.createElement('canvas');
  let bounds={x:0,y:0,width:canvas.width,height:canvas.height};
  if($('crop').checked){
   const maskData=new Uint8ClampedArray(alpha.length*4);
   for(let i=0;i<alpha.length;i++)maskData[i*4+3]=alpha[i];
   bounds=alphaBounds(maskData,canvas.width,canvas.height);
  }
  exportCanvas.width=exactSize?widthInput.valueAsNumber:bounds.width;
  exportCanvas.height=exactSize?heightInput.valueAsNumber:bounds.height;
  const context=exportCanvas.getContext('2d')!;
  if(format==='jpg'){
   context.fillStyle='#fff';
   context.fillRect(0,0,exportCanvas.width,exportCanvas.height);
  }
  const frame=fitInside(bounds.width,bounds.height,exportCanvas.width,exportCanvas.height);
  context.drawImage(canvas,bounds.x,bounds.y,bounds.width,bounds.height,frame.x,frame.y,frame.width,frame.height);
  const mime=format==='jpg'?'image/jpeg':'image/png';
  const encode=async (surface: HTMLCanvasElement, quality?: number)=>{
   const blob=await new Promise<Blob | null>(resolve=>surface.toBlob(resolve,mime,quality));
   if(!blob||blob.type!==mime)throw Error();
   return blob;
  };
  let outputWidth=exportCanvas.width,outputHeight=exportCanvas.height;
  let blob: Blob;
  if(maxBytes!==undefined){
   let scaledCanvas: HTMLCanvasElement | undefined;
   $('edit-status').textContent='Preparing a JPG within your file size limit…';
   const fitted=await fitJpeg(outputWidth,outputHeight,maxBytes,(width,height,quality)=>{
    if(exportRun!==runId)throw Error();
    if(width===exportCanvas.width&&height===exportCanvas.height)return encode(exportCanvas,quality);
    if(!scaledCanvas||scaledCanvas.width!==width||scaledCanvas.height!==height){
     scaledCanvas??=document.createElement('canvas');
     scaledCanvas.width=width;
     scaledCanvas.height=height;
     scaledCanvas.getContext('2d')!.drawImage(exportCanvas,0,0,width,height);
    }
    return encode(scaledCanvas,quality);
   },exactSize);
   if(exportRun!==runId)return;
   if(!fitted){
    $('edit-status').textContent=exactSize?'These dimensions need a larger JPG file size limit.':'Try a larger JPG file size limit.';
    return;
   }
   ({blob,width:outputWidth,height:outputHeight}=fitted);
  }else{
   blob=await encode(exportCanvas,format==='jpg'?0.92:undefined);
   if(exportRun!==runId)return;
  }
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;
  a.download=`clearcutt.${format}`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  $('edit-status').textContent=maxBytes===undefined&&!exactSize
   ? `Your ${label} is ready. Check your downloads.`
   : `JPG ready · ${(blob.size/1000).toFixed(2)} KB · ${outputWidth} × ${outputHeight} px. Check your downloads.`;
 }catch{
  if(exportRun===runId)fail(`The ${label} could not be created. Please try again.`);
 }finally{
  pngButton.disabled=jpgButton.disabled=false;
 }
}
$('download').onclick=()=>downloadCutout('png');
$('download-jpg').onclick=()=>downloadCutout('jpg');
window.addEventListener('pagehide',()=>{controller?.abort();release();});

import {renderMembership} from './membership.ts';
import {watchGoogleAuth,signInWithGoogle,signOutGoogle,getGoogleAuthToken} from './firebase-auth.ts';
import {initAccountSecurity} from './security-report.ts';
const signInButton=$('google-signin'),accountControl=$('account-control'),authStatus=$('auth-status');
const accountSecurity=initAccountSecurity(document);
let refreshPaymentEntitlement: () => void = ()=>{},currentUser: GoogleUser | null = null,authRevision=0;
function googleAuthMessage(failure: unknown){const error=errorDetails(failure);switch(error?.code){case'auth/unauthorized-domain':return'This site is not yet enabled for Google sign-in.';case'auth/operation-not-allowed':return'Google sign-in is disabled in Firebase settings.';case'auth/popup-blocked':return'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';case'auth/popup-closed-by-user':return'Sign-in was cancelled.';case'auth/network-request-failed':return'Google sign-in could not connect. Check your connection and try again.';default:return'Google sign-in failed ('+(error?.code||error?.name||'unknown error')+'). Refresh the page and try again.';}}
signInButton.disabled=true;
watchGoogleAuth(user=>{currentUser=user;authRevision++;renderMembership(document,user,null,paymentMode);signInButton.hidden=Boolean(user);accountControl.hidden=!user;authStatus.textContent=user?'Google account connected. Photo processing still happens on this device.':'';accountSecurity?.handleUser(user);if(user)refreshPaymentEntitlement();},error=>{authStatus.textContent=googleAuthMessage(error);}).then(()=>{signInButton.disabled=false;}).catch(()=>{});
signInButton.onclick=async()=>{signInButton.disabled=true;authStatus.textContent='Opening Google sign-in…';try{await signInWithGoogle();}catch(error){authStatus.textContent=googleAuthMessage(error);}finally{signInButton.disabled=false;}};
$('google-signout').onclick=async()=>{try{await signOutGoogle();authStatus.textContent='Signed out.';}catch{authStatus.textContent='Could not sign out. Please try again.';}};


const checkoutButton=$('razorpay-checkout'),paymentStatus=$('payment-status'),paymentTestNote=$('payment-test-note');
const paymentApiBase=import.meta.env.VITE_PAYMENT_API_BASE_URL;
const paymentMode=import.meta.env.VITE_PAYMENT_MODE==='live'?'live':'test';
if(paymentApiBase){checkoutButton.hidden=false;paymentTestNote.hidden=paymentMode==='live';checkoutButton.textContent=paymentMode==='live'?'Pay ₹90 with Razorpay':'Try ₹90 sandbox checkout';}
function loadRazorpay(){
 if(window.Razorpay)return Promise.resolve();
 return new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=()=>resolve();script.onerror=()=>reject(Error('Checkout could not load.'));document.head.append(script);});
}
async function paymentRequest<Endpoint extends keyof PaymentResponses>(endpoint: Endpoint, body: object | null, token: string, method = 'POST'): Promise<PaymentResponses[Endpoint]> {
 const response=await fetch(`${paymentApiBase.replace(/\/$/,'')}/api/${endpoint}`,{method,headers:{...(token?{authorization:`Bearer ${token}`}:{ }),'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body||{})}:{})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Checkout could not continue.');
 return result as PaymentResponses[Endpoint];
}
refreshPaymentEntitlement=async()=>{
 if(!paymentApiBase||!currentUser)return;
 const revision=authRevision,user=currentUser;
 try{const token=await getGoogleAuthToken();const {entitlement}=await paymentRequest('entitlement',null,token,'GET');if(revision===authRevision)renderMembership(document,user,entitlement,paymentMode);}
 catch{if(revision===authRevision)paymentStatus.textContent='Could not check membership. Your saved access is unchanged. Refresh to retry.';}
};
window.addEventListener('focus',()=>refreshPaymentEntitlement());
checkoutButton.onclick=async()=>{
 checkoutButton.disabled=true;paymentStatus.textContent=paymentMode==='live'?'Opening secure checkout…':'Opening ₹90 sandbox checkout…';
 try{
  const revision=authRevision;const token=await getGoogleAuthToken();await loadRazorpay();
  const order=await paymentRequest('createOrder',{plan:'plus-monthly'},token);if(revision!==authRevision)throw Error('Your account changed. Please start checkout again.');
  const checkout=new window.Razorpay!({key:order.key_id,order_id:order.order_id,amount:order.amount,currency:order.currency,name:'Clearcutt Remove BG',description:'Clearcutt Plus · 30-day access · renew manually',modal:{ondismiss:()=>{paymentStatus.textContent="Checkout closed. If payment went through, we'll confirm it before activating access.";}},handler:async result=>{
   paymentStatus.textContent='Verifying payment securely…';
   try{const verified=await paymentRequest('verifyPayment',result,await getGoogleAuthToken());if(revision===authRevision)renderMembership(document,currentUser,verified.entitlement,paymentMode);}
   catch{if(revision===authRevision)paymentStatus.textContent='We could not verify this payment yet. Do not pay again; check your Razorpay payment status and contact support if it was charged.';}
  }});
  checkout.on('payment.failed',()=>{paymentStatus.textContent='Payment failed. No plan was activated; you can retry.';});checkout.open();
 }catch(error){paymentStatus.textContent=(error instanceof Error && error.message) || 'Checkout could not continue. Please try again.';}
 finally{checkoutButton.disabled=false;}
};
