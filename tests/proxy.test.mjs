// Synthetic local test fixtures only; no live Sheet records, customers or production credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import handler from '../netlify/functions/pos.mjs';
test('proxy requires selected issue for scoped reads and passes existing auth/request ID without automatic retry',async()=>{
 const oldFetch=globalThis.fetch,oldNetlify=globalThis.Netlify;
 const secret='test-session-secret-not-a-real-key';let calls=[];
 globalThis.Netlify={env:{get:name=>({APPS_SCRIPT_URL:'https://script.google.com/macros/s/test/exec',POS_API_KEY:'test-key',POS_SESSION_SECRET:secret})[name]}};
 globalThis.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return Response.json({success:true,result:{id:'original-bill'}});};
 const request=(action,payload,role='team')=>{
  const data=Buffer.from(JSON.stringify({role,staff:'ทีม A',exp:Date.now()+100000})).toString('base64url');
  const sig=createHmac('sha256',secret).update(data).digest('base64url');
  return new Request('https://example.com/api/pos',{method:'POST',headers:{origin:'https://example.com',cookie:`lb_session=${data}.${sig}`},body:JSON.stringify({action,payload:{...payload,boothScoped:true}})});
 };
 try{
  for(const action of ['history','productImages','sale'])assert.equal((await handler(request(action,{}))).status,400);
  assert.equal(calls.length,0);
  for(const action of ['catalogSave','promotionSave','promotionList','boothPromotionPriceSave'])assert.equal((await handler(request(action,{}))).status,403);
  assert.equal(calls.length,0);
  const response=await handler(request('sale',{issueNo:'A',requestId:'stable-request',staff:'FORGED',items:[{sku:'balm',qty:1,price:100}]}));assert.equal(response.status,200);
  assert.equal(calls.length,1);assert.equal(calls[0].payload.issueNo,'A');assert.equal(calls[0].payload.requestId,'stable-request');assert.equal(calls[0].payload.staff,'ทีม A');
  assert.equal((await handler(request('boothPromotionPriceSave',{scopeIssue:'A',price:20},'boss'))).status,200);
  assert.equal(calls[1].role,'boss');assert.equal(calls[1].payload.scopeIssue,'A');
  globalThis.fetch=async()=>{throw Error('timeout after unknown commit');};const unknown=await handler(request('sale',{issueNo:'A',requestId:'stable-request'}));assert.equal(unknown.status,502);
 }finally{globalThis.fetch=oldFetch;globalThis.Netlify=oldNetlify;}
});
