const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:950}});const requests=[];
 try{
  await page.route('**/careit-mockup.html',r=>r.fulfill({status:200,contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
  await page.route('**/api/local-ai/**',r=>{const u=r.request().url();let data={};if(u.endsWith('/status'))data={connected:true};else if(u.endsWith('/models'))data={models:[{slug:'gpt-6-luna'}]};else if(u.endsWith('/respond')){requests.push(r.request().postDataJSON());data={text:'자료별 차이를 확인해 주세요.',output:[]};}return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
  await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
  await page.waitForFunction(()=>document.querySelector('[data-ai-local-controls]')?.hidden);
  await page.evaluate(async()=>{const b=window.__careitAiBridge;b.state.generatedReports||=[];for(const r of [{id:'qa-old',from:'2026-03-01',to:'2026-03-07',generated:'2026-03-09'},{id:'qa-new',from:'2026-10-01',to:'2026-10-07',generated:'2026-10-09'}])b.state.generatedReports.push({...r,recipient:0,version:1});await b.store.save(JSON.stringify(b.state));});
  await page.locator('[data-iew-id="current"]').click();
  await page.getByRole('button',{name:'적응행동',exact:true}).click();
  await page.getByLabel('지도점',{exact:true}).fill('가상: 학교에서는 손목 도움을 받아 식사한다.');
  await page.getByRole('button',{name:'의사소통',exact:true}).click();
  await page.getByLabel('강점',{exact:true}).fill('가상: 그림을 가리켜 요청한다.');
  await page.locator('[data-iew-id="meeting"]').click();
  await page.locator('#iew-parent').fill('가상: 가정에서는 말로 요청한다고 보호자가 말함.');
  await page.locator('.iew-toolbar [data-iew-id="records"]').click();
  await page.locator('[data-iew-record="report:qa-old"]').check();
  await page.locator('[data-iew-record="report:qa-new"]').check();
  await page.getByRole('button',{name:'선택한 기록 연결'}).click();
  await page.locator('.iew-record-back').click();
  await page.locator('[data-iew-id="current"]').click();
  await page.getByRole('button',{name:'AI 작성 도움'}).click();
  assert.equal(requests.length,0);
  await page.getByRole('button',{name:'우선 목표 찾기',exact:true}).last().click();
  await page.getByText('자료별 차이를 확인해 주세요.').waitFor();
  const prompt=JSON.stringify(requests[0]);
  for(const text of ['적응행동','의사소통','그림을 가리켜 요청','가정에서는 말로 요청','2026-03-01','2026-10-01','periodStart','createdAt','상충하는 내용','날짜가 없으면 미상'])assert(prompt.includes(text),text);
  assert.equal(await page.getByLabel('강점',{exact:true}).inputValue(),'가상: 그림을 가리켜 요청한다.');
  console.log('IEP priority: multiple domains, differing accounts, source dates and no overwrite passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
