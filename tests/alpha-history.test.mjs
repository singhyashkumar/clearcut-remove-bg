import test from 'node:test';
import assert from 'node:assert/strict';
import {AlphaHistory} from '../src/alpha-history.ts';

test('undo restores independent snapshots in reverse order and clears between photos',()=>{
 const history=new AlphaHistory();
 const mask=Uint8Array.of(255,0);
 history.capture(mask);
 mask[0]=128;
 history.capture(mask);
 mask[1]=255;
 assert.deepEqual(history.undo(),Uint8Array.of(128,0));
 assert.deepEqual(history.undo(),Uint8Array.of(255,0));
 assert.equal(history.canUndo,false);
 history.capture(mask);
 history.clear();
 assert.equal(history.undo(),undefined);
});

test('undo keeps the latest twelve small edits',()=>{
 const history=new AlphaHistory();
 for(let value=0;value<15;value++)history.capture(Uint8Array.of(value));
 for(let value=14;value>=3;value--)assert.equal(history.undo()[0],value);
 assert.equal(history.undo(),undefined);
});

test('a 25-megapixel mask keeps two snapshots within the memory budget',()=>{
 const history=new AlphaHistory();
 const mask=new Uint8Array(25_000_000);
 for(let value=1;value<=3;value++){
  mask[0]=value;
  history.capture(mask);
 }
 assert.equal(history.undo()[0],3);
 assert.equal(history.undo()[0],2);
 assert.equal(history.undo(),undefined);
});
