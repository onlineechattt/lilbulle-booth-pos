// Pure matching: use catalogue strings as displayed in BoothPOS_Products!F, never Number().
export function normalizeBarcode(value){
 return String(value??'').trim().replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-0x0e50)).replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10)).replace(/[\s-]/g,'');
}
export function matchBoothBarcode(value,products,lots){
 const code=normalizeBarcode(value),suffix=code.length===4;
 if(!/^\d{4}$/.test(code)&&!/^\d{8,14}$/.test(code))throw Error('กรอก Barcode เต็ม 8–14 หลัก หรือเลข 4 ตัวท้าย');
 const allowed=new Set((lots||[]).map(l=>l.sku)),seen=new Set();
 const matches=(products||[]).filter(p=>{
  if(!allowed.has(p.sku)||seen.has(p.sku))return false;
  const barcode=String(p.barcode||'').trim();
  if(!/^\d{8,14}$/.test(barcode)||!(suffix?barcode.endsWith(code):barcode===code))return false;
  seen.add(p.sku);return true;
 });
 return {code,suffix,matches};
}
