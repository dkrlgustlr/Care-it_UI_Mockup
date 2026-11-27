const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const requests=[];
 try{
  await page.route('**/careit-mockup.html',r=>r.fulfill({status:200,contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
  await page.route('**/api/local-ai/**',r=>{
   const url=r.request().url();let result={};
   if(url.endsWith('/status'))result={connected:true};
   else if(url.endsWith('/models'))result={models:[{slug:'gpt-6-luna'}]};
   else if(url.endsWith('/respond')){
    requests.push(r.request().postDataJSON());
    result=requests.length===2?{output:[{type:'function_call',name:'interact',call_id:'test-call',arguments:JSON.stringify({action:'fill',target:'단기목표',value:'자동 변경 시도'})}]}:{text:'어떤 도움을 받나요?',output:[]};
   }
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
  await page.waitForFunction(()=>document.querySelector('[data-ai-local-controls]')?.hidden);
  await page.locator('[data-iew-id="current"]').click();
  await page.getByLabel('강점',{exact:true}).fill('가상: 그림을 선택한다');
  await page.locator('[data-iew-id="plan"]').click();
  await page.locator('#iew-longGoal').fill('가상: 원하는 활동을 표현한다');
  await page.locator('#iew-goal-text').fill('가상: 그림을 가리킨다');
  async function menu(){await page.getByRole('button',{name:'AI 작성 도움'}).click();return page.locator('.ai-chat-message.assistant').last();}
  let m=await menu();
  for(const label of ['목표 구체화하기','우선 목표 찾기','단기목표 나누기'])assert.equal(await m.getByRole('button',{name:label,exact:true}).count(),1);
  assert.equal(requests.length,0);
  await m.getByRole('button',{name:'목표 구체화하기'}).click();
  await page.waitForFunction(()=>!document.querySelector('.ai-chat-loading'));
  assert(JSON.stringify(requests[0]).includes('한 기회의 시작과 끝'));
  assert(JSON.stringify(requests[0]).includes('가상: 그림을 가리킨다'));
  await page.locator('#ai-chat-input').fill('언어적 도움을 받습니다');
  await page.locator('#ai-chat-input').press('Enter');
  await page.waitForFunction(()=>!document.querySelector('.ai-chat-loading'));
  assert(JSON.stringify(requests[1]).includes('목표 구체화'));
  assert(JSON.stringify(requests[2]).includes('입력란은 변경하지 않았어요'));
  assert.equal(await page.locator('#iew-goal-text').inputValue(),'가상: 그림을 가리킨다');
  m=await menu();await m.getByRole('button',{name:'우선 목표 찾기'}).click();await page.waitForFunction(()=>!document.querySelector('.ai-chat-loading'));
  assert(JSON.stringify(requests[3]).includes('가족의 바람'));
  m=await menu();await m.getByRole('button',{name:'단기목표 나누기'}).click();await page.waitForFunction(()=>!document.querySelector('.ai-chat-loading'));
  assert(JSON.stringify(requests[4]).includes('시간적 순서나 도움 정도'));
  assert.equal(await page.locator('#iew-longGoal').inputValue(),'가상: 원하는 활동을 표현한다');
  console.log('IEP guidance: three tasks, follow-up, no-token menu and no overwrite passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
