/** Lil Bulle GAS-first POS bridge — 2026-11-12. No Netlify or public API key in browser. */
function lbGasSession_(token) {
  token=String(token||'');
  if(!/^[a-f0-9-]{36}$/.test(token))throw Error('กรุณาเข้าสู่ระบบใหม่');
  var data=CacheService.getScriptCache().get('lb-gas-'+token);
  if(!data)throw Error('หมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่');
  return JSON.parse(data);
}
function lbGasLogin(pin,staff) {
  pin=String(pin||'').trim();staff=posText_(staff,80);
  if(!staff||staff.length<2)throw Error('กรอกชื่อพนักงานอย่างน้อย 2 ตัวอักษร');
  var cache=CacheService.getScriptCache(),bucket='lb-gas-login-'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,staff.toLowerCase())).slice(0,32);
  var attempts=Number(cache.get(bucket)||0);if(attempts>=10)throw Error('ลอง PIN เกินกำหนด รอ 10 นาที');
  cache.put(bucket,String(attempts+1),600);
  var props=PropertiesService.getScriptProperties(),boss=props.getProperty('BOSS_PIN'),team=props.getProperty('POS_TEAM_PIN');
  if(!boss&&!team)throw Error('ยังไม่ได้ตั้ง PIN สำหรับ POS');
  var role= boss&&pin===boss?'boss':team&&pin===team?'team':'';
  if(!role)throw Error('PIN ไม่ถูกต้อง');
  cache.remove(bucket);
  var token=Utilities.getUuid();cache.put('lb-gas-'+token,JSON.stringify({role:role,staff:staff}),21600);
  return {token:token,role:role,staff:staff};
}
function lbGasCall(token,action,payload) {
  var session=lbGasSession_(token),p=payload||{};
  if(['init','sale','receive','closeDay','promotionSave','restock','receiveRestock','stockOut'].indexOf(action)<0)throw Error('คำสั่งไม่รองรับ');
  if(action==='promotionSave'&&session.role!=='boss')throw Error('เฉพาะบอสจัดการโปรโมชั่นได้');
  p.staff=session.staff;
  if(action==='init'){
    var snapshot=lbSnapshot_(String(p.issueNo||''));
    // Read the actual product barcode from column F; preserve leading zeros as displayed text.
    var sh=lbSetup_().getSheetByName(POS_SHEETS_.products),last=sh.getLastRow();
    var rows=last>1?sh.getRange(2,1,last-1,6).getDisplayValues():[];
    var codes={},seen={};rows.forEach(function(r){var code=String(r[5]||'').trim(),sku=String(r[0]||'').trim();if(!code)return;if(!/^\d{8,14}$/.test(code))throw Error('Barcode ไม่ถูกต้อง: '+sku);if(seen[code]&&seen[code]!==sku)throw Error('Barcode ซ้ำ: '+code);seen[code]=sku;codes[sku]=code;});
    snapshot.products=(snapshot.products||[]).map(function(item){item.barcode=codes[item.sku]||'';return item;});
    // Server-side restrict catalog to available booth stock, but expose full catalog for owner creating promotions.
    if(p.issueNo&&snapshot.state&&session.role!=='boss'){
      var stocked={};(snapshot.state.lots||[]).forEach(function(l){stocked[l.sku]=true;});
      snapshot.products=snapshot.products.filter(function(item){return stocked[item.sku];});
    }
    return snapshot;
  }
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(String(p.requestId||'')))p.requestId=Utilities.getUuid();
  if(['sale','receive','closeDay'].indexOf(action)>=0)return lbMutate_(action,p,session.role);
  if(action==='promotionSave')return lbPromotionSave_(p);
  return lbMovement_(action,p,session.role);
}
function lbGasLogout(token) {lbGasSession_(token);CacheService.getScriptCache().remove('lb-gas-'+token);return true;}
