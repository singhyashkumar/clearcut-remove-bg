import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileInput,mobileMask} from '../src/mobile-tensors.js';
import {processingFailure} from '../src/processing-diagnostics.js';
import {useMobileProcessing} from '../src/memory-policy.js';
test('mobile route is selected for Android Fast and Detailed, and desktop opt-in',()=>{
 const phone={userAgent:'Mozilla/5.0 (Linux; Android 13) Chrome/140.0 Mobile',deviceMemory:8};
 const desktop={userAgent:'Mozilla/5.0 (X11) Chrome/140.0',deviceMemory:8};
 for(const mode of ['fast','quality'])assert.equal(useMobileProcessing(mode,phone),true);
 assert.equal(useMobileProcessing('compatible',desktop),true);
 assert.equal(useMobileProcessing('fast',desktop),false);
});
test('mobile input normalizes RGB by its maximum, ignores alpha and packs channels',()=>{
 const result=mobileInput(new Uint8ClampedArray([128,64,32,0,64,0,128,255]));
 const expected=[(1-.485)/.229,(.5-.485)/.229,(.5-.456)/.224,(0-.456)/.224,(.25-.406)/.225,(1-.406)/.225];
 expected.forEach((value,i)=>assert.ok(Math.abs(result[i]-value)<1e-5));
 assert.ok(mobileInput(new Uint8ClampedArray(8)).every(Number.isFinite));
});
test('mobile saliency has full alpha range without applying a second sigmoid',()=>{
 assert.deepEqual(Array.from(mobileMask(new Float32Array([.25,.5,.75]))),[0,.5,1]);
 assert.deepEqual(Array.from(mobileMask(new Float32Array([0,0]))),[0,0]);
 assert.throws(()=>mobileMask(new Float32Array([NaN])),/invalid mask/);
});
test('failure report retains stage, provider and underlying reason without asset URL tokens',()=>{
 const error=new Error('Local model could not load.',{cause:new Error('Failed https://example.com/model?token=secret with allocation failure')});error.code='model-load-failed';
 const message=processingFailure(error,'preparing','wasm');
 assert.match(message,/model-load-failed; preparing; wasm/);
 assert.match(message,/allocation failure/);
 assert.ok(!message.includes('secret'));
});
