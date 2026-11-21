// Lilbulle POS V12.5.0
const APP_VERSION='12.5.0';
import {cents,cartDemand,assertStock,cartTotal,saleNote} from './bundles.js?v=12.1.15';
import {matchBoothBarcode} from './barcode.js';
import {createCameraScanner,decodePhoto} from './barcode-camera.js';
const barcodeCamera=createCameraScanner();let barcodeChoiceContext=null;
import {createImageCache} from './product-images.js';
const productImages=createImageCache();let loadGeneration=0;
import {seed,demoRun} from './demo.js';
const $=s=>document.getElementById(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),baht=n=>'฿'+Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}),payNames={CASH:'เงินสด',TRANSFER:'เงินโอน',CARD:'บัตร',OTHER:'อื่น ๆ'};
let demo=false,db=null,role='team',staff='',data={products:[],booths:[]},issue='',cart=[],busy=false,pending=null,animationTimer,toastTimer;
let needsRefresh=true;
const saleBundles=()=> (data.promotions||[]).filter(p=>p.active && p.components.length && p.components.every(c=>data.products.some(x=>x.sku===c.sku)));

// Lean POS: no scene assets or animation module loaded.
const town={update(){},event(){},clear(){}};
function canManagePOS(){return role==='boss'||role==='team';}
function syncTown(){}
async function selectTownBooth(next){if(busy||pending)throw Error('ตรวจสอบรายการรอยืนยันผลก่อนเปลี่ยนบูธ');if(next===issue)return;if(cart.length&&!confirm('เปลี่ยนบูธและล้างตะกร้าปัจจุบันหรือไม่?')){$('booth').value=issue;return;}resetBarcode();issue=next;cart=[];town.event('');setBusy(true);try{await load();}finally{setBusy(false);}}
async function handleTownAction(action,value){if(busy||pending)return;if(action==='selectBooth'){await selectTownBooth(value);return;}if(action==='history'){$('salesHistoryBtn').click();return;}if(action==='booth'){$('booth').scrollIntoView({block:'center',behavior:'smooth'});$('booth').focus({preventScroll:true});return;}if(action==='stock'){if(!data.state?.received)throw Error('เลือกบูธและตรวจรับสินค้าก่อน');const button=$('movementBtn');if(button&&!button.disabled)button.click();else throw Error('งานนี้ยังทำรายการสินค้าไม่ได้');return;}if(action==='shop'){document.querySelector('.catalog').scrollIntoView({block:'start',behavior:'smooth'});document.querySelector('#products button')?.focus({preventScroll:true});}}

const remember=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{throw Error('พื้นที่บันทึกเบราว์เซอร์ไม่พร้อม กรุณาอย่าเริ่มขาย');}};
const recall=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const kindNames={FREE:'แจก',TESTER:'เทสเตอร์',DAMAGE:'ชำรุด'};
const pendingKey=()=>demo?'lb_demo_pending':'lb_live_pending';
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function animate(kind){town.event(kind);}

async function requestJSON(action,payload={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),['init','history','productImages','lineQuota','lineSummaryPreview'].includes(action)?25000:65000);
 try{
  const res=await fetch('/api/pos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload:{...payload,boothScoped:true}}),signal:controller.signal});
  let body;try{body=await res.json();}catch{throw Error('ไม่ได้รับผลยืนยันที่อ่านได้ กรุณาตรวจสอบคำขอเดิม ห้ามสร้างบิลใหม่ซ้ำ');}
  return {res,body};
 }catch(err){if(err.name==='AbortError')throw Error('การเชื่อมต่อใช้เวลานาน ยังยืนยันผลไม่ได้ กรุณาตรวจสอบคำขอเดิม');throw err;}
 finally{clearTimeout(timer);}
}
function refreshMessage(text=''){
 let el=$('refreshStatus');if(!el){el=document.createElement('p');el.id='refreshStatus';el.className='notice';el.setAttribute('role','status');document.querySelector('.toolbar').after(el);}
 el.textContent=text;el.hidden=!text;
}

