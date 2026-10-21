import test from 'node:test';import assert from 'node:assert/strict';
import {validateFile,alphaBounds,brushAlpha} from '../src/image-utils.js';
test('rejects disguised active content, empty and oversized files',async()=>{for(const f of [new File(['<svg onload=alert(1)>'],'x.png',{type:'image/png'}),new File([],'x.jpg'),{size:20_000_001}])await assert.rejects(validateFile(f));});
test('recognizes supported magic bytes',async()=>{for(const a of [[255,216,255,0],[137,80,78,71,13,10,26,10],[82,73,70,70,0,0,0,0,87,69,66,80]])await validateFile(new File([new Uint8Array(a)],'x'));});
test('bounds preserve alpha and include final pixel',()=>{const d=new Uint8Array(4*4*4);d[(2*4+3)*4+3]=255;assert.deepEqual(alphaBounds(d,4,4),{x:3,y:2,width:1,height:1});assert.deepEqual(alphaBounds(new Uint8Array(16),2,2),{x:0,y:0,width:2,height:2});});
test('erase and restore respect the original alpha',()=>{const original=new Uint8Array(25).fill(200),alpha=original.slice();brushAlpha(alpha,original,5,5,2,2,1,false);assert.equal(alpha[12],0);assert.equal(alpha[0],200);brushAlpha(alpha,original,5,5,2,2,1,true);assert.equal(alpha[12],200);});
