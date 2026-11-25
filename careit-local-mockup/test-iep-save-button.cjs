const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();
 try{
  await page.goto(pathToFileURL(path.join(__dirname,'careit-mockup.html')).href+'#/iep');
  assert.equal(await page.locator('.iew-toolbar [data-iew-action="save"]').count(),0);
  await page.locator('#iew-className').fill('햇살반');
  await page.waitForFunction(()=>!window.__careitAiBridge.store.pending);
  await page.locator('[data-iew-id="current"]').click();
  await page.getByLabel('강점',{exact:true}).fill('관찰한 강점');
  await page.waitForFunction(()=>!window.__careitAiBridge.store.pending);
  await page.reload();
  assert.equal(await page.locator('#iew-className').inputValue(),'햇살반');
  await page.locator('[data-iew-id="current"]').click();
  assert.equal(await page.getByLabel('강점',{exact:true}).inputValue(),'관찰한 강점');
  console.log('IEP toolbar and automatic saving: passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