async function api(action,payload={}){if(demo){const result=demoRun(db,action,payload);remember('lb_demo_db',db);return result;}const {res,body}=await requestJSON(action,payload);if(!res.ok||!body.success){const err=Error(body.error||'เชื่อมต่อไม่สำเร็จ');err.rejected=body.rejected===true;if(res.status===401){productImages.clear();town.clear();loadGeneration++;$('loginDialog').showModal();}throw err;}if(body.role)role=body.role;if(body.staff)staff=body.staff;return body.result;}
function setBusy(b){busy=b;syncBarcodeControls();updateTransferButton();$('refresh').disabled=b;$('receiveBtn').disabled=b||needsRefresh||!data.state||!!data.state.received||!!pending;$('closeBtn').disabled=b||!data.state?.received||!!pending;$('pay').disabled=b||needsRefresh||!!pending||!cart.length||!data.state?.received||data.state?.dayClosed;$('booth').disabled=b||needsRefresh||!!pending;document.querySelectorAll('#products button,#bundleButtons button,#cartRows button,#cartRows input').forEach(el=>el.disabled=b||needsRefresh||!!pending||el.dataset.unavailable==='true');$('retryPending').disabled=b;const move=$('movementBtn');if(move)move.disabled=b||needsRefresh||!!pending||!data.state?.received||data.state?.closed||data.state?.dayClosed;syncTown();}
function productView(p){const image=String(p.image||productImages.get(p)||'');const actual=/^data:image\/(jpeg|png|webp);base64,/.test(image)||(/^https:\/\//.test(image)&&!/^https:\/\/(?:drive|docs)\.google\.com\//.test(image));return actual?`<img src="${esc(image)}" alt="${esc(p.name)} · รูปสินค้าจริง" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:'<div class="product-image-empty">'+(demo?'รูปจริงแสดงเมื่อเข้าสู่ระบบ':'กำลังโหลดรูปสินค้าจริง…')+'</div>';}
$('products').addEventListener('error',e=>{const img=e.target;if(img.tagName!=='IMG')return;const message=document.createElement('div');message.className='product-image-empty';message.textContent='โหลดรูปสินค้าจริงไม่ได้';img.replaceWith(message);},true);
function available(sku){return (data.state?.lots||[]).filter(l=>l.sku===sku).reduce((a,l)=>a+l.remaining,0);}
function render(){const selected=issue;$('booth').innerHTML='<option value="">เลือกบูธ</option>'+data.booths.map(b=>`<option value="${esc(b.id)}">${esc(b.name)} · ${esc(b.id)}</option>`).join('');$('booth').value=selected;$('totalDay').textContent=baht(data.summary?.total);$('billCount').textContent=data.summary?.bills||0;$('stockCount').textContent=data.state?(data.state.lots.reduce((a,l)=>a+l.remaining,0)+' ชิ้น'):'—';$('boothStatus').textContent=!data.state?'รอเลือกบูธ':data.state.closed?'จบบูธแล้ว':data.state.dayClosed?'ปิดยอดวันนี้แล้ว':data.state.received?'เปิดขายได้':'รอตรวจรับ';$('mode').textContent=demo?'โหมดตัวอย่าง · ข้อมูลสมมติ':`${staff||'พนักงาน'} · ${role==='boss'?'แอดมิน':'ทีมงาน · สิทธิ์จัดการ POS'}`;$('mode').textContent+=' · V'+APP_VERSION;$('shopStatus').textContent=demo?'ทดลองได้เต็มที่ · ราคาและจำนวนทั้งหมดเป็นข้อมูลสมมติ':data.state?`${data.state.name} · ${data.state.day}`:'เลือกใบเบิกบูธที่สร้างจากระบบสต็อกเดิม';const products=data.products.filter(p=>data.state?.lots.some(l=>l.sku===p.sku));$('products').innerHTML=products.length?products.map(p=>`<button class="product" data-sku="${esc(p.sku)}">${productView(p)}<strong>${esc(p.name)}</strong><small>คงเหลือ ${available(p.sku)} ชิ้น</small><footer>${p.price?baht(p.price):'ระบุราคาขาย'}<span class="plus">+</span></footer></button>`).join(''):'<p class="empty">เลือกบูธเพื่อดูสินค้าที่เบิกมา</p>';
 $('closeBtn').textContent=data.state?.dayClosed?'ดูสรุปปิดวันนี้':'ปิดยอดรายวัน';$('historyLimit').hidden=!data.historyLimit;$('history').innerHTML=data.summary?.sales?.length?data.summary.sales.slice().reverse().map(e=>`<div class="sale-row"><div class="sale-details"><b>${new Date(e.at).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'})} · ${esc(e.data.lines.map(l=>l.name+' ×'+l.qty).join(', '))}</b><small>${esc(e.id)} · ${esc(e.staff)} · ${payNames[e.data.payment]}</small></div><strong>${baht(e.data.total)}</strong>${canManagePOS()&&!data.state.dayClosed?`<button data-void="${esc(e.id)}">ยกเลิก</button>`:''}</div>`).join(''):'<p class="empty">ยังไม่มีรายการขายวันนี้</p>';
 const notices=[];if(demo)notices.push('ข้อมูลตัวอย่างเท่านั้น ไม่ตัดสต็อกจริงและไม่ส่ง LINE');if(data.state&&!data.state.received)notices.push('ตรวจรับให้ครบก่อนเปิดขาย หากยอดไม่ตรงให้แอดมินตรวจแก้ใบเบิกก่อน');if(data.pendingNotifications)notices.push(`มี ${data.pendingNotifications} สรุปที่เคยกดส่งแล้วยังรอยืนยันผล · ข้อมูลขายบันทึกแล้ว`);$('notice').hidden=!notices.length;$('notice').textContent=notices.join(' · ');$('pending').hidden=!pending;renderCart();renderMovements();renderCloseNotify();renderManualLineStatus();}
function renderBundleButtons(){const demand=cartDemand(cart);$('bundleButtons').innerHTML=saleBundles().map(b=>{const max=Math.max(0,Math.min(...b.components.map(c=>Math.floor((available(c.sku)-(demand[c.sku]||0))/c.qty))));return `<button class="bundle-button" data-bundle="${esc(b.id)}" data-unavailable="${!data.state?.received||data.state.dayClosed||data.state.closed||max<1}" ${!data.state?.received||data.state.dayClosed||data.state.closed||max<1?'disabled':''}><span><b>${esc(b.name)}</b><small>${b.price===null?'ระบุราคารวมต่อเซต':baht(b.price)+' / เซต'}</small></span><span class="plus">+</span></button>`;}).join('');}
function renderCart(){const total=cartTotal(cart);$('cartRows').innerHTML=cart.length?cart.map(l=>`<div class="cart-line ${l.components?'cart-set':''}"><strong>${esc(l.name)}</strong>${l.components?`<small>${l.components.map(c=>esc(data.products.find(p=>p.sku===c.sku)?.name||c.sku)+' ×'+c.qty).join(' + ')}</small>`:''}<div class="line-controls"><button data-minus="${esc(l.key)}" aria-label="ลดจำนวน ${esc(l.name)}">−</button><b>${l.qty}${l.components?' เซต':''}</b><button data-plus="${esc(l.key)}" aria-label="เพิ่มจำนวน ${esc(l.name)}">+</button><input aria-label="${l.components?'ราคารวมต่อเซต':'ราคาขาย'} ${esc(l.name)}" data-price="${esc(l.key)}" type="number" min="0.01" step="0.01" value="${l.price}"><small>${l.components?'บาท / เซต':'บาท / ชิ้น'}</small></div></div>`).join(''):'<p class="empty">เลือกสินค้า หรือกดเซตให้ลูกค้า ♡</p>';$('cartTotal').textContent=baht(total);renderBundleButtons();setBusy(busy);updateTransferButton();}
async function load(refreshBooths=false){
 resetBarcode();const token=++loadGeneration;needsRefresh=true;setBusy(busy);
 try{const snapshot=await api('init',{issueNo:issue,includeBooths:!issue||!data.booths?.length||refreshBooths});if(token!==loadGeneration)return;if(!demo&&(snapshot.scoped!==true||snapshot.saleContract!==2))throw Error('กรุณาอัปเดต Apps Script เป็น V12.5.0 ก่อนใช้เว็บชุดนี้');if(issue&&!snapshot.booths?.length)snapshot.booths=data.booths;data=snapshot;needsRefresh=false;refreshMessage();render();if(!demo)void loadProductImages(token);}
 catch(err){if(token===loadGeneration){needsRefresh=true;refreshMessage('โหลดข้อมูลล่าสุดไม่สำเร็จ · กดรีเฟรชข้อมูลก่อนทำรายการถัดไป · อย่าสร้างบิลเดิมซ้ำ');setBusy(busy);}throw err;}
}
async function loadProductImages(token){try{
 const products=data.products.filter(p=>data.state?.lots.some(l=>l.sku===p.sku));
 await productImages.load(products,skus=>api('productImages',{skus,issueNo:issue}));
 if(token!==loadGeneration||demo)return;
 syncTown();document.querySelectorAll('#products button[data-sku]').forEach(button=>{const p=data.products.find(p=>p.sku===button.dataset.sku);if(p)button.firstElementChild.outerHTML=productView(p);});
 }catch{if(token===loadGeneration)document.querySelectorAll('#products .product-image-empty').forEach(el=>el.textContent='โหลดรูปไม่ได้ · กดรีเฟรชเพื่อลองใหม่');}}

function actionFeedback(text){const el=$('actionStatus');if(el){el.textContent=text;el.hidden=false;}toast(text);}
function safe(handler){return async e=>{try{await handler(e);}catch(err){actionFeedback('ไม่สำเร็จ / ยังยืนยันผลไม่ได้: '+err.message);}};}
function ensureSelling(){if(needsRefresh)throw Error('กรุณารีเฟรชข้อมูลล่าสุดก่อนขาย');if(busy||pending)throw Error('รอยืนยันรายการก่อน');if(!data.state?.received)throw Error('ตรวจรับสินค้าก่อนเปิดขาย');if(data.state.dayClosed||data.state.closed)throw Error('งานนี้ปิดการขายแล้ว');}
function add(sku){ensureSelling();const p=data.products.find(p=>p.sku===sku);if(!p)throw Error('ไม่พบสินค้า');const next=cart.map(r=>({...r})),line=next.find(r=>!r.components&&r.sku===sku);if(line)line.qty++;else next.push({key:'single-'+sku,sku,name:p.name,price:p.price,basePrice:p.price,qty:1});assertStock(next,available);cart=next;animate('order');renderCart();}
function openBundle(id){ensureSelling();const bundle=saleBundles().find(b=>b.id===id);if(!bundle)throw Error('ไม่พบเซต');showDialog('เพิ่มเซต · '+bundle.name,`<p>${bundle.components.map(c=>esc(data.products.find(p=>p.sku===c.sku)?.name||c.sku)+' ×'+c.qty).join(' + ')}</p><label for="bundleQty">จำนวนเซต<input id="bundleQty" type="number" min="1" step="1" value="1"></label><label for="bundlePrice">ราคารวมต่อเซต (บาท)<input id="bundlePrice" type="number" min="0.01" step="0.01" value="${bundle.price??''}" placeholder="กรอกราคารวมต่อเซต" required></label><p class="hint">กรอกราคารวมของทั้งเซต ไม่ใช่ราคาต่อชิ้น · สินค้าจะลดตามองค์ประกอบของเซต</p><button id="confirmBundle" class="primary">เพิ่มเซตลงตะกร้า</button>`);$('confirmBundle').onclick=safe(()=>{ensureSelling();const price=cents($('bundlePrice').value)/100,qty=Number($('bundleQty').value);const next=cart.map(r=>({...r})),old=next.find(r=>r.bundleId===id&&r.price===price&&r.basePrice===bundle.price&&r.revision===bundle.revision&&r.boothRevision===bundle.boothRevision);if(!Number.isInteger(qty)||qty<1||qty>100000)throw Error('กรอกจำนวนเซตเป็นจำนวนเต็ม');if(old)old.qty+=qty;else next.push({key:'set-'+crypto.randomUUID(),bundleId:id,basePrice:bundle.price,revision:bundle.revision,boothRevision:bundle.boothRevision,name:bundle.name,components:bundle.components.map(c=>({...c})),price,qty});assertStock(next,available);if(Math.round(price*100)<bundle.components.reduce((sum,c)=>sum+c.qty,0))throw Error('ราคาเซตต่ำเกินไปสำหรับจำนวนสินค้า');cart=next;renderCart();animate('packing');$('actionDialog').close();});}
$('bundleButtons').onclick=safe(e=>{const button=e.target.closest('[data-bundle]');if(button&&!button.disabled)openBundle(button.dataset.bundle);});
async function mutate(action,payload){if(needsRefresh)throw Error('กรุณารีเฟรชข้อมูลล่าสุดก่อนทำรายการ');if(pending)throw Error('มีรายการรอยืนยันผล กรุณาตรวจสอบก่อน');pending={action,payload:{...payload,issueNo:issue,staff,requestId:crypto.randomUUID()}};remember(pendingKey(),pending);return sendPending();}
async function sendPending(){

 if(!pending)return;
 setBusy(true);
 try{
  const task=pending;const result=await api(task.action,task.payload);
  pending=null;localStorage.removeItem(pendingKey());needsRefresh=true;
  if(task.action==='sale'){cart=[];$('note').value='';$('receipt').value='';$('receiptPreview').hidden=true;renderCart();animate('paid');}
  else if(['restock','receiveRestock','stockOut'].includes(task.action)){animate('restock');}
  const message=result.notificationStatus==='MANUAL'?(task.action==='closeDay'?'บันทึกปิดยอดสำเร็จ · ยังไม่ได้ส่ง LINE กดส่งสรุปเองเมื่อต้องการ':'บันทึกสำเร็จ · ไม่ส่ง LINE อัตโนมัติ'):task.action==='closeDay'?('บันทึกปิดยอดแล้ว · '+(result.notificationStatus==='SENT'?'ส่งสรุป LINE สำเร็จ (LINE รับคำขอแล้ว)':result.notificationPending?'LINE ยังส่งไม่สำเร็จ รอส่งใหม่':'ยังยืนยันสถานะ LINE ไม่ได้')):(result.duplicate?'ตรวจพบรายการเดิม บันทึกไว้แล้ว':'บันทึกสำเร็จ')+(result.notificationPending?' · LINE ยังส่งไม่สำเร็จ รอส่งใหม่':result.notificationStatus==='SENT'?' · ส่ง LINE สำเร็จ (LINE รับคำขอแล้ว)':'');
  refreshMessage(message+' · กำลังโหลดข้อมูลล่าสุด');toast(message);$('actionDialog').close();
  try{await load();}catch{refreshMessage(message+' · โหลดข้อมูลล่าสุดไม่สำเร็จ กดรีเฟรชข้อมูลก่อนทำรายการถัดไป ไม่ต้องบันทึกบิลนี้ซ้ำ');}
  return result;
 }catch(err){
  if(err.rejected){pending=null;localStorage.removeItem(pendingKey());}
  else refreshMessage('ยังไม่ได้รับผลยืนยัน · ใช้ปุ่มตรวจสอบรายการรอยืนยันผลเพื่อส่งคำขอเดิม ห้ามสร้างบิลใหม่ซ้ำ');
  throw err;
 }finally{setBusy(false);$('pending').hidden=!pending;}
}
$('products').addEventListener('click',safe(e=>{const button=e.target.closest('[data-sku]');if(button)add(button.dataset.sku);}));$('cartRows').addEventListener('click',safe(e=>{ensureSelling();const plus=e.target.closest('[data-plus]'),minus=e.target.closest('[data-minus]');if(!plus&&!minus)return;const key=(plus||minus).dataset[plus?'plus':'minus'];const next=cart.map(r=>({...r})),row=next.find(r=>r.key===key);if(!row)return;row.qty+=plus?1:-1;const remaining=next.filter(r=>r.qty>0);assertStock(remaining,available);cart=remaining;renderCart();if(!cart.length)animate('');}));
$('cartRows').addEventListener('change',safe(e=>{const key=e.target.dataset.price;if(!key)return;ensureSelling();const row=cart.find(r=>r.key===key);if(!row)return;try{row.price=cents(e.target.value)/100;}finally{renderCart();}}));
$('clearCart').onclick=()=>{if(busy||pending)return;cart=[];renderCart();animate('');};$('booth').onchange=safe(()=>selectTownBooth($('booth').value));$('refresh').onclick=safe(async()=>{setBusy(true);try{await load(true);}finally{setBusy(false);}});$('retryPending').onclick=safe(sendPending);
async function filePayload(file,kind){if(!file)return null;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2000000)throw Error('ใช้ JPG PNG WEBP ขนาดไม่เกิน 2 MB');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('อ่านรูปไม่ได้'));reader.onload=()=>resolve({kind,issueNo:kind==='receipt'?issue:'',mime:file.type,base64:reader.result.split(',')[1],staff,requestId:crypto.randomUUID()});reader.readAsDataURL(file);});}
$('receipt').onchange=safe(async()=>{const file=$('receipt').files[0];if(!file){$('receiptPreview').hidden=true;return;}await filePayload(file,'receipt');$('receiptPreview').src=URL.createObjectURL(file);$('receiptPreview').hidden=false;});
$('pay').onclick=safe(async()=>{
 if(busy||pending||needsRefresh||!cart.length)return;
 if(cart.length>30)throw Error('เลือกสินค้า 1–30 รายการต่อบิล');
 assertStock(cart,available);
 const saleLines=cart.map(row=>{
  const amount=cents(row.price);
  if(!Number.isInteger(row.qty)||row.qty<1||row.qty>100000)throw Error('กรอกจำนวนให้ถูกต้อง');
  if(row.components&&amount<row.components.reduce((n,c)=>n+c.qty,0))throw Error('ราคาเซตต่ำเกินไปสำหรับจำนวนสินค้า');
  const ref=row.bundleId
   ? {promotionId:row.bundleId,revision:row.revision,boothRevision:row.boothRevision}
   : {sku:row.sku};
  return {...ref,qty:row.qty,basePrice:row.basePrice,price:amount/100};
 });
 let priceReason='';
 if(saleLines.some(r=>r.price!==r.basePrice)){
  const reason=prompt('ระบุเหตุผลที่ปรับราคาจากราคาที่ตั้งไว้ (อย่างน้อย 5 ตัวอักษร)');
  if(reason===null)return;
  priceReason=reason.trim();
  if(priceReason.length<5||priceReason.length>250)throw Error('ระบุเหตุผลที่ปรับราคา 5–250 ตัวอักษร');
 }
 const totalCents=saleLines.reduce((total,row)=>total+cents(row.price)*row.qty,0);
 const payment=$('payment').value,note=saleNote(cart,$('note').value);
 if(!confirm(`ยืนยันรับเงิน ${baht(totalCents/100)} ทาง${payNames[payment]} แล้วใช่ไหม?`))return;
 setBusy(true);
 try{
  const file=$('receipt').files[0];
  const photoId=file?(await api('upload',await filePayload(file,'receipt'))).id:'';
  await mutate('sale',{saleLines,totalCents,priceReason,payment,note,photoId});
 }finally{setBusy(false);}
});
function showDialog(title,html){$('dialogTitle').textContent=title;$('dialogBody').onclick=null;$('dialogBody').innerHTML='<p id="actionStatus" role="status" aria-live="polite" hidden style="padding:12px;background:#f4ede2;border-radius:8px"></p>'+html;$('actionDialog').showModal();}$('dialogClose').onclick=()=>{if(!busy)$('actionDialog').close();};
function countInputs(){return data.state.lots.map((l,i)=>`<div class="count-row"><div>${esc(data.products.find(p=>p.sku===l.sku)?.name||l.sku)}<small>Exp ${esc(l.exp)} · ตามระบบ ${l.remaining} ชิ้น</small></div><input type="number" min="0" step="1" required aria-label="จำนวนจริง ${esc(l.sku)}" data-count="${i}" placeholder="นับจริง"></div>`).join('');}
function getCounts(){return [...$('dialogBody').querySelectorAll('[data-count]')].map(el=>{if(el.value===''||!Number.isInteger(Number(el.value))||Number(el.value)<0)throw Error('กรอกจำนวนจริงให้ครบทุกล็อต');return {key:data.state.lots[Number(el.dataset.count)].key,actual:Number(el.value)};});}
$('receiveBtn').onclick=safe(()=>{if(!data.state)return;showDialog('ตรวจรับสินค้าหน้างาน',`<p class="hint">นับจำนวนจริง ไม่ตรงใบเบิกให้แอดมินตรวจแก้ก่อนเปิดขาย</p>${countInputs()}<label for="receiveNote">หมายเหตุ (ไม่บังคับ)</label><input id="receiveNote"><div class="dialog-actions"><button id="confirmReceive" class="primary">ยืนยันตรวจรับ</button></div>`);$('confirmReceive').onclick=safe(async()=>{const counts=getCounts();if(counts.some(x=>x.actual!==data.state.lots.find(l=>l.key===x.key).remaining))throw Error('จำนวนไม่ตรงใบเบิก กรุณาให้แอดมินตรวจสอบก่อน');await mutate('receive',{counts,note:$('receiveNote').value});});});
$('closeBtn').onclick=safe(()=>{if(!data.state?.received)return;if(data.state.dayClosed){const close=data.state.closes?.find(c=>c.day===data.state.day);if(close){showDialog('สรุปปิดการขาย '+close.day,closeReport(close));return;}}if(cart.length)throw Error('มีสินค้าในตะกร้า กรุณาขายหรือล้างตะกร้าก่อนปิดวัน');showDialog('ตรวจยอดและปิดการขายวันนี้',`<p>ยอดขายตามบิล <b>${baht(data.summary.total)}</b> · ${data.summary.bills} บิล</p><table><thead><tr><th>สินค้า</th><th>ขายแล้ว</th></tr></thead><tbody>${data.summary.products.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.qty} ชิ้น</td></tr>`).join('')}</tbody></table><h3>นับสินค้าคงเหลือ</h3>${countInputs()}<h3>ตรวจเงินรับจริง</h3>${Object.keys(payNames).map(k=>`<label>${payNames[k]} · ตามบิล ${baht(data.summary.money[k])}<input id="money${k}" type="number" min="0" step="0.01" placeholder="รับเงินจริง ใส่ 0 ถ้าไม่มี"></label>`).join('')}<label>หมายเหตุส่วนต่าง<input id="closeNote"></label><p class="hint">หากยอดต่างกัน ต้องระบุเหตุผลก่อนยืนยัน · ปิดแล้วขายเพิ่มในวันเดียวกันไม่ได้</p><p id="closeError" class="notice warning" role="alert" hidden></p><button id="confirmClose" class="primary">ยืนยันปิดยอดวันนี้</button>`);$('confirmClose').onclick=async()=>{const error=$('closeError');error.hidden=true;try{const counts=getCounts(),money={};for(const k of Object.keys(payNames)){const raw=$('money'+k).value;if(raw===''||!Number.isFinite(Number(raw))||Number(raw)<0)throw Error('กรอกเงินรับจริงช่อง '+payNames[k]+' (หากไม่มี ให้ใส่ 0)');money[k]=Number(raw);}const mismatch=counts.some(c=>c.actual!==data.state.lots.find(l=>l.key===c.key).remaining)||Object.keys(money).some(k=>money[k]!==data.summary.money[k]);if(mismatch&&(!canManagePOS()||$('closeNote').value.trim().length<5))throw Error('ยอดต่างกัน กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร');await mutate('closeDay',{counts,money,note:$('closeNote').value});}catch(err){error.textContent=err.message;error.hidden=false;error.scrollIntoView?.({block:'nearest'});}};});
$('history').onclick=safe(async e=>{const button=e.target.closest('[data-void]');if(!button||busy||pending)return;const note=prompt('เหตุผลยกเลิกบิล (อย่างน้อย 5 ตัวอักษร)');if(!note)return;if(note.trim().length<5)throw Error('ระบุเหตุผลอย่างน้อย 5 ตัวอักษร');await mutate('void',{billId:button.dataset.void,note});});
$('settingsBtn').onclick=()=>{showDialog('จัดการร้าน',`<div class="settings-grid"><p>เวอร์ชันเว็บ: V${APP_VERSION}<br>เวอร์ชันหลังบ้าน: ${demo?'โหมดตัวอย่าง':data.appVersion?'V'+esc(data.appVersion):'รุ่นเดิม · ยังไม่รายงานเวอร์ชัน'}</p>${!demo&&data.appVersion!==APP_VERSION?'<p class="hint">เวอร์ชันเว็บและหลังบ้านยังไม่ตรงกัน กรุณาอัปเดตทั้งสองส่วน</p>':''}<p>การแจ้ง LINE: ${demo?'โหมดตัวอย่าง':data.notificationPolicy==='MANUAL_SUMMARY'?'ส่งสรุปเฉพาะเมื่อกดเอง · ไม่มีแจ้งอัตโนมัติ':'ยังไม่ยืนยันโหมด กรุณาตรวจหลังบ้าน V12.1.15'}</p><p>ผู้ใช้: ${esc(staff)} · ${role==='boss'?'แอดมิน':'ทีมงาน · สิทธิ์จัดการ POS'}</p><label for="stockUrl">ลิงก์ระบบสต็อกเดิม (ใช้สร้างบูธ / เบิก / คืน)</label><input id="stockUrl" type="url" value="${esc(recall('lb_stock_url',''))}" placeholder="https://script.google.com/macros/s/.../exec"><button id="openStock">เปิดระบบสต็อก / สร้างบูธ</button>${canManagePOS()?'<button id="lineQuotaBtn">ตรวจโควตา LINE</button><button id="manualLineBtn">ดูยอด / ส่งสรุปเข้า LINE เอง</button><button id="retryNotify">ส่งซ้ำเฉพาะสรุปที่เคยกดส่งแล้ว</button>':''}${role==='boss'?'<button id="catalogBtn">รูปสินค้าและราคาขายแนะนำ</button><button id="bundlePricesBtn">จัดการเซตและราคาตามบูธ</button>':''}${demo?'<button id="resetDemo">เริ่มข้อมูลตัวอย่างใหม่</button>':''}<button id="reportsBtn">สรุปปิดวันย้อนหลัง</button><button id="logout">ออกจากระบบ / เปลี่ยนผู้ใช้</button></div>`);$('openStock').onclick=safe(()=>{const url=$('stockUrl').value;if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url))throw Error('ใส่ลิงก์ Web App ระบบสต็อกเดิม');remember('lb_stock_url',url);window.open(url,'_blank','noopener,noreferrer');actionFeedback('บันทึกลิงก์และส่งคำขอเปิดระบบสต็อกแล้ว');});if($('manualLineBtn'))$('manualLineBtn').onclick=safe(openManualLineSummary);if($('catalogBtn'))$('catalogBtn').onclick=catalogDialog;if($('bundlePricesBtn'))$('bundlePricesBtn').onclick=safe(promotionDialog);if($('lineQuotaBtn'))$('lineQuotaBtn').onclick=safe(openLineQuota);if($('retryNotify'))$('retryNotify').onclick=safe(async()=>{const button=$('retryNotify');button.disabled=true;actionFeedback('กำลังตรวจและส่งคิวค้าง…');try{const result=await api('retryNotify');const message=`ส่งข้อความสำเร็จ ${result.sent??'ไม่ทราบ'} รายการ · ยังรอส่ง ${result.remaining??'ไม่ทราบ'} รายการ`;actionFeedback(message);try{await load();}catch{actionFeedback(message+' · โหลดหน้าร้านล่าสุดไม่ได้ กรุณารีเฟรช ไม่ต้องกดส่งซ้ำ');}}finally{button.disabled=false;}});if($('resetDemo'))$('resetDemo').onclick=safe(async()=>{if(!confirm('ล้างข้อมูลตัวอย่างแล้วเริ่มใหม่?'))return;db=seed();cart=[];pending=null;localStorage.removeItem(pendingKey());remember('lb_demo_db',db);$('actionDialog').close();await load();animate('');toast('เริ่มข้อมูลตัวอย่างใหม่สำเร็จ');});$('reportsBtn').onclick=()=>{const closes=data.state?.closes||[];showDialog('สรุปปิดวันย้อนหลัง',closes.length?closes.slice().reverse().map(c=>`<details><summary>${esc(c.day)} · ${baht(c.data.summary.total)}</summary>${closeReport(c)}</details>`).join(''):'<p>ยังไม่มีรายการปิดวันของบูธนี้</p>');};$('logout').onclick=safe(async()=>{if(pending)throw Error('ตรวจสอบรายการรอยืนยันผลก่อนออกจากระบบ');if(!demo)await api('logout');productImages.clear();town.clear();loadGeneration++;$('products').replaceChildren();resetBarcode();demo=false;cart=[];issue='';data={products:[],booths:[]};$('actionDialog').close();$('loginDialog').showModal();toast('ออกจากระบบสำเร็จ');});};

function closeReport(close){const r=close.data;return closeNotifyHTML(close)+`<p>ผู้ปิดยอด ${esc(close.staff)} · วันที่ ${esc(close.day)}</p><h3>ยอดขาย ${baht(r.summary.total)} / ${r.summary.bills} บิล</h3><table><thead><tr><th>สินค้า</th><th>จำนวนขาย</th><th>ยอด</th></tr></thead><tbody>${r.summary.products.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td>${baht(p.total)}</td></tr>`).join('')}</tbody></table><h3>แจก / เทสเตอร์ / ชำรุด</h3>${(r.summary.movements||[]).length?(r.summary.movements||[]).map(m=>`<p>${esc(kindNames[m.kind])} · ${esc(m.name)} × ${m.qty}</p>`).join(''):'<p>ไม่มีรายการ</p>'}<h3>เงินรับจริง</h3><table><thead><tr><th>ช่องทาง</th><th>ตามบิล</th><th>รับจริง</th></tr></thead><tbody>${Object.keys(payNames).map(k=>`<tr><td>${payNames[k]}</td><td>${baht(r.summary.money[k])}</td><td>${baht(r.actualMoney[k])}</td></tr>`).join('')}</tbody></table><h3>สินค้าคงเหลือ</h3>${r.counts.map(c=>`<p>${esc(data.products.find(p=>p.sku===(c.sku||c.key.split('|')[0]))?.name||c.key)} · ${esc(c.exp||c.key.split('|')[1])} · ตามระบบ ${c.expected} / นับจริง ${c.actual}</p>`).join('')}<p>หมายเหตุ: ${esc(r.note||'—')}</p>`;}

function catalogDialog(){showDialog('รูปสินค้าและราคาแนะนำ',`<p class="hint">รูปสินค้าไม่บังคับ · รูปสินค้าจะแสดงต่อผู้ใช้เว็บ ส่วนสลิปเก็บแยกโดยไม่เปิดสาธารณะ</p>${data.products.map(p=>`<div class="catalog-edit"><h3>${esc(p.name)}</h3><label>ราคาแนะนำ<input type="number" min="0" step="0.01" data-edit-price="${esc(p.sku)}" value="${p.price}"></label><label>URL รูปสินค้า HTTPS<input data-edit-image="${esc(p.sku)}" value="${esc(p.imageSource??p.image)}"></label><label>หรือแนบรูปสินค้า (ไม่บังคับ)<input type="file" accept="image/jpeg,image/png,image/webp" data-edit-file="${esc(p.sku)}"></label><button data-save-product="${esc(p.sku)}">บันทึกสินค้านี้</button></div>`).join('')}`);$('dialogBody').onclick=safe(async e=>{const button=e.target.closest('[data-save-product]');if(!button)return;button.disabled=true;try{const sku=button.dataset.saveProduct,price=Number(document.querySelector(`[data-edit-price="${sku}"]`).value);if(!Number.isFinite(price)||price<0)throw Error('ราคาไม่ถูกต้อง');let image=document.querySelector(`[data-edit-image="${sku}"]`).value;const file=document.querySelector(`[data-edit-file="${sku}"]`).files[0];if(file){const uploaded=await api('upload',await filePayload(file,'product'));image=uploaded.data.image;}actionFeedback('กำลังบันทึกรูปและราคา…');await api('catalogSave',{sku,price,image});productImages.clear();actionFeedback('บันทึกรูปและราคาสำเร็จ');try{await load();}catch{actionFeedback('บันทึกรูปและราคาสำเร็จ แต่โหลดหน้าร้านล่าสุดไม่ได้ กรุณารีเฟรช');}}finally{button.disabled=false;}});}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginError').textContent='กำลังตรวจสอบ…';try{const {res,body}=await requestJSON('login',{staff:$('staff').value,pin:$('pin').value});if(!res.ok||!body.success)throw Error(body.error||'เข้าสู่ระบบไม่สำเร็จ');productImages.clear();town.clear();demo=false;role=body.role;staff=body.staff;issue='';pending=recall(pendingKey(),null);if(pending)issue=pending.payload.issueNo;$('pin').value='';await load();$('loginDialog').close();}catch(err){$('loginError').textContent=err.message;}};
$('demoBtn').onclick=safe(async()=>{town.clear();demo=true;role='boss';staff='พนักงานตัวอย่าง';db=recall('lb_demo_db',null)||seed();issue='DEMO-BOOTH';pending=recall(pendingKey(),null);cart=[];await load();$('loginDialog').close();});
$('loginDialog').addEventListener('cancel',e=>e.preventDefault());
(async()=>{pending=recall('lb_live_pending',null);if(pending)issue=pending.payload.issueNo;try{await load();}catch{$('loginDialog').showModal();}})();



function renderMovements(){
 const receive=$('receiveBtn');let button=$('movementBtn');if(!button){button=document.createElement('button');button.id='movementBtn';button.textContent='เติมของ / แจก / เทสเตอร์ / ชำรุด';receive.parentElement.appendChild(button);button.onclick=safe(openMovement);}
 let section=$('movementsPanel');if(!section){section=document.createElement('section');section.id='movementsPanel';section.className='panel history';document.querySelector('main').appendChild(section);}
 const transfers=data.state?.pendingRestocks||[],moves=data.state?.movements||[];
 section.innerHTML='<div class="section-head"><h2>การเคลื่อนไหวสินค้าในบูธ</h2><span class="badge">V'+esc(APP_VERSION)+'</span></div>'+(transfers.length?'<h3>สินค้าเติมรอตรวจรับ</h3>'+transfers.map(t=>`<div class="sale-row"><div><b>${esc(t.id)}</b><small>${t.data.lines.map(l=>esc(l.name)+' ×'+l.qty+' Exp '+esc(l.exp)).join('<br>')}</small></div><button data-transfer="${esc(t.id)}">ตรวจรับของเติม</button></div>`).join(''):'')+(moves.length?moves.slice(-25).reverse().map(m=>`<div class="sale-row"><div><b>${esc(m.type==='RESTOCK'?'เบิกเติมจากคลัง':m.type==='RESTOCK_RECEIVE'?'ตรวจรับของเติม':kindNames[m.data.kind])}</b><small>${esc(m.staff)} · ${esc(m.at)} · ${esc(m.data.note||'')}</small>${(m.data.lines||[]).map(l=>`<small>${esc(l.name)} ×${l.qty} · Exp ${esc(l.exp)}</small>`).join('')}</div><span>${m.type==='OUT'?'ไม่ใช่ยอดขาย':''}</span></div>`).join(''):'<p class="empty">ยังไม่มีรายการเติม แจก เทสเตอร์ หรือชำรุด</p>');
 section.onclick=safe(e=>{const el=e.target.closest('[data-transfer]');if(el)receiveTransfer(el.dataset.transfer);});setBusy(busy);
}
function requireMovementVersion(){if(!data.version||Number(data.version.split('.')[1])<1)throw Error('ต้องอัปเดต Apps Script เป็น V11.1 ก่อนใช้รายการสินค้า กรุณาติดตั้งไฟล์อัปเดต');}
function movementRows(lots,mode){return lots.filter(l=>(mode==='restock'?l.qty:l.remaining)>0).map((l,i)=>`<div class="count-row"><div>${esc(data.products.find(p=>p.sku===l.sku)?.name||l.sku)}<small>Exp ${esc(l.exp)} · ${mode==='restock'?'คลังกลาง':'ในบูธ'} ${mode==='restock'?l.qty:l.remaining} ชิ้น</small></div><input type="number" min="0" step="1" data-move-key="${esc(l.key)}" placeholder="จำนวน"></div>`).join('');}
function openMovement(){
 requireMovementVersion();if(!data.state?.received)throw Error('ตรวจรับก่อน');if(cart.length)throw Error('ขายหรือล้างตะกร้าก่อนบันทึกสินค้า');
 showDialog('สินค้าในบูธ · ใช้เลขเบิกเดิม',`<label for="movementKind">ประเภทรายการ</label><select id="movementKind"><option value="RESTOCK">บันทึกของเติม → รอตรวจรับที่บูธ</option><option value="FREE">แจก</option><option value="TESTER">เทสเตอร์</option><option value="DAMAGE">ชำรุด</option></select><div id="movementRows"></div><label for="movementNote">เหตุผล / เลขเบิกเติม (บังคับ)</label><input id="movementNote" maxlength="500"><p class="hint">เติมของเป็นบันทึก POS เท่านั้น ต้องเบิกจริงในระบบคลังแยก และตรวจรับก่อนขาย ไม่หักคลังซ้ำ · ระบุ EXP ตามของที่นำมา</p><button id="confirmMovement" class="primary">บันทึกรายการ</button>`);
 const update=()=>{
  $('movementRows').innerHTML=$('movementKind').value==='RESTOCK'?data.products.map((p,i)=>`<div class="count-row"><div>${esc(p.name)}<label>EXP ของที่เติม<input data-restock-exp="${i}" placeholder="dd/MM/yyyy" aria-label="EXP ${esc(p.name)}"></label></div><input type="number" min="0" step="1" data-restock-sku="${esc(p.sku)}" data-restock-index="${i}" placeholder="จำนวน"></div>`).join(''):movementRows(data.state.lots,'out');
 };$('movementKind').onchange=update;update();
 $('confirmMovement').onclick=safe(async()=>{
  const kind=$('movementKind').value,restock=kind==='RESTOCK',items=[];
  for(const input of $('movementRows').querySelectorAll(restock?'[data-restock-sku]':'[data-move-key]')){
   if(!input.value||Number(input.value)===0)continue;const qty=Number(input.value);if(!Number.isInteger(qty)||qty<1||qty>100000)throw Error('กรอกจำนวนเต็ม 1–100000');
   if(restock){const exp=document.querySelector(`[data-restock-exp="${input.dataset.restockIndex}"]`).value.trim();if(!exp)throw Error('กรอก EXP ของสินค้าที่เติม');items.push({sku:input.dataset.restockSku,exp,qty});}
   else{const lot=data.state.lots.find(l=>l.key===input.dataset.moveKey);if(!lot||qty>lot.remaining)throw Error('จำนวนเกินของในบูธ');items.push({key:lot.key,qty});}
  }
  if(!items.length)throw Error('เลือกอย่างน้อยหนึ่งรายการ');const note=$('movementNote').value.trim();if(note.length<5)throw Error('ระบุเหตุผลอย่างน้อย 5 ตัวอักษร');
  if(!confirm(restock?'บันทึกเฉพาะของเติมใน POS โดยไม่หักคลังกลาง ยืนยันว่าได้ทำใบเบิกจริงแยกแล้ว?':`ยืนยันรายการ${kindNames[kind]} โดยไม่เป็นยอดขาย?`))return;
  await mutate(restock?'restock':'stockOut',{items,kind:restock?undefined:kind,note});
 });
}

function receiveTransfer(id){requireMovementVersion();if(cart.length)throw Error('ขายหรือล้างตะกร้าก่อนตรวจรับ');const transfer=data.state.pendingRestocks.find(t=>t.id===id);if(!transfer)throw Error('รายการนี้รับแล้ว กรุณารีเฟรช');showDialog('ตรวจรับสินค้าเติม',`<p>${esc(id)}</p>${transfer.data.lines.map(l=>`<div class="count-row"><div>${esc(l.name)}<small>Exp ${esc(l.exp)} · ส่งมา ${l.qty}</small></div><input type="number" min="0" step="1" data-transfer-count="${esc(l.key)}" placeholder="นับจริง"></div>`).join('')}<label>หมายเหตุ (ไม่บังคับ)<input id="transferNote"></label><button id="confirmTransfer" class="primary">รับของเติมเข้าบูธ</button>`);$('confirmTransfer').onclick=safe(async()=>{const counts=[...$('dialogBody').querySelectorAll('[data-transfer-count]')].map(input=>{if(input.value===''||!Number.isInteger(Number(input.value))||Number(input.value)<0)throw Error('นับให้ครบทุกล็อต');return {key:input.dataset.transferCount,actual:Number(input.value)};});if(counts.some(c=>c.actual!==transfer.data.lines.find(l=>l.key===c.key).qty))throw Error('จำนวนไม่ตรง กรุณาแจ้งแอดมินก่อนรับ');await mutate('receiveRestock',{transferId:id,counts,note:$('transferNote').value});});}

$('salesHistoryBtn').onclick=safe(async()=>{
 if(!issue||busy||pending||needsRefresh)throw Error('เลือกบูธและโหลดข้อมูลล่าสุดก่อนดูประวัติ');
 showDialog('ประวัติการขายย้อนหลัง',`<label>งานบูธ<select id="histBooth" disabled></select></label><label>วันที่ (เว้นว่างดูทุกวัน)<input id="histDay" type="date"></label><label>ค้นหาเลขบิล / ผู้ขาย / สินค้า<input id="histQuery" type="search"></label><label>สถานะ<select id="histStatus"><option value="">ทั้งหมด</option><option value="PAID">ขายสำเร็จ</option><option value="VOID">ยกเลิก</option></select></label><button id="histSearch">ค้นหา / รีเฟรช</button><p class="hint">ตรวจเลขบิล เวลา และสินค้าก่อนลงบิลใหม่ · ประวัติเก็บบิลที่ยกเลิกด้วย</p><div id="histResult" aria-live="polite"></div><button id="histPrev">ก่อนหน้า</button><button id="histNext">ถัดไป</button>`);
 let offset=0,serial=0,first=true;
 async function search(){const token=++serial;const result=$('histResult');result.textContent='กำลังโหลดประวัติ…';
 try{const r=await api('history',{issueNo:issue,day:$('histDay').value,query:$('histQuery').value,status:$('histStatus').value,offset});if(token!==serial||!result.isConnected)return;
 if(first){$('histBooth').innerHTML=''+r.booths.filter(b=>b.id===issue).map(b=>`<option value="${esc(b.id)}">${esc(b.name)} · ${esc(b.id)}</option>`).join('');$('histBooth').value=issue;first=false;}
 result.innerHTML=`<p>พบ ${r.count} บิล · ขายสำเร็จ ${r.paidCount} · ยกเลิก ${r.voidCount} · ยอดขายที่ไม่ยกเลิก ${baht(r.total)}</p>`+(r.rows.length?r.rows.map(r=>`<details class="sale-row"><summary>${esc(r.day)} ${esc(new Date(r.at).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}))} · ${baht(r.total)} · ${r.status==='VOID'?'ยกเลิก':'ขายสำเร็จ'}<br><small>${esc(r.id)}</small></summary><div><p>${esc(r.boothName)} · ${esc(r.issue)}<br>ผู้ขาย ${esc(r.staff)} · ${esc(payNames[r.payment]||r.payment)}</p>${r.lines.map(l=>`<p>${esc(l.name)} × ${l.qty} @ ${baht(l.price)}</p>`).join('')}<p>หมายเหตุ ${esc(r.note||'—')}</p>${r.status==='VOID'?`<p>ยกเลิกโดย ${esc(r.voidStaff)} · ${esc(r.voidNote)}</p>`:''}<p>แจ้ง LINE: ${esc(r.notify)} (แยกจากสถานะขาย)</p>${r.photoUrl?`<a href="${esc(r.photoUrl)}" target="_blank" rel="noopener noreferrer">เปิดรูปแนบบิล</a>`:''}</div></details>`).join(''):'<p>ไม่พบรายการตามเงื่อนไข</p>');$('histPrev').disabled=offset===0;$('histNext').disabled=offset+50>=r.count;
 }catch(err){if(token===serial&&result.isConnected)result.textContent=err.message;}}
 $('histSearch').onclick=()=>{offset=0;void search();};$('histPrev').onclick=()=>{offset=Math.max(0,offset-50);void search();};$('histNext').onclick=()=>{offset+=50;void search();};await search();
});


// Show the amount to collect and remind staff to verify the transfer.
function transferAmount(){
 if(!cart.length)throw Error('เลือกสินค้าก่อนดูยอดโอน');
 let total=0;for(const row of cart){if(!Number.isInteger(row.qty)||row.qty<1)throw Error('จำนวนสินค้าไม่ถูกต้อง');total+=cents(row.price)*row.qty;}
 if(!Number.isSafeInteger(total)||total<=0)throw Error('ยอดชำระไม่ถูกต้อง');return total/100;
}
function updateTransferButton(){const button=$('showTransferAmount');if(!button)return;button.hidden=$('payment').value!=='TRANSFER';button.disabled=busy||!!pending||needsRefresh||!cart.length||!data.state?.received||data.state?.dayClosed||data.state?.closed;}
function openTransferAmount(){
 ensureSelling();if($('payment').value!=='TRANSFER')throw Error('เลือกเงินโอนก่อน');const amount=transferAmount();
 showDialog('ยอดสำหรับโอนเงิน',`<p>ยอดบิลนี้ <strong>${baht(amount)}</strong></p><p>ตรวจชื่อผู้รับและยอดโอนก่อนกดยืนยันรับเงิน</p>`);
 $('dialogBody').onclick=null;
}
$('payment').addEventListener('change',updateTransferButton);
$('showTransferAmount').onclick=safe(openTransferAmount);
updateTransferButton();


// V12.1.6: quota checks are explicit read-only calls, never part of sale submission.
function lineQuotaHTML(q){
 const num=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('th-TH'):'ไม่ทราบ';
 const kinds={MONTHLY_LIMIT:'LINE แจ้งว่าโควตารายเดือนเต็ม',RATE_LIMIT:'LINE แจ้งข้อจำกัดอัตราการส่ง',UNKNOWN_429:'รหัส 429 เดิมยังไม่มีรายละเอียด จึงยังระบุสาเหตุไม่ได้',AUTH:'ตรวจสิทธิ์หรือ Token ของ LINE',OTHER:'ข้อผิดพลาดอื่น'};
 return `<p><b>บอตที่เข้าถึงกลุ่ม: ${esc(q.activeBot?.name||'ไม่ทราบ')} ${esc(q.activeBot?.basicId||'')}</b><br>กลุ่ม: ${esc(q.activeBot?.groupName||'ไม่ทราบ')}<br>ช่องตั้งค่า: ${esc(q.activeBot?.slot||'ไม่ทราบ')}</p><p>ตรวจเมื่อ ${esc(new Date(q.checkedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}))}</p><p><b>ใช้ไปโดยประมาณ ${num(q.used)} ข้อความ</b><br>โควตาเป้าหมาย ${q.type==='none'?'LINE ไม่ได้ระบุขีดจำกัดเป้าหมาย':num(q.limit)}<br>คงเหลือโดยประมาณ ${num(q.remaining)}</p><p class="hint">ยอด API เป็นค่าประมาณ รวมการส่งจาก OA Manager ด้วย ไม่รับรองว่าจะส่งสำเร็จ การตรวจนี้ไม่ส่งข้อความเข้ากลุ่ม</p>${q.remaining===0?'<p class="notice">ยอดใช้โดยประมาณถึงโควตาเป้าหมายแล้ว ตรวจแพ็กเกจใน LINE OA ก่อนส่งซ้ำ</p>':''}<p>ข้อความค้างส่ง ${num(q.pendingCount)} รายการ (ทุกบูธ)</p>${(q.errors||[]).map(e=>`<p class="notice">${esc(e)}</p>`).join('')}${(q.failures||[]).map(f=>`<div class="sale-row"><div><b>${esc(kinds[f.kind]||kinds.OTHER)}</b><small>${esc(f.day)} · ${esc(f.id)}</small><p>${esc(f.message)}</p></div></div>`).join('')}<p class="hint">ข้อผิดพลาดเป็นผลจากการส่งครั้งก่อน อาจต่างจากโควตาปัจจุบัน อย่าลงบิลขายใหม่เพื่อส่ง LINE</p>`;
}
async function openLineQuota(){
 if(demo)throw Error('ตัวตรวจโควตาใช้ได้เฉพาะระบบจริง');
 showDialog('ตรวจโควตา LINE',`<p>อ่านยอดจาก LINE โดยไม่ส่งข้อความ</p><button id="quotaRefresh">ตรวจอีกครั้ง</button><div id="quotaResult" aria-live="polite"></div>`);
 $('dialogBody').onclick=null;
 const button=$('quotaRefresh'),output=$('quotaResult');
 async function read(){button.disabled=true;output.textContent='กำลังตรวจโควตา LINE…';
  try{const q=await api('lineQuota');if(output.isConnected){output.innerHTML=lineQuotaHTML(q);actionFeedback(q.errors?.length?'ตรวจโควตาเสร็จ แต่มีข้อผิดพลาด ดูรายละเอียดด้านล่าง':'ตรวจโควตาสำเร็จ · ไม่ได้ส่งข้อความเข้ากลุ่ม');}}
  catch(err){actionFeedback('ตรวจโควตาไม่สำเร็จ: '+err.message);if(output.isConnected)output.textContent='ตรวจไม่ได้: '+err.message+' · ตรวจว่าได้อัปเดต Apps Script เป็น V12.1.15 และติดตั้งไฟล์ตัวกลางล่าสุด แล้ว';}
  finally{button.disabled=false;}
 }
 button.onclick=read;await read();
}

// V12.1.15: persisted delivery status, independent from successful daily closing.
function closeNotifyHTML(close){
 if(!close)return '';
 const sent=close.notify==='SENT',waiting=String(close.notify||'').startsWith('PENDING');
 const message=close.notify==='NONE'?'ปิดยอดเรียบร้อย · การส่ง LINE แยกอยู่ที่ปุ่มส่งสรุปเอง':sent?'ส่งสรุป LINE สำเร็จ (LINE รับคำขอแล้ว)':waiting?'LINE ยังส่งไม่สำเร็จ · รอส่งใหม่':'ยังยืนยันสถานะส่ง LINE ไม่ได้ · กดรีเฟรชหรือตรวจเวอร์ชันหลังบ้าน';
 return `<div class="notice ${waiting?'warning':''}" role="status"><b>บันทึกปิดยอดวันที่ ${esc(close.day)} แล้ว</b><p>${message}${data.notificationPolicy==='MANUAL_SUMMARY'?' · ดูผลส่งสรุปแยกได้ที่ปุ่มส่งสรุป LINE':''}</p>${waiting&&close.notifyError?`<p>สาเหตุ: ${esc(close.notifyError)}</p>`:''}${waiting?'<p>ไม่ต้องปิดยอดซ้ำ · ไปที่จัดการ → ตรวจโควตา LINE หรือส่งข้อความ LINE ที่ค้างอีกครั้ง</p>':''}<small>${esc(close.id||'')}</small></div>`;
}
function renderCloseNotify(){
 let panel=$('closeNotifyStatus');if(!panel){panel=document.createElement('div');panel.id='closeNotifyStatus';$('history').before(panel);}
 const close=(data.state?.closes||[]).find(c=>c.day===data.state?.day);panel.innerHTML=closeNotifyHTML(close);panel.hidden=!close;
}

async function promotionDialog(){
 if(role!=='boss')throw Error('เฉพาะบอสเท่านั้นที่จัดการเซตได้');
 const scopeIssue=issue;
 const boothName=data.booths.find(b=>b.id===scopeIssue)?.name||scopeIssue;
 showDialog('จัดการเซตและราคาตามบูธ','<p id="promoLoading">กำลังโหลดเซตสินค้า…</p>');
 const loading=$('promoLoading');
 const {products,promotions}=await api('promotionList',{scopeIssue});
 if(!loading.isConnected||!$('actionDialog').open)return;
 const scopeSelect=scopeIssue
  ? `<label for="promoScope">ตั้งค่าที่ไหน</label><select id="promoScope"><option value="booth">เฉพาะบูธ ${esc(boothName)}</option><option value="global">เซตและราคากลางทุกบูธ</option></select>`
  : '<p class="hint">กำลังตั้งเซตและราคากลาง เลือกบูธที่หน้าขายก่อนเมื่อต้องการตั้งราคาเฉพาะงาน</p>';
 $('dialogBody').insertAdjacentHTML('beforeend',scopeSelect+'<label for="promoChoice">เลือกเซต</label><select id="promoChoice"></select><div id="promoFields"></div>');
 loading.remove();
 const scope=$('promoScope'), choice=$('promoChoice'), fields=$('promoFields');
 let createId;
 const isBooth=()=>scope?.value==='booth';
 function renderChoices(){
  const options=promotions.filter(p=>!isBooth()||p.active);
  choice.innerHTML=(isBooth()?'<option value="">เลือกเซตที่เปิดขาย</option>':'<option value="">สร้างเซตใหม่</option>')
    +options.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.active?'':' (ปิดขาย)'}</option>`).join('');
  renderFields();
 }
 function renderFields(){
  const p=promotions.find(x=>x.id===choice.value);
  createId='promo-'+crypto.randomUUID();
  if(isBooth()){
   fields.innerHTML=p?`<p>ราคากลาง ${baht(p.globalPrice)} · ${p.hasOverride?'ใช้ราคาเฉพาะบูธ':'ใช้ราคากลางอยู่'}</p>
    <label for="promoPrice">ราคาต่อเซตในบูธนี้ (บาท)</label>
    <input id="promoPrice" type="number" min="0.01" step="0.01" value="${esc(p.price)}">
    <button id="promoSave" class="primary">บันทึกราคาบูธนี้</button>
    ${p.hasOverride?'<button id="promoResetPrice">กลับไปใช้ราคากลาง</button>':''}`:'';
   if(p){
    $('promoSave').onclick=safe(()=>saveBooth(p,cents($('promoPrice').value)/100));
    if($('promoResetPrice'))$('promoResetPrice').onclick=safe(()=>saveBooth(p,null));
   }
   return;
  }
  fields.innerHTML=`<label for="promoName">ชื่อเซต</label><input id="promoName" maxlength="100" value="${esc(p?.name||'')}">
   <label for="promoPrice">ราคากลางต่อเซต (บาท)</label>
   <input id="promoPrice" type="number" min="0.01" step="0.01" value="${esc(p?.globalPrice??'')}">
   <p class="hint">ใส่จำนวนแต่ละสินค้าในหนึ่งเซต เว้น 0 สำหรับสินค้าที่ไม่อยู่ในเซต</p>
   ${products.map(x=>`<label>${esc(x.name)} <input data-promo-sku="${esc(x.sku)}" type="number" min="0" max="999" step="1" value="${p?.components.find(c=>c.sku===x.sku)?.qty||0}"></label>`).join('')}
   <label><input id="promoActive" type="checkbox" ${p?.active===false?'':'checked'}> เปิดขายเซตนี้</label>
   <button id="promoSave" class="primary">บันทึกเซต</button>`;
  $('promoSave').onclick=safe(async()=>{
   const name=$('promoName').value.trim();
   const price=cents($('promoPrice').value)/100;
   const components=Array.from(fields.querySelectorAll('[data-promo-sku]'),el=>({sku:el.dataset.promoSku,qty:Number(el.value)}));
   if(!name||name.startsWith('='))throw Error('กรอกชื่อเซต');
   if(components.some(c=>!Number.isInteger(c.qty)||c.qty<0||c.qty>999))throw Error('จำนวนสินค้าต่อเซตต้องเป็นจำนวนเต็ม 0–999');
   const selected=components.filter(c=>c.qty>0);
   if(!selected.length)throw Error('เลือกสินค้าอย่างน้อยหนึ่งรายการ');
   if(Math.round(price*100)<selected.reduce((sum,c)=>sum+c.qty,0))throw Error('ราคาเซตต่ำเกินไปสำหรับจำนวนสินค้า');
   await save('promotionSave',{id:p?.id,createId:p?undefined:createId,revision:p?.revision,name,price,active:$('promoActive').checked,components:selected});
  });
 }
 function saveBooth(p,price){
  return save('boothPromotionPriceSave',{scopeIssue,id:p.id,revision:p.revision,boothRevision:p.boothRevision,price});
 }
 async function save(action,payload){
  const controls=[scope,choice,...fields.querySelectorAll('input,button')].filter(Boolean);
  controls.forEach(el=>el.disabled=true);
  try {
   await api(action,payload);
   $('actionDialog').close();
   try {await load();actionFeedback('บันทึกเซตหรือราคาสำเร็จ · เครื่องอื่นกดรีเฟรชเพื่อรับราคาใหม่');}
   catch {actionFeedback('บันทึกสำเร็จแล้ว · กดรีเฟรชเพื่อโหลดราคาใหม่');}
  }finally{controls.forEach(el=>el.disabled=false);}
 }
 if(scope)scope.onchange=renderChoices;
 choice.onchange=renderFields;
 renderChoices();
}

const manualLineKey='lb_manual_line_request';
async function openManualLineSummary(){
 if(demo)throw Error('โหมดตัวอย่างไม่ส่ง LINE');
 if(!issue)throw Error('เลือกบูธก่อนส่งสรุป');
 if(busy||pending||needsRefresh)throw Error('รอยืนยันรายการและรีเฟรชข้อมูลก่อนส่งสรุป');
 const saved=recall(manualLineKey,null);
 if(saved&&saved.issueNo!==issue)throw Error('มีคำขอส่งสรุปของอีกบูธรอยืนยันผล ให้เลือกบูธเดิมก่อน');
 showDialog('ส่งสรุปยอดเข้า LINE',`<p id="manualLineInfo">กำลังเตรียมสรุป…</p><pre id="manualLineText" style="white-space:pre-wrap;font:inherit;line-height:1.7"></pre><button id="confirmManualLine" class="primary" disabled>ยืนยันส่งสรุปนี้เข้า LINE</button>`);
 const button=$('confirmManualLine'),info=$('manualLineInfo'),output=$('manualLineText');
 let task=saved;
 if(!task){try{const preview=await api('lineSummaryPreview',{issueNo:issue});if(!button.isConnected)return;task={...preview,requestId:crypto.randomUUID()};}catch(err){info.textContent='เตรียมสรุปไม่สำเร็จ: '+err.message;return;}}
 info.textContent=saved?'มีคำขอเดิมรอยืนยันผล · กดตรวจผล/ส่งซ้ำด้วยรหัสเดิม เพื่อกันข้อความซ้ำ':'เฉพาะบูธที่เลือก · ยังไม่ส่งจนกดปุ่มด้านล่าง';output.textContent=task.text;
 button.disabled=false;button.textContent=saved?'ตรวจผล / ลองส่งสรุปเดิม':'ยืนยันส่งสรุปนี้เข้า LINE';
 button.onclick=safe(async()=>{
  if(button.disabled)return;button.disabled=true;remember(manualLineKey,task);actionFeedback('กำลังส่งสรุป…');
  try{const result=await api('sendLineSummary',{issueNo:task.issueNo,previewKey:task.previewKey,requestId:task.requestId});
   if(data.state){data.state.lineSummaries||=[];data.state.lineSummaries=data.state.lineSummaries.filter(x=>x.id!==result.id);data.state.lineSummaries.push({id:result.id,day:task.day,notify:result.notificationStatus,notifyError:result.notificationError||''});renderManualLineStatus();}
   if(result.notificationStatus==='SENT'){localStorage.removeItem(manualLineKey);actionFeedback(result.duplicate?'สรุปนี้ส่งสำเร็จไว้แล้ว ไม่ได้ส่งซ้ำ':'ส่งสรุป LINE สำเร็จ (LINE รับคำขอแล้ว)');info.textContent='ส่งแล้ว · '+result.id;button.textContent='ส่งสรุปนี้แล้ว';}
   else{actionFeedback('ยังส่งไม่สำเร็จ / ยังยืนยันผลไม่ได้: '+(result.notificationError||'กรุณาตรวจโควตาและการเชื่อมต่อ'));button.textContent='ตรวจผล / ลองส่งสรุปเดิม';button.disabled=false;}
  }catch(err){if(err.rejected){localStorage.removeItem(manualLineKey);button.textContent='ปิดและเปิดสรุปใหม่';}else{button.disabled=false;button.textContent='ตรวจผล / ลองส่งสรุปเดิม';}throw err;}
 });
}
const manualLineButton=document.createElement('button');manualLineButton.id='sendLineSummaryBtn';manualLineButton.textContent='ดูยอด / ส่งสรุป LINE เอง';manualLineButton.onclick=safe(openManualLineSummary);$('salesHistoryBtn').after(manualLineButton);

function renderManualLineStatus(){
 let output=$('manualLineLast');if(!output){output=document.createElement('p');output.id='manualLineLast';output.setAttribute('role','status');$('sendLineSummaryBtn').after(output);}
 const last=(data.state?.lineSummaries||[]).filter(s=>s.day===data.state?.day).slice(-1)[0];
 output.textContent=!last?'วันนี้ยังไม่ได้กดส่งสรุป LINE':last.notify==='SENT'?'ผลส่งสรุปครั้งล่าสุด: LINE รับคำขอแล้ว · '+last.id:'ผลส่งสรุปครั้งล่าสุด: ยังส่งไม่สำเร็จ / ยังยืนยันผลไม่ได้ · '+(last.notifyError||last.id);
}

// V12.4: barcode input is local to the selected booth; never an API call per keystroke.
function barcodeReady(){return !!issue&&!!data.state?.received&&!data.state.closed&&!data.state.dayClosed&&!busy&&!pending&&!needsRefresh;}
function syncBarcodeControls(){
 const disabled=!barcodeReady();for(const id of ['barcodeInput','barcodeAdd','scanCamera','scanPhoto'])$(id).disabled=disabled;
 if(!disabled&&$('barcodeStatus').textContent==='เลือกบูธและตรวจรับสินค้าก่อน')$('barcodeStatus').textContent='พร้อมอ่านรหัสของบูธนี้ · กรอก 4 ตัวท้ายแล้วกด Enter ได้เลย';
 if(disabled){barcodeCamera.stop();if($('barcodeDialog').open)$('barcodeDialog').close();}
}
function resetBarcode(){
 barcodeCamera.stop();barcodeChoiceContext=null;$('barcodeChoices').replaceChildren();$('barcodeInput').value='';
 $('barcodeStatus').textContent='เลือกบูธและตรวจรับสินค้าก่อน';if($('barcodeDialog').open)$('barcodeDialog').close();
}
function barcodeContext(){return {issue,generation:loadGeneration};}
function sameBarcodeContext(context){return context.issue===issue&&context.generation===loadGeneration;}
function scanAdd(raw,context=barcodeContext()){
 if(!sameBarcodeContext(context))throw Error('เปลี่ยนบูธหรือรีเฟรชแล้ว กรุณาสแกนใหม่');ensureSelling();
 const result=matchBoothBarcode(raw,data.products,data.state.lots);$('barcodeChoices').replaceChildren();barcodeChoiceContext=null;
 if(!result.matches.length)throw Error('ไม่พบรหัสนี้ในบูธที่เลือก ตรวจ Barcode ใน BoothPOS_Products คอลัมน์ F');
 if(result.matches.length===1){const p=result.matches[0];add(p.sku);$('barcodeStatus').textContent='เพิ่ม '+p.name+' 1 ชิ้นแล้ว · '+p.barcode;$('barcodeInput').value='';$('barcodeInput').focus();return;}
 barcodeChoiceContext=context;$('barcodeStatus').textContent='เลขท้ายซ้ำกัน '+result.matches.length+' สินค้า กรุณาเลือกให้ตรงกับของจริง';
 $('barcodeChoices').innerHTML=result.matches.map(p=>`<button type="button" data-barcode-sku="${esc(p.sku)}">${esc(p.name)} · ${esc(p.barcode)} · เหลือ ${available(p.sku)} ชิ้น</button>`).join('');
}
function scanError(err){$('barcodeStatus').textContent=err.message||String(err);toast(err.message||String(err));}
$('barcodeAdd').onclick=()=>{try{scanAdd($('barcodeInput').value);}catch(err){scanError(err);}};
$('barcodeInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('barcodeAdd').click();}};
$('barcodeInput').oninput=()=>{$('barcodeChoices').replaceChildren();barcodeChoiceContext=null;};
$('barcodeChoices').onclick=e=>{const button=e.target.closest('[data-barcode-sku]');if(!button)return;try{
 if(!barcodeChoiceContext||!sameBarcodeContext(barcodeChoiceContext))throw Error('ข้อมูลเปลี่ยนแล้ว กรุณากรอกรหัสใหม่');ensureSelling();
 if(!data.state.lots.some(l=>l.sku===button.dataset.barcodeSku))throw Error('สินค้าไม่ได้อยู่ในบูธนี้');
 const p=data.products.find(p=>p.sku===button.dataset.barcodeSku);add(p.sku);$('barcodeStatus').textContent='เพิ่ม '+p.name+' แล้ว';$('barcodeInput').value='';$('barcodeChoices').replaceChildren();barcodeChoiceContext=null;$('barcodeInput').focus();
 }catch(err){scanError(err);}};
$('scanCamera').onclick=async()=>{const context=barcodeContext();try{
 ensureSelling();$('barcodeDialog').showModal();$('barcodeCameraStatus').textContent='อนุญาตกล้อง แล้วเล็งให้เห็นบาร์โค้ดครบทั้งแถบ';
 await barcodeCamera.start($('barcodeVideo'),code=>{if($('barcodeDialog').open)$('barcodeDialog').close();try{scanAdd(code,context);}catch(err){scanError(err);}},err=>{$('barcodeCameraStatus').textContent=err.message;});
 }catch(err){barcodeCamera.stop();$('barcodeCameraStatus').textContent=(err.name==='NotAllowedError'?'ไม่ได้รับอนุญาตใช้กล้อง เปิดสิทธิ์กล้องหรือกรอกเลขท้ายแทน':err.message);}};
$('barcodeCameraClose').onclick=()=>$('barcodeDialog').close();
$('barcodeDialog').addEventListener('close',()=>{barcodeCamera.stop();$('barcodeVideo').srcObject=null;});
$('barcodeDialog').addEventListener('cancel',()=>barcodeCamera.stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden){barcodeCamera.stop();if($('barcodeDialog').open)$('barcodeDialog').close();}});
window.addEventListener('pagehide',()=>barcodeCamera.stop());
$('scanPhoto').onchange=async e=>{const file=e.target.files?.[0],context=barcodeContext();if(!file)return;try{ensureSelling();$('barcodeStatus').textContent='กำลังอ่านรูปบนเครื่องนี้…';const code=await decodePhoto(file);scanAdd(code,context);}catch(err){scanError(err);}finally{e.target.value='';}};
