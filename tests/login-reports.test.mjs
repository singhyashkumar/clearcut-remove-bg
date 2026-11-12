import test from 'node:test';
import assert from 'node:assert/strict';
import {setupLoginReports} from '../src/login-reports.js';
function documentStub(){
 const createElement=tag=>({tag,children:[],hidden:false,append(...items){this.children.push(...items);},prepend(item){this.children.unshift(item);},replaceChildren(){this.children=[];},setAttribute(){},focus(){this.focused=true;}});
 const account=createElement('div'),main=createElement('main');
 return {account,main,createElement,getElementById:()=>account,querySelector:()=>main};
}
test('account change clears reports and stops a stale request before sending its token',async t=>{
 const doc=documentStub();let user={uid:'first'},resolveToken,requests=0;
 t.mock.method(globalThis,'fetch',async()=>{requests++;throw Error();});
 const pending=new Promise(resolve=>resolveToken=resolve);
 const update=setupLoginReports({doc,apiBase:'https://api.example',getUser:()=>user,getToken:()=>pending});
 const button=doc.account.children[0],panel=doc.main.children[0];
 const click=button.onclick();assert.equal(panel.hidden,false);
 user=null;update(user);resolveToken('OLDTOKEN');await click;
 assert.equal(requests,0);assert.equal(panel.hidden,true);assert.equal(button.disabled,true);
 assert.equal(panel.children[2].children.length,0);
});
test('report displays session times as text and clears rows on an account switch',async t=>{
 const doc=documentStub();let user={uid:'first'};
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,'https://api.example/api/security-report');
  assert.equal(options.headers.authorization,'Bearer TOKEN');
  return Response.json({sessions:[{auth_time:1700000000,first_seen_at:1700000001}]});
 });
 const update=setupLoginReports({doc,apiBase:'https://api.example/',getUser:()=>user,getToken:async()=>'TOKEN'});
 await doc.account.children[0].onclick();
 const panel=doc.main.children[0],list=panel.children[2];
 assert.equal(list.children.length,1);assert.match(list.children[0].textContent,/Google sign-in:/);
 user={uid:'second'};update(user);
 assert.equal(panel.hidden,true);assert.equal(list.children.length,0);
});
