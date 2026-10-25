import * as ort from 'onnxruntime-web/wasm'
import {mobileInput, mobileMask, MOBILE_INPUT_SIZE} from '../../src/mobile-tensors.js'
import {BackgroundRemovalError, normalizeError} from './errors'
import {createLoadWatch, modelLoadTimings} from './download'
import {validateImage, prepareImageForInference, decodeImage, maskToPng} from './image'
import type {RemoveBackgroundOptions, BackgroundRemovalResult} from './index'

const MODEL_URL = 'https://huggingface.co/edgetools/u2netp/resolve/25dee37ab19c5b6ad64ba6578eba63f1ae07720c/u2netp.onnx'
const MODEL_BYTES = 4_574_861
const MODEL_SHA256 = '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8'
const RUNTIME_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/'
ort.env.wasm.numThreads = 1
ort.env.wasm.proxy = false
ort.env.wasm.wasmPaths = {
 mjs: `${RUNTIME_BASE}ort-wasm-simd-threaded.mjs`,
 wasm: `${RUNTIME_BASE}ort-wasm-simd-threaded.wasm`,
}
let session: Promise<ort.InferenceSession> | undefined
let queue: Promise<unknown> = Promise.resolve()
function check(signal?: AbortSignal) {
 if(signal?.aborted)throw new BackgroundRemovalError('cancelled','Processing was cancelled.')
}
async function modelBytes(onProgress: RemoveBackgroundOptions['onProgress']) {
 const watch = createLoadWatch(fetch, modelLoadTimings)
 let cache: Cache | undefined
 try {
  try {cache=await caches.open('clearcut-mobile-u2netp-v1')}catch{}
  let response: Response | undefined
  try {response=await cache?.match(MODEL_URL)}catch{}
  const cached=Boolean(response)
  response ??= await watch.fetch(MODEL_URL)
  if(!response.ok)throw new Error('The mobile model download failed. Check your connection and retry.')
  const bytes=new Uint8Array(await response.arrayBuffer())
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('')
  if(bytes.length!==MODEL_BYTES || digest!==MODEL_SHA256){
   try {await cache?.delete(MODEL_URL)}catch{}
   throw new Error('The mobile model download was incomplete. Please retry.')
  }
  if(!cached){try{await cache?.put(MODEL_URL,new Response(bytes, {headers:{'Content-Type':'application/octet-stream'}}))}catch{}}
  onProgress?.({stage:'preparing',progress:.55,message:'Starting mobile model…',provider:'wasm'})
  return bytes
 }finally{watch.dispose()}
}
function getSession(onProgress: RemoveBackgroundOptions['onProgress']) {
 session ??= (async()=>{
  onProgress?.({stage:'downloading',progress:.15,message:'Loading mobile model (4.6 MB)…',provider:'wasm'})
  return ort.InferenceSession.create(await modelBytes(onProgress),{executionProviders:['wasm'],enableCpuMemArena:false,enableMemPattern:false})
 })().catch(error=>{session=undefined;throw error})
 return session
}
export async function removeBackground(input: Blob, options: RemoveBackgroundOptions = {}): Promise<BackgroundRemovalResult> {
 const started=performance.now(),quality=options.quality??'fast'
 let decoded: ImageBitmap | undefined
 try {
  check(options.signal)
  const format=await validateImage(input)
  options.onProgress?.({stage:'preparing',progress:.03,message:'Preparing photo for mobile processing…',provider:'wasm'})
  const prepared=await prepareImageForInference(input,MOBILE_INPUT_SIZE,MOBILE_INPUT_SIZE,format)
  check(options.signal)
  // Serialize cancelled/new runs: a synchronous CPU inference cannot be interrupted.
  const run=queue.then(async()=>{
   check(options.signal)
   const engine=await getSession(options.onProgress)
   check(options.signal)
   options.onProgress?.({stage:'processing',progress:.7,message:'Removing background with the mobile model…',provider:'wasm'})
   const tensor=new ort.Tensor('float32',mobileInput(prepared.data),[1,3,MOBILE_INPUT_SIZE,MOBILE_INPUT_SIZE])
   let outputs: Record<string,ort.Tensor> | undefined
   try {
    outputs=await engine.run({[engine.inputNames[0]]:tensor})
    check(options.signal)
    const output=outputs[engine.outputNames[0]]
    if(!(output.data instanceof Float32Array)||output.data.length!==MOBILE_INPUT_SIZE**2)throw new Error('The mobile model returned an invalid mask shape.')
    return mobileMask(output.data)
   }finally{tensor.dispose();if(outputs)for(const output of Object.values(outputs))output.dispose()}
  })
  queue=run.catch(()=>undefined)
  const alpha=await run
  check(options.signal)
  options.onProgress?.({stage:'finishing',progress:.92,message:'Finishing mobile cutout…',provider:'wasm'})
  decoded=await decodeImage(input,format)
  check(options.signal)
  const blob=await maskToPng(decoded,alpha,MOBILE_INPUT_SIZE,MOBILE_INPUT_SIZE,quality,undefined,options.signal)
  check(options.signal)
  options.onProgress?.({stage:'finishing',progress:1,message:'Background removed',provider:'wasm'})
  return {blob,width:prepared.sourceWidth,height:prepared.sourceHeight,provider:'wasm',model:'u2netp',quality,durationMs:Math.round(performance.now()-started)}
 }catch(error){throw normalizeError(error)}finally{decoded?.close()}
}
