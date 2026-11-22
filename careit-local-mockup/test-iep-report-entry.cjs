const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const width of [1600,390]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/careit-mockup.html',r=>r.fulfill({status:200,contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
   await page.route('**/api/local-ai/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"connected":false}'}));
   await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
   const sections=[['personal','인적사항'],['placement','배치·지원계획'],['services','관련서비스'],['current','현재학습수행수준'],['plan','학기별 IEP'],['meeting','지원팀 회의록'],['assessment','학기별 평가'],['document','종합보고서·내보내기']];
   for(const [id,label] of sections){
    await page.locator(`.iew-tabs [data-iew-id="${id}"]`).click();
    const button=page.locator('.iew-toolbar [data-iew-id="records"]');
    assert.equal(await button.count(),1);
    const box=await button.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,`report button off-screen at ${width}: ${JSON.stringify(box)}`);
    await button.click();
    assert.equal(await page.locator(`.iew-tabs [data-iew-id="${id}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.iew-record-back').innerText(),`← ${label}`);
    await page.locator('.iew-record-back').click();
    assert.equal(await page.locator(`.iew-tabs [data-iew-id="${id}"]`).getAttribute('aria-pressed'),'true');
   }
   await page.locator('.iew-tabs [data-iew-id="personal"]').click();
   await page.locator('#iew-className').fill('기존 내용');
   await page.locator('.iew-toolbar [data-iew-id="records"]').click();
   const first=page.locator('[data-iew-record]').first();
   if(await first.count()){
    await first.check();await page.locator('[data-iew-action="attach"]').click();
    assert.match(await page.locator('.iew-toolbar [data-iew-id="records"]').innerText(),/리포트 연결 1/);
    await page.locator('.iew-record-back').click();
    assert.equal(await page.locator('#iew-className').inputValue(),'기존 내용');
    await page.locator('.iew-tabs [data-iew-id="plan"]').click();
    assert.equal(await page.getByRole('button',{name:'리포트 연결 1',exact:true}).count(),1);
   }
   if(width===1600){
    await page.locator('.sidebar [data-action="ai-toggle"]').click();
    const button=await page.locator('.iew-toolbar [data-iew-id="records"]').boundingBox();
    const toolbar=await page.locator('.iew-toolbar').boundingBox();
    assert(button.x>=toolbar.x&&button.x+button.width<=toolbar.x+toolbar.width+1,'report button overflows toolbar with AI open');
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('IEP report entry and return on desktop and mobile: passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
