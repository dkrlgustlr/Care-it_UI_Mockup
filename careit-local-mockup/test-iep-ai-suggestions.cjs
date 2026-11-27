const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const requests=[];
 try{
  await page.route('**/careit-mockup.html',r=>r.fulfill({status:200,contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
  await page.route('**/api/local-ai/**',async r=>{
   const url=r.request().url();let body={};
   if(url.endsWith('/status'))body={connected:true};
   else if(url.endsWith('/models'))body={models:[{slug:'gpt-6-luna'}]};
   else if(url.endsWith('/respond')){requests.push(r.request().postDataJSON());body={text:'자료를 확인하고 필요한 정보를 알려주세요.',output:[]};}
   await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
  await page.waitForFunction(()=>!document.querySelector('[data-ai-local-controls]')||document.querySelector('[data-ai-local-controls]').hidden);
  await page.getByRole('button',{name:'AI 작성 도움'}).click();
  await page.getByRole('button',{name:'인적사항 내용에 필요한 정보 확인'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'목표 구체화하기'}).count(),0);
  assert.equal(requests.length,0);
  await page.locator('[data-iew-id="current"]').click();
  await page.getByLabel('강점',{exact:true}).fill('관찰한 내용');
  await page.getByRole('button',{name:'양식 편집',exact:true}).click();
  await page.getByRole('button',{name:'강점 항목 설정'}).click();
  await page.locator('#iew-form-name').fill('잘하는 점');
  await page.locator('#mockup-dialog').getByRole('button',{name:'저장'}).click();
  await page.getByRole('button',{name:'완료',exact:true}).click();
  await page.getByRole('button',{name:'AI 작성 도움'}).click();
  await page.getByRole('button',{name:'현행수준 내용 도움'}).waitFor();
  assert.equal(requests.length,0);
  assert((await page.locator('.ai-chat-message.assistant').last().innerText()).includes('현행수준 단계'));
  await page.getByRole('button',{name:'AI 작성 도움'}).click();
  assert.equal(requests.length,0);
  assert.equal(await page.getByRole('button',{name:'현행수준 내용 도움'}).count(),2);
  await page.getByRole('button',{name:'현행수준 내용 도움'}).last().click();
  await page.getByText('자료를 확인하고 필요한 정보를 알려주세요.').waitFor();
  assert.equal(requests.length,1);
  assert(JSON.stringify(requests[0]).includes('잘하는 점'));
  assert(JSON.stringify(requests[0]).includes('관찰한 내용'));
  assert.equal(await page.getByLabel('잘하는 점',{exact:true}).inputValue(),'관찰한 내용');
  await page.locator('[data-iew-id="plan"]').click();
  await page.locator('#iew-goal-text').fill('활동을 선택한다');
  await page.locator('[data-iew-id="assessment"]').click();
  await page.getByRole('button',{name:'AI 작성 도움'}).click();
  await page.getByRole('button',{name:'학기별 평가 평가 계획 도움'}).waitFor();
  assert.equal(requests.length,1);
  console.log('IEP manual suggestions, eligibility and zero-token menu passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
