const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(__dirname,'careit-mockup.html')).href+'#/settings/configuration?recipient=0&template=1');
 let heights=[];
 for(const i of [4,5]){
  await page.locator(`[data-action="edit-quick-check"][data-index="${i}"]`).click();
  heights.push((await page.locator('#quick-dialog .quick-check-preview').boundingBox()).height);
  await page.locator('#quick-dialog [aria-label="닫기"]').click();
 }
 assert.ok(Math.abs(heights[0]-heights[1])<2,`time preview heights: ${heights}`);
 await page.locator('[data-action="edit-quick-check"][data-index="6"]').click();
 assert.equal(await page.locator('#quick-min, #quick-max').count(),0);
 assert.equal(await page.locator('#quick-unit').inputValue(),'mL');
 let number=page.locator('#quick-dialog .quick-check-number input');
 assert.equal(await number.getAttribute('min'),null);assert.equal(await number.getAttribute('max'),null);
 for(const value of ['-1','999999']){await number.fill(value);assert.equal(await number.evaluate(e=>e.checkValidity()),true);}
 await page.locator('#quick-dialog [aria-label="닫기"]').click();
 await page.locator('[data-action="edit-quick-check"][data-index="7"]').click();
 assert.equal(await page.locator('#quick-min, #quick-max').count(),2);
 assert.deepEqual(errors,[]);await browser.close();console.log('Time previews and unbounded numeric input passed');
})().catch(e=>{console.error(e);process.exit(1)});
