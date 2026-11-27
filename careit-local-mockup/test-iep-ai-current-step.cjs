const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:900}});let requests=0;
 try{
  await page.route('**/careit-mockup.html',r=>r.fulfill({status:200,contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
  await page.route('**/api/local-ai/**',r=>{const url=r.request().url();let data={};if(url.endsWith('/status'))data={connected:true};else if(url.endsWith('/models'))data={models:[{slug:'gpt-6-luna'}]};else if(url.endsWith('/respond')){requests++;data={text:'확인할 정보를 알려주세요.',output:[]};}return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
  await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
  async function menu(id){await page.locator(`.iew-tabs [data-iew-id="${id}"]`).click();const n=await page.locator('.ai-chat-message.assistant:not(.ai-chat-loading)').count();await page.getByRole('button',{name:'AI 작성 도움'}).click();await page.waitForFunction(previous=>document.querySelectorAll('.ai-chat-message.assistant:not(.ai-chat-loading)').length>previous,n);return page.locator('.ai-chat-message.assistant:not(.ai-chat-loading)').last();}
  const expected={personal:'인적사항',placement:'배치·지원계획',services:'관련서비스',current:'현행수준',meeting:'지원팀 회의록',assessment:'학기별 평가'};
  for(const [id,title] of Object.entries(expected)){
   const message=await menu(id),labels=await message.locator('.ai-chat-choice').allTextContents();
   assert(labels.some(label=>label.includes(title)),`${title}: ${labels}`);
   assert(!labels.some(label=>label.includes('목표 구체화하기')||label.includes('단기목표 나누기')),`${title}: ${labels}`);
   assert.equal(labels.length,id==='current'?2:1,`${title}: ${labels}`);
  }
  let message=await menu('plan');
  assert.deepEqual((await message.locator('.ai-chat-choice').allTextContents()).map(t=>t.replace('›','').trim()),['목표 구체화하기','우선 목표 찾기','단기목표 나누기']);
  message=await menu('document');assert.equal(await message.locator('.ai-chat-choice').count(),0);
  message=await menu('personal');assert.equal(await message.locator('.ai-chat-choice').count(),1);
  await page.locator('.iew-tabs [data-iew-id="placement"]').click();
  await message.locator('.ai-chat-choice').click();
  await page.getByText('계획이나 연결된 자료가 바뀌었어요. AI 작성 도움을 다시 눌러 주세요.').waitFor();
  assert.equal(requests,0);
  console.log('IEP AI suggestions follow the active step and use no tokens: passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
