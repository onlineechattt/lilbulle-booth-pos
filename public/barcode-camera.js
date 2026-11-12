// Camera/photo processing stays on-device. ZXing is served locally and loaded on demand.
let libraryPromise;
export function loadDecoder(){
 if(globalThis.ZXingBrowser)return Promise.resolve(globalThis.ZXingBrowser);
 if(!libraryPromise)libraryPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=new URL('./vendor/zxing-browser.min.js',import.meta.url).href;
  script.onload=()=>globalThis.ZXingBrowser?resolve(globalThis.ZXingBrowser):reject(Error('โหลดตัวอ่านบาร์โค้ดไม่สำเร็จ'));
  script.onerror=()=>{script.remove();reject(Error('โหลดตัวอ่านบาร์โค้ดไม่ได้ กรุณากรอกเลข 4 ตัวท้ายแทน'));};document.head.append(script);
 }).catch(err=>{libraryPromise=null;throw err;});
 return libraryPromise;
}
async function nativeDetector(){
 if(!globalThis.BarcodeDetector)return null;
 try{const wanted=['ean_13','ean_8','upc_a','upc_e','code_128','itf'];const supported=await BarcodeDetector.getSupportedFormats();const formats=wanted.filter(x=>supported.includes(x));return formats.length?new BarcodeDetector({formats}):null;}catch{return null;}
}
export function createCameraScanner(){
 let generation=0,stream,controls,timer;
 function stop(){generation++;clearTimeout(timer);try{Promise.resolve(controls?.stop()).catch(()=>{});}catch{}controls=null;stream?.getTracks().forEach(t=>t.stop());stream=null;}
 async function start(video,onRead,onError=()=>{}){
  stop();const token=generation;
  if(!navigator.mediaDevices?.getUserMedia)throw Error('กล้องต้องเปิดผ่าน HTTPS และเบราว์เซอร์ที่รองรับ กรุณาถ่ายภาพหรือกรอกรหัสแทน');
  const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
  if(token!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
  stream=acquired;video.srcObject=stream;
  let accepted=false;
  const accept=value=>{if(accepted||token!==generation)return;accepted=true;stop();video.srcObject=null;onRead(value);};
  try{
   const detector=await nativeDetector();if(token!==generation)return;
   if(detector){await video.play();if(token!==generation)return;let failures=0;
    const scan=async()=>{if(token!==generation)return;try{const codes=await detector.detect(video);if(codes.length)return accept(codes[0].rawValue);failures=0;}catch{if(++failures>=3){try{await fallback();}catch(err){if(token===generation){stop();onError(err);}}return;}}if(token===generation)timer=setTimeout(scan,180);};
    void scan();
   }else await fallback();
   async function fallback(){
    const library=await loadDecoder();if(token!==generation)return;
    const reader=new library.BrowserMultiFormatReader(undefined,{delayBetweenScanAttempts:180});
    const next=await reader.decodeFromStream(acquired,video,result=>{if(result)accept(result.getText());});
    if(token!==generation)next.stop();else controls=next;
   }
  }catch(err){if(token===generation)stop();throw err;}
 }
 return {start,stop};
}
export async function decodePhoto(file){
 if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>8000000)throw Error('ใช้รูป JPG PNG WEBP ไม่เกิน 8 MB');
 const url=URL.createObjectURL(file),image=new Image();
 try{image.src=url;await image.decode();const detector=await nativeDetector();if(detector){try{const codes=await detector.detect(image);if(codes.length)return codes[0].rawValue;}catch{}}
  const library=await loadDecoder(),result=await new library.BrowserMultiFormatReader().decodeFromImageElement(image);return result.getText();
 }catch(err){if(err.message?.includes('โหลดตัวอ่าน'))throw err;throw Error('อ่านบาร์โค้ดจากรูปไม่พบ ลองถ่ายให้ชัดและเห็นเส้นครบ หรือกรอก 4 ตัวท้าย');}finally{URL.revokeObjectURL(url);image.src='';}
}
