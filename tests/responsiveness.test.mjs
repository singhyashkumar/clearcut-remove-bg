import test from 'node:test';
import assert from 'node:assert/strict';
import {configureCpuProxy} from '../vendor/bg0/responsiveness.js';
import {readAlphaChannels,yieldToBrowser} from '../src/ui-scheduling.js';

test('CPU-only inference uses a worker; WebGPU queues never enable proxy',()=>{
 const onnx={wasm:{}};
 configureCpuProxy(onnx,[{provider:'wasm'}],true);
 assert.equal(onnx.wasm.proxy,true);
 configureCpuProxy(onnx,[{provider:'webgpu'},{provider:'wasm'}],true);
 assert.equal(onnx.wasm.proxy,false);
 configureCpuProxy(onnx,[{provider:'wasm'}],false);
 assert.equal(onnx.wasm.proxy,false);
});
test('large-photo alpha extraction preserves pixels and lets input tasks run',async()=>{
 const original=new Uint8ClampedArray(300000*4);
 const result=new Uint8ClampedArray(original.length);
 for(let i=0;i<300000;i++){original[i*4+3]=i%251;result[i*4+3]=i%256;}
 let inputRan=false;
 setTimeout(()=>{inputRan=true;},0);
 const channels=await readAlphaChannels(result,original);
 assert.equal(inputRan,true);
 for(let i=0;i<300000;i++){
  assert.equal(channels.alpha[i],i%256);
  assert.equal(channels.sourceAlpha[i],i%251);
 }
});
test('cancel during a large photo stops extraction between batches',async()=>{
 const controller=new AbortController();
 const pixels=new Uint8ClampedArray(300000*4);
 setTimeout(()=>controller.abort(),0);
 await assert.rejects(readAlphaChannels(pixels,pixels,controller.signal),{name:'AbortError'});
});
test('yield falls back to a task when scheduler is unavailable',async()=>{
 let ran=false;
 setTimeout(()=>{ran=true;},0);
 await yieldToBrowser();
 assert.equal(ran,true);
});
