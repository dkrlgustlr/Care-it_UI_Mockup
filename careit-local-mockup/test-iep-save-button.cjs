const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
try{
 await page.route('**/careit-mockup.html',r=>r.fulfill({status:200,contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
 await page.route('**/api/local-ai/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"connected":false}'}));
 await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
 const save=page.locator('[data-iew-action="save"]');
 assert(await save.isDisabled());
 await page.locator('#iew-className').fill('햇살반');assert(await save.isEnabled());
 await page.evaluate(()=>{const store=window.__careitAiBridge.store;window.__originalSave=store.save;store.save=async()=>false;});
 await save.click();await page.waitForTimeout(50);assert(await save.isEnabled());
 await page.evaluate(()=>{window.__careitAiBridge.store.save=()=>window.__finishSave?Promise.resolve(true):new Promise(resolve=>window.__finishSave=resolve);});
 await save.click();assert(await save.isDisabled());
 await page.locator('#iew-className').fill('햇살반 수정');assert(await save.isDisabled());
 await page.evaluate(()=>window.__finishSave(true));await page.waitForFunction(()=>!document.querySelector('[data-iew-action="save"]').disabled);
 await page.evaluate(()=>{window.__careitAiBridge.store.save=window.__originalSave;});
 await save.click();await page.waitForFunction(()=>document.querySelector('[data-iew-action="save"]').disabled);
 await page.locator('.iew-toolbar [data-iew-id="records"]').click();
 const report=page.locator('[data-iew-record]').first();if(await report.count()){await report.check();await page.locator('[data-iew-action="attach"]').click();assert(await save.isEnabled());await save.click();await page.waitForFunction(()=>document.querySelector('[data-iew-action="save"]').disabled);}
 await page.locator('.iew-record-back').click();assert(await save.isDisabled());
 console.log('IEP save disabled, changes, failure and concurrent edit: passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
