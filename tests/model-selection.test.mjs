import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const runtime = dataModule(stripTypeScriptTypes(readFileSync(new URL('../vendor/bg0/runtime.ts', import.meta.url),'utf8')));
const models = stripTypeScriptTypes(readFileSync(new URL('../vendor/bg0/models.ts', import.meta.url),'utf8'))
 .replace("'./runtime'", JSON.stringify(runtime));
const {detectEngineChoices} = await import(dataModule(models));
const android = {userAgent:'Mozilla/5.0 (Linux; Android 13) Chrome/140.0 Mobile', deviceMemory:8, hardwareConcurrency:8};
const desktop = {userAgent:'Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0', deviceMemory:8, hardwareConcurrency:8};
test('original model admission permits Detailed on capable Android and desktop hardware', async()=>{
 assert.equal((await detectEngineChoices(android))[0].definition.name,'birefnet');
 assert.equal((await detectEngineChoices({...desktop,deviceMemory:2}))[0].definition.name,'birefnet-lite');
 assert.equal((await detectEngineChoices(desktop))[0].definition.name,'birefnet');
});
test('original GPU model ordering is restored on capable mobile hardware',async()=>{
 const gpu={requestAdapter:async()=>({features:{has:()=>true},limits:{maxBufferSize:2**30,maxStorageBufferBindingSize:2**28}})};
 assert.deepEqual((await detectEngineChoices({...android,gpu})).map(c=>[c.definition.name,c.provider]),[['birefnet','webgpu'],['birefnet-lite','webgpu'],['birefnet-lite','wasm']]);
});
