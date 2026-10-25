import test from 'node:test';
import assert from 'node:assert/strict';
import {processingFailure} from '../src/processing-diagnostics.js';
test('failure report retains stage, provider and underlying reason without asset URL tokens',()=>{
 const error=new Error('Local model could not load.',{cause:new Error('Failed https://example.com/model?token=secret with allocation failure')});error.code='model-load-failed';
 const message=processingFailure(error,'preparing','wasm');
 assert.match(message,/model-load-failed; preparing; wasm/);
 assert.match(message,/allocation failure/);
 assert.ok(!message.includes('secret'));
});
