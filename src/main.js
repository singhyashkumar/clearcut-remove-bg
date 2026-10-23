import {validateFile,MAX_PIXELS,alphaBounds,brushAlpha} from './image-utils.js';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const canvasWrap=$('canvas-wrap'),brushCursor=$('brush-cursor');
let controller=null,busy=false,source=null,basePixels=null,alpha=null,initialAlpha=null,sourceAlpha=null,undo=null,bg=null,background='transparent',tool='view',sourceUrl=null,drawing=false,lastPoint=null,frame=0,runId=0,bgRevision=0;
const cutout=document.createElement('canvas'),cutCtx=cutout.getContext('2d');
function fail(message){$('error').textContent=message;$('error').hidden=false;}
function panels(mode){$('showcase').hidden=mode!=='upload';$('upload-panel').hidden=mode!=='upload';$('processing').hidden=mode!=='processing';$('editor').hidden=mode!=='editor';}
function setTool(value){tool=value;for(const id of ['move','erase','restore'])$(id).classList.toggle('active',(id==='move'?'view':id)===value);canvas.style.cursor='default';if(value==='view')canvasWrap.classList.remove('brush-visible');else if(canvas.matches(':hover'))canvasWrap.classList.add('brush-visible');if(value!=='view')showResult();}
function showResult(){canvas.hidden=false;$('original').hidden=true;$('result-view').classList.add('active');$('original-view').classList.remove('active');}
function release(){cancelAnimationFrame(frame);frame=0;drawing=false;lastPoint=null;source?.close();source=null;bg?.close();bg=null;basePixels=alpha=initialAlpha=sourceAlpha=undo=null;if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=null;$('original').removeAttribute('src');canvas.width=canvas.height=cutout.width=cutout.height=1;$('undo').disabled=true;$('file').value='';$('bg-file').value='';$('edit-status').textContent='';}
function reset(){++runId;controller?.abort();controller=null;busy=false;release();panels('upload');$('error').hidden=true;}
function render(){
 if(!basePixels)return;
 const pixels=new ImageData(new Uint8ClampedArray(basePixels.data),canvas.width,canvas.height);
 for(let i=0;i<alpha.length;i++)pixels.data[i*4+3]=alpha[i];
 cutCtx.putImageData(pixels,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
 if(bg){const scale=Math.max(canvas.width/bg.width,canvas.height/bg.height);ctx.drawImage(bg,(canvas.width-bg.width*scale)/2,(canvas.height-bg.height*scale)/2,bg.width*scale,bg.height*scale);}
 else if(background!=='transparent'){ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);}
 ctx.drawImage(cutout,0,0);
}
function queueRender(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});}
async function processFile(file){
 if(busy)return;
 busy=true;const thisRun=++runId;
 $('error').hidden=true;
 try{await validateFile(file);}catch(e){if(thisRun===runId){busy=false;fail(e.message);}return;}
 let bitmap;
 try{bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>MAX_PIXELS)throw new Error('Choose a photo up to 25 megapixels. Resize this photo and try again.');}
 catch(e){bitmap?.close();if(thisRun!==runId)return;busy=false;fail(e.message.includes('25 megapixels')?e.message:'This image could not be decoded. Please try another JPG, PNG or WebP.');return;}
 if(thisRun!==runId){bitmap.close();return;}
 release();source=bitmap;controller=new AbortController();const localController=controller;panels('processing');$('status').textContent='Preparing the AI engine…';$('progress').value=0;
 try{
  const {removeBackground}=await import('../vendor/bg0/index.ts');
  if(thisRun!==runId)return;
  const result=await removeBackground(file,{quality:$('quality').value,signal:localController.signal,onProgress:p=>{if(thisRun!==runId)return;$('progress').value=p.progress;$('status').textContent=p.message+(p.download?` · ${Math.round(p.download.loadedBytes/1e6)} / ${Math.round(p.download.totalBytes/1e6)} MB`:'');}});
  if(thisRun!==runId)return;
  const output=await createImageBitmap(result.blob);if(thisRun!==runId){output.close();return;}
  canvas.width=cutout.width=output.width;canvas.height=cutout.height=output.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(output,0,0);const resultPixels=ctx.getImageData(0,0,canvas.width,canvas.height);output.close();
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);basePixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  alpha=new Uint8Array(canvas.width*canvas.height);for(let i=0;i<alpha.length;i++)alpha[i]=resultPixels.data[i*4+3];initialAlpha=alpha.slice();sourceAlpha=new Uint8Array(alpha.length);for(let i=0;i<alpha.length;i++)sourceAlpha[i]=basePixels.data[i*4+3];
  sourceUrl=URL.createObjectURL(file);$('original').src=sourceUrl;background='transparent';$('crop').checked=false;setTool('view');showResult();selectSwatch('transparent');
  $('dimensions').textContent=`${canvas.width} × ${canvas.height} px`;render();panels('editor');$('edit-status').textContent='Background removed. Ready for your next idea.';
 }catch(e){if(thisRun!==runId)return;release();panels('upload');if(e?.code!=='cancelled'&&e?.name!=='AbortError')fail('Processing could not finish. Check your connection and available memory, then retry. A current desktop Chrome or Edge browser is recommended.');}
 finally{if(thisRun===runId){busy=false;controller=null;}}
}
function selectSwatch(value){document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('selected',b.dataset.color===value));}
$('upload').onclick=()=>$('file').click();$('file').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)processFile(file);};
$('cancel').onclick=reset;$('reset').onclick=reset;
$('sample').onclick=async()=>{if(busy)return;try{const r=await fetch(`${import.meta.env.BASE_URL}sample.jpg`);if(!r.ok)throw Error();const blob=await r.blob();await processFile(new File([blob],'sample.jpg',{type:'image/jpeg'}));}catch{fail('The sample could not load. Please choose a photo.');}};
let dragDepth=0;document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('dragenter',e=>{e.preventDefault();if(e.dataTransfer.types.includes('Files')){dragDepth++;$('workspace').classList.add('dragging');}});document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('workspace').classList.remove('dragging');}});document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('workspace').classList.remove('dragging');const f=e.dataTransfer.files[0];if(f)processFile(f);});
window.addEventListener('paste',e=>{const image=[...e.clipboardData.items].find(i=>i.kind==='file'&&i.type.startsWith('image/'));if(image){e.preventDefault();processFile(image.getAsFile());}});
$('original-view').onclick=()=>{canvas.hidden=true;$('original').hidden=false;$('original-view').classList.add('active');$('result-view').classList.remove('active');};$('result-view').onclick=showResult;
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{bgRevision++;background=b.dataset.color;bg?.close();bg=null;selectSwatch(background);showResult();render();});
$('color').oninput=e=>{bgRevision++;background=e.target.value;bg?.close();bg=null;selectSwatch('');showResult();render();};
$('bg-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const ticket=runId,revision=++bgRevision;try{await validateFile(f);const b=await createImageBitmap(f);if(b.width*b.height>MAX_PIXELS){b.close();throw Error('Background photos must be up to 25 megapixels.');}if(!basePixels||ticket!==runId||revision!==bgRevision){b.close();return;}bg?.close();bg=b;selectSwatch('');showResult();render();}catch(e){fail(e.message);}};
for(const [id,value] of [['move','view'],['erase','erase'],['restore','restore']])$(id).onclick=()=>setTool(value);
function updateBrushCursor(e){const wrap=canvasWrap.getBoundingClientRect();brushCursor.style.left=`${e.clientX-wrap.left}px`;brushCursor.style.top=`${e.clientY-wrap.top}px`;}
function resizeBrushCursor(){const size=`${$('brush').value}px`;brushCursor.style.width=size;brushCursor.style.height=size;}
$('brush').oninput=e=>{$('brush-value').value=e.target.value;resizeBrushCursor();};resizeBrushCursor();
function paint(e){const rect=canvas.getBoundingClientRect();const point={x:(e.clientX-rect.left)*canvas.width/rect.width,y:(e.clientY-rect.top)*canvas.height/rect.height};const radius=Number($('brush').value)*canvas.width/rect.width/2;const start=lastPoint??point;const count=Math.max(1,Math.ceil(Math.hypot(point.x-start.x,point.y-start.y)/Math.max(1,radius/3)));for(let n=1;n<=count;n++)brushAlpha(alpha,sourceAlpha,canvas.width,canvas.height,start.x+(point.x-start.x)*n/count,start.y+(point.y-start.y)*n/count,radius,tool==='restore');lastPoint=point;queueRender();}
canvas.addEventListener('pointerdown',e=>{updateBrushCursor(e);if(tool==='view'||!alpha||e.button!==0)return;undo=alpha.slice();$('undo').disabled=false;drawing=true;lastPoint=null;canvas.setPointerCapture(e.pointerId);paint(e);});canvas.addEventListener('pointermove',e=>{updateBrushCursor(e);if(drawing)paint(e);});canvas.addEventListener('pointerleave',()=>{if(!drawing)canvasWrap.classList.remove('brush-visible');});canvas.addEventListener('pointerenter',e=>{if(tool!=='view'&&alpha){canvasWrap.classList.add('brush-visible');updateBrushCursor(e);}});function endStroke(){drawing=false;lastPoint=null;}canvas.addEventListener('pointerup',endStroke);canvas.addEventListener('pointercancel',endStroke);
$('undo').onclick=()=>{if(undo){alpha=undo;undo=null;$('undo').disabled=true;render();}};$('reset-mask').onclick=()=>{if(!alpha)return;undo=alpha.slice();$('undo').disabled=false;alpha=initialAlpha.slice();render();};
$('download').onclick=async()=>{
 const button=$('download');button.disabled=true;
 try{
  render();const exportCanvas=document.createElement('canvas');
  let bounds={x:0,y:0,width:canvas.width,height:canvas.height};
  if($('crop').checked){const maskData=new Uint8ClampedArray(alpha.length*4);for(let i=0;i<alpha.length;i++)maskData[i*4+3]=alpha[i];bounds=alphaBounds(maskData,canvas.width,canvas.height);}
  exportCanvas.width=bounds.width;exportCanvas.height=bounds.height;exportCanvas.getContext('2d').drawImage(canvas,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);
  const blob=await new Promise(resolve=>exportCanvas.toBlob(resolve,'image/png'));if(!blob)throw Error();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='clearcut.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('edit-status').textContent='Your PNG is ready. Check your downloads.';
 }catch{fail('The PNG could not be created. Please try again.');}finally{button.disabled=false;}
};
window.addEventListener('pagehide',()=>{controller?.abort();release();});

import {watchGoogleAuth,signInWithGoogle,signOutGoogle} from './firebase-auth.js';
const signInButton=$('google-signin'),accountControl=$('account-control'),authStatus=$('auth-status');
function googleAuthMessage(error){switch(error?.code){case'auth/unauthorized-domain':return'This site is not yet enabled for Google sign-in.';case'auth/operation-not-allowed':return'Google sign-in is disabled in Firebase settings.';case'auth/popup-blocked':return'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';case'auth/popup-closed-by-user':return'Sign-in was cancelled.';case'auth/network-request-failed':return'Google sign-in could not connect. Check your connection and try again.';default:return'Google sign-in failed ('+(error?.code||error?.name||'unknown error')+'). Refresh the page and try again.';}}
signInButton.disabled=true;
watchGoogleAuth(user=>{signInButton.hidden=Boolean(user);accountControl.hidden=!user;authStatus.textContent=user?'Google account connected. Photo processing still happens on this device.':'';},error=>{authStatus.textContent=googleAuthMessage(error);}).then(()=>{signInButton.disabled=false;}).catch(()=>{});
signInButton.onclick=async()=>{signInButton.disabled=true;authStatus.textContent='Opening Google sign-in…';try{await signInWithGoogle();}catch(error){authStatus.textContent=googleAuthMessage(error);}finally{signInButton.disabled=false;}};
$('google-signout').onclick=async()=>{try{await signOutGoogle();authStatus.textContent='Signed out.';}catch{authStatus.textContent='Could not sign out. Please try again.';}};

