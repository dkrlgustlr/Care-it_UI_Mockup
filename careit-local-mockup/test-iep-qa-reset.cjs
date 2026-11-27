const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();let calls=0;try{
await page.route('**/careit-mockup.html',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
await page.route('**/api/local-ai/**',r=>{const url=r.request().url();if(url.endsWith('/qa-reset-usage')){calls++;return r.fulfill({json:{usage:{limit:500000,remaining:500000,resetAt:null}}});}return r.fulfill({json:url.endsWith('/status')?{connected:true,usage:{limit:500000,remaining:100,resetAt:null}}:{models:[{slug:'gpt-6-luna'}]}})});
await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');await page.locator('[data-iew-id="assessment"]').click();assert.equal(await page.getByText('평가 기간',{exact:true}).count(),0);
await page.getByRole('button',{name:'토큰 초기화'}).click();await page.locator('#mockup-dialog').getByRole('button',{name:'취소'}).click();assert.equal(calls,0);
await page.getByRole('button',{name:'토큰 초기화'}).click();await page.locator('#mockup-dialog').getByRole('button',{name:'초기화'}).click();await page.waitForFunction(()=>document.body.textContent.includes('토큰 사용량을 초기화했어요.'));assert.equal(calls,1);console.log('QA token reset confirmation and assessment fields passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
