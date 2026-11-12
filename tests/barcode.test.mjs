import test from 'node:test';
import assert from 'node:assert/strict';
import {matchBoothBarcode,normalizeBarcode} from '../public/barcode.js';
const products=[{sku:'balm',barcode:'0012345670017'},{sku:'foam',barcode:'8859999990017'},{sku:'spray',barcode:'1234567890024'},{sku:'lotion',barcode:''}];
test('full barcode preserves leading zeros and never matches another booth',()=>{
 assert.equal(matchBoothBarcode('0012345670017',products,[{sku:'balm'}]).matches[0].sku,'balm');
 assert.equal(matchBoothBarcode('8859999990017',products,[{sku:'balm'}]).matches.length,0);
 assert.equal(normalizeBarcode(' ００๑๗ '),'0017');
});
test('four-digit ambiguity is returned for explicit choice, never guessed',()=>{
 const result=matchBoothBarcode('0017',products,[{sku:'balm'},{sku:'foam'}]);
 assert.equal(result.suffix,true);assert.deepEqual(result.matches.map(p=>p.sku),['balm','foam']);
 assert.equal(matchBoothBarcode('0017',products,[{sku:'balm'}]).matches.length,1);
 assert.equal(matchBoothBarcode('0024',products,[{sku:'balm'}]).matches.length,0);
});
test('invalid input, no selected lots, missing barcode and duplicate lots cannot add a wrong SKU',()=>{
 for(const input of ['','017','12345','1e12','https://example.com/0017'])assert.throws(()=>matchBoothBarcode(input,products,[]));
 assert.equal(matchBoothBarcode('0017',products,[]).matches.length,0);
 assert.equal(matchBoothBarcode('0017',products,[{sku:'balm'},{sku:'balm'}]).matches.length,1);
 assert.equal(matchBoothBarcode('0017',products,[{sku:'lotion'}]).matches.length,0);
});
