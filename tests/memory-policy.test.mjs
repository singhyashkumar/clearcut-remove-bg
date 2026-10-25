import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {needsMemoryBudget, processingDimensions, prepareProcessingPhoto} from '../src/memory-policy.js';
const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const runtime = dataModule(stripTypeScriptTypes(readFileSync(new URL('../vendor/bg0/runtime.ts', import.meta.url),'utf8')));
const models = stripTypeScriptTypes(readFileSync(new URL('../vendor/bg0/models.ts', import.meta.url),'utf8'))
 .replace("'./runtime'", JSON.stringify(runtime))
 .replace("'../../src/memory-policy.js'", JSON.stringify(new URL('../src/memory-policy.js',import.meta.url).href));
const {detectEngineChoices} = await import(dataModule(models));
const android = {userAgent:'Mozilla/5.0 (Linux; Android 13) Chrome/140.0 Mobile', deviceMemory:8, hardwareConcurrency:8};
const desktop = {userAgent:'Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0', deviceMemory:8, hardwareConcurrency:8};
test('phones and low-memory desktops avoid full weights even with many CPU cores', async()=>{
 for(const hardware of [android,{...desktop,deviceMemory:4},{userAgent:'Mozilla/5.0 (Macintosh)',maxTouchPoints:5,hardwareConcurrency:8}]) {
  assert.equal(needsMemoryBudget(hardware),true);
  assert.deepEqual((await detectEngineChoices(hardware)).map(c=>c.definition.name),['birefnet-lite']);
 }
 assert.equal((await detectEngineChoices(desktop))[0].definition.name,'birefnet');
});
test('a capable mobile GPU still uses only lite, retaining GPU and CPU fallback',async()=>{
 const gpu={requestAdapter:async()=>({features:{has:()=>true},limits:{maxBufferSize:2**30,maxStorageBufferBindingSize:2**28}})};
 assert.deepEqual((await detectEngineChoices({...android,gpu})).map(c=>[c.definition.name,c.provider]),[['birefnet-lite','webgpu'],['birefnet-lite','wasm']]);
});
test('large portrait, landscape and panorama photos fit the mobile pixel budget',()=>{
 for(const [w,h] of [[6000,4000],[4000,6000],[25000,1000],[1536,1024]]) {
  const size=processingDimensions(w,h,android);
  assert.ok(size.width*size.height<=2_000_000);
  assert.ok(Math.max(size.width,size.height)<=2048);
  assert.ok(Math.abs((size.width/size.height)/(w/h)-1)<.02);
 }
 assert.deepEqual(processingDimensions(800,600,android),{width:800,height:600});
 assert.deepEqual(processingDimensions(6000,4000,desktop),{width:6000,height:4000});
});
test('resizing releases its canvas after encoding success or failure',async()=>{
 const previous=globalThis.document;
 try {
  for(const success of [true,false]) {
   const canvas={getContext:()=>({drawImage(){}}),toBlob:callback=>callback(success?new Blob(['png'],{type:'image/png'}):null)};
   globalThis.document={createElement:()=>canvas};
   const pending=prepareProcessingPhoto(new Blob(['original']),{width:6000,height:4000},android);
   if(success)assert.equal((await pending).resized,true);
   else await assert.rejects(pending,/resizing failed/);
   assert.equal(canvas.width,0);assert.equal(canvas.height,0);
  }
 }finally{globalThis.document=previous;}
});
