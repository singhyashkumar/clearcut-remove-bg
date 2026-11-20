import test from 'node:test';
import assert from 'node:assert/strict';
import {fitInside,fitJpeg} from '../src/jpeg-size.ts';

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

test('exact JPG dimensions are preserved even when the file size limit cannot be met',async()=>{
 const dimensions=[];
 const result=await fitJpeg(200,230,5000,async(width,height,quality)=>{
  dimensions.push([width,height]);
  return encode(width,height,quality);
 },true);
 assert.equal(result,undefined);
 assert.deepEqual(dimensions,[[200,230],[200,230]]);
});

test('exact JPG dimensions center the resized image without stretching',()=>{
 assert.deepEqual(fitInside(1536,1024,200,230),{x:0,y:48,width:200,height:133});
 assert.deepEqual(fitInside(100,200,200,230),{x:42,y:0,width:115,height:230});
});
