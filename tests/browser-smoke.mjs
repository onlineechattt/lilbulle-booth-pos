// All products, prices, booth labels, dates and EAN codes below are fabricated test fixtures.
// No live Google Sheet, customer, sale or payment-recipient data is read or included.
// SKU identifiers refer only to the already-public application code.
// Optional browser suite: LILBULLE_PLAYWRIGHT_MODULE may point to a locally bundled Playwright.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.LILBULLE_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve('public'),output=path.resolve('test-results');fs.mkdirSync(output,{recursive:true});
const html=fs.readFileSync(root+'/index.html','utf8');const errors=[],calls=[],assets=[];
let snapshots=0,sales=[],failSale=false;
const products=[{sku:'balm',name:'Test Product A',price:10,barcode:'8850000000010',imageVersion:'1'},{sku:'foam',name:'Test Product B',price:20,barcode:'8805000000010',imageVersion:'1'},{sku:'spray',name:'Test Product C',price:5,barcode:'8850000000027',imageVersion:'1'}];
function snapshot(issue){return {scoped:true,saleContract:2,version:'11.4.1',appVersion:'12.5.0',notificationPolicy:'MANUAL_SUMMARY',products:issue?products.filter(p=>issue==='A'?p.sku!=='spray':p.sku==='spray'):[],booths:issue?[]:[{id:'A',name:'Test Booth A'},{id:'B',name:'Test Booth B'}],bundlePrices:[],warehouse:[],pendingNotifications:0,historyLimit:20,state:issue?{id:issue,name:'Test Booth '+issue,day:'2026-11-12',received:true,closed:false,dayClosed:false,lots:(issue==='A'?['balm','foam']:['spray']).map(sku=>({key:sku+'|31/12/2028',sku,exp:'31/12/2028',remaining:24})),pendingRestocks:[],movements:[],closes:[],lineSummaries:[]}:null,summary:issue?{total:0,bills:0,sales:[],products:[],money:{CASH:0,TRANSFER:0,CARD:0,OTHER:0}}:null};}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/pos'){let body='';req.on('data',b=>body+=b);req.on('end',()=>{const {action,payload}=JSON.parse(body);calls.push({action,payload});let result;
  if(action==='init'){snapshots++;result=snapshot(payload.issueNo);if(payload.includeBooths)result.booths=snapshot('').booths;}
  else if(action==='productImages')result=[];
  else if(action==='history')result={rows:[],count:0,paidCount:0,voidCount:0,total:0,booths:[{id:payload.issueNo,name:'Selected booth'}]};
  else if(action==='sale'){let sale=sales.find(s=>s.payload.requestId===payload.requestId);if(!sale){sale={id:'SALE-'+(sales.length+1),payload};sales.push(sale);}if(failSale){failSale=false;res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'unknown response'}));return;}result={success:true,id:sale.id,duplicate:sales.filter(s=>s.payload.requestId===payload.requestId).length>1};}
  else if(action==='lineSummaryPreview')result={issueNo:payload.issueNo,text:'test manual preview',day:'2026-11-12',previewKey:'preview'};
  else if(action==='sendLineSummary')result={id:'SUMMARY-1',notificationStatus:'SENT'};
  else{res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Unexpected action '+action}));return;}
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true,role:'team',staff:'ทีม A',result}));
 });return;}
 const target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(!fs.existsSync(target)){res.writeHead(404).end();return;}
 assets.push(url.pathname);const type=target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.html')?'text/html':'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});res.end(fs.readFileSync(target));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.LILBULLE_CHROME?{executablePath:process.env.LILBULLE_CHROME}:{})});
