import test from 'node:test';
import assert from 'node:assert/strict';
import {fitJpeg} from '../src/jpeg-size.ts';

const encode = async (width,height,quality)=>new Blob([new Uint8Array(Math.ceil(width*height*quality))]);

test('a JPG limit keeps dimensions when quality adjustment is enough',async()=>{
 const result=await fitJpeg(100,80,5000,encode);
 assert.equal(result.width,100);
 assert.equal(result.height,80);
 assert.ok(result.blob.size>4500 && result.blob.size<=5000);
});

test('a tight JPG limit scales both dimensions and respects the byte cap',async()=>{
 const result=await fitJpeg(1000,500,10000,encode);
 assert.ok(result.width<1000);
 assert.ok(Math.abs(result.width-result.height*2)<=1);
 assert.ok(result.blob.size<=10000);
});

test('an impossible JPG limit yields no download',async()=>{
 const result=await fitJpeg(100,50,5000,async()=>new Blob([new Uint8Array(5001)]));
 assert.equal(result,undefined);
});
