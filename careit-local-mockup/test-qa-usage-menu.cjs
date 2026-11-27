const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();
  await page.route('**/careit-mockup.html',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
  await page.route('**/api/local-ai/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(r.request().url().endsWith('/qa-usage')?{items:[{activity:'test',kind:'chat',time:'2026-11-27T00:00:00Z',input:1000,output:100,cached:0,weighted:1500}]}:{connected:true,usage:{used:1500,limit:500000,unlimited:true}})}));
  await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
  await page.getByRole('link',{name:'케어릿 AI',exact:true}).click();
  await page.getByRole('button',{name:'첨부 및 사용량'}).click();
  await page.getByRole('button',{name:'QA 요청별 사용량'}).click();
  const dialog=page.locator('#mockup-dialog');
  await assert.doesNotReject(()=>dialog.getByText('입력 1,000 · 출력 100 · 차감 1,500 토큰').waitFor());
  assert.match(await dialog.textContent(),/API 환산 0\.20원/);
  console.log('QA usage button shows token and estimated cost');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