function eanBits(code){
 const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];const parity=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];const invert=s=>[...s].map(c=>c==='1'?'0':'1').join('');
 return '00000000000000000000'+'101'+[...code.slice(1,7)].map((v,i)=>parity[Number(code[0])][i]==='L'?L[Number(v)]:invert(L[Number(v)]).split('').reverse().join('')).join('')+'01010'+[...code.slice(7)].map(v=>invert(L[Number(v)])).join('')+'101'+'00000000000000000000';
}
const context=await browser.newContext({viewport:{width:1280,height:1000}});await context.addInitScript(()=>{Object.defineProperty(window,'BarcodeDetector',{value:undefined,configurable:true});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
try{
 await page.goto(base);await page.waitForSelector('#booth option[value=A]',{state:'attached'});assert.equal(calls[0].payload.issueNo,'');assert(!assets.some(p=>p.includes('/vendor/')));
 await page.selectOption('#booth','A');await page.waitForFunction(()=>document.querySelectorAll('#products button').length===2&&!document.getElementById('barcodeAdd').disabled);
 assert(calls.filter(c=>c.action==='productImages').every(c=>c.payload.issueNo==='A'&&!c.payload.skus.includes('spray')));
 const count=calls.length;
 await page.fill('#barcodeInput','0027');await page.press('#barcodeInput','Enter');assert((await page.locator('#barcodeStatus').innerText()).includes('ไม่พบ'));assert.equal(await page.locator('#cartRows .cart-line').count(),0);
 await page.fill('#barcodeInput','0010');await page.press('#barcodeInput','Enter');assert.equal(await page.locator('#barcodeChoices button').count(),2);assert.equal(await page.locator('#cartRows .cart-line').count(),0);
 await page.locator('#barcodeChoices button').first().click();assert.equal(await page.locator('#cartRows .cart-line').count(),1);
 await page.fill('#barcodeInput','8850000000010');await page.press('#barcodeInput','Enter');assert((await page.locator('#cartRows').innerText()).includes('2'));
 assert.equal(calls.length,count,'scanning must not call Sheets per input');
 // A real synthetic EAN-13 image is decoded by the local ZXing fallback, without BarcodeDetector.
 const bits=eanBits('8805000000010');const png=await page.evaluate(bits=>{const canvas=document.createElement('canvas');canvas.width=bits.length*4;canvas.height=230;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='black';[...bits].forEach((b,i)=>{if(b==='1')ctx.fillRect(i*4,15,4,190);});return canvas.toDataURL('image/png').split(',')[1];},bits);
 await page.locator('#scanPhoto').setInputFiles({name:'barcode.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>document.getElementById('barcodeStatus').textContent.includes('เพิ่ม Test Product B'));
 assert(assets.some(p=>p.includes('/vendor/zxing-browser.min.js')));assert.equal(await page.locator('#cartRows .cart-line').count(),2);
 // Camera permission denial gives a fallback and never adds a product.
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError');};});await page.click('#scanCamera');await page.waitForFunction(()=>document.getElementById('barcodeCameraStatus').textContent.includes('ไม่ได้รับอนุญาต'));await page.click('#barcodeCameraClose');
 // Feed an actual canvas MediaStream containing an EAN to the scanner, and verify track release.
 await page.evaluate(bits=>{const canvas=document.createElement('canvas');canvas.width=bits.length*4;canvas.height=230;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='black';[...bits].forEach((b,i)=>{if(b==='1')ctx.fillRect(i*4,15,4,190);});window.__scanCanvas=canvas;navigator.mediaDevices.getUserMedia=async()=>{window.__scanStream=canvas.captureStream(10);window.__drawTimer=setInterval(()=>{ctx.fillStyle='white';ctx.fillRect(0,0,1,1);},70);return window.__scanStream;};},eanBits('8850000000010'));
 await page.click('#scanCamera');await page.waitForFunction(()=>document.getElementById('barcodeStatus').textContent.includes('เพิ่ม Test Product A')&&!document.getElementById('barcodeDialog').open).catch(async e=>{console.error(await page.evaluate(()=>({camera:document.getElementById('barcodeCameraStatus').textContent,status:document.getElementById('barcodeStatus').textContent,video:document.getElementById('barcodeVideo').readyState,tracks:window.__scanStream?.getTracks().map(t=>t.readyState)})));throw e;});assert(await page.evaluate(()=>window.__scanStream.getTracks().every(t=>t.readyState==='ended')));await page.evaluate(()=>clearInterval(window.__drawTimer));
 // Permission may resolve after the user closes the scanner; that late stream must be stopped too.
 assert(await page.evaluate(async()=>{const {createCameraScanner}=await import('/barcode-camera.js');const scanner=createCameraScanner();let release;const stream=window.__scanCanvas.captureStream(10);navigator.mediaDevices.getUserMedia=()=>new Promise(r=>release=r);const pending=scanner.start(document.getElementById('barcodeVideo'),()=>{});scanner.stop();release(stream);await pending;return stream.getTracks().every(t=>t.readyState==='ended');}));
 await page.screenshot({path:output+'/desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // The transfer dialog displays the amount without images.
 await page.selectOption('#payment','TRANSFER');await page.click('#showTransferAmount');assert.equal(await page.locator('#dialogBody img').count(),0);assert((await page.locator('#dialogBody').innerText()).includes('ตรวจชื่อผู้รับและยอดโอน'));await page.click('#dialogClose');await page.selectOption('#payment','CASH');
 // Unknown sale response retains the same request; retry cannot create a second sale.
 failSale=true;await page.click('#pay');await page.waitForFunction(()=>!document.getElementById('pending').hidden&&!document.getElementById('retryPending').disabled);assert(await page.locator('#barcodeInput').isDisabled());const first=calls.filter(c=>c.action==='sale').at(-1).payload.requestId;await page.click('#retryPending');await page.waitForFunction(()=>document.getElementById('pending').hidden);assert.equal(sales.length,1);assert(sales[0].payload.saleLines.length>0);assert(!('items' in sales[0].payload));assert.equal(calls.filter(c=>c.action==='sale').at(-1).payload.requestId,first);
 // Histories stay selected-event-only; they are never preloaded with init.
 assert(!calls.some(c=>c.action==='history'));await page.click('#salesHistoryBtn');await page.waitForSelector('#histBooth option[value=A]',{state:'attached'});assert(await page.locator('#histBooth').isDisabled());assert(calls.filter(c=>c.action==='history').every(c=>c.payload.issueNo==='A'));await page.click('#dialogClose');
 // No LINE messages until explicit preview/send, then preserve the existing manual path.
 assert(!calls.some(c=>c.action==='sendLineSummary'));await page.click('#sendLineSummaryBtn');await page.waitForFunction(()=>!document.getElementById('confirmManualLine').disabled);assert(!calls.some(c=>c.action==='sendLineSummary'));await page.click('#confirmManualLine');await page.waitForFunction(()=>document.getElementById('manualLineInfo').textContent.includes('ส่งแล้ว'));assert.equal(calls.filter(c=>c.action==='sendLineSummary').length,1);await page.click('#dialogClose');
 await page.selectOption('#booth','B');await page.waitForFunction(()=>document.querySelectorAll('#products button').length===1&&!document.getElementById('barcodeAdd').disabled);await page.fill('#barcodeInput','0010');await page.press('#barcodeInput','Enter');assert((await page.locator('#barcodeStatus').innerText()).includes('ไม่พบ'));assert.equal(await page.locator('#cartRows .cart-line').count(),0);
 await page.click('#settingsBtn');
 assert.equal(await page.locator('#bundlePricesBtn').count(),0);
 await page.click('#dialogClose');
 const demo=await browser.newPage();
 await demo.route('**/api/pos',route=>route.fulfill({status:401,json:{error:'Login required'}}));
 await demo.goto(page.url());
 await demo.click('#demoBtn');
 await demo.click('#settingsBtn');
 await demo.click('#bundlePricesBtn');
 await demo.selectOption('#promoScope','global');
 await demo.fill('#promoName','Test Pair');
 await demo.fill('#promoPrice','123.45');
 await demo.fill('[data-promo-sku=balm]','1');
 await demo.fill('[data-promo-sku=mozzie]','1');
 await demo.click('#promoSave');
 await demo.waitForSelector('#actionDialog',{state:'hidden'});
 const fixtureId=await demo.locator('#bundleButtons button').filter({hasText:'Test Pair'}).getAttribute('data-bundle');
 await demo.click('#settingsBtn');
 await demo.click('#bundlePricesBtn');
 await demo.selectOption('#promoChoice',fixtureId);
 assert.equal(await demo.inputValue('#promoPrice'),'123.45');
 await demo.fill('#promoPrice','111.25');
 await demo.click('#promoSave');
 await demo.waitForSelector('#actionDialog',{state:'hidden'});
 assert((await demo.locator('#bundleButtons button').filter({hasText:'Test Pair'}).innerText()).includes('111.25'));
 await demo.click('#settingsBtn');
 await demo.click('#bundlePricesBtn');
 await demo.selectOption('#promoChoice',fixtureId);
 await demo.click('#promoResetPrice');
 await demo.waitForSelector('#actionDialog',{state:'hidden'});
 assert((await demo.locator('#bundleButtons button').filter({hasText:'Test Pair'}).innerText()).includes('123.45'));
 await demo.close();
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: booth barcode, idempotent sale request, manual LINE, boss promotion UI, booth price and global fallback');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
