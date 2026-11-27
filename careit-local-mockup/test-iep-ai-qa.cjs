const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1000}});
 const requests=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/careit-mockup.html',r=>r.fulfill({status:200,contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
  await page.route('**/api/local-ai/**',r=>{const url=r.request().url();let data={};if(url.endsWith('/status'))data={connected:true};else if(url.endsWith('/models'))data={models:[{slug:'gpt-6-luna'}]};else if(url.endsWith('/respond')){requests.push(r.request().postDataJSON());data={text:'관찰 사실을 확인해 주세요.',output:[]};}return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
  await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
  await page.waitForFunction(()=>!document.querySelector('[data-ai-local-controls]')||document.querySelector('[data-ai-local-controls]').hidden);
  async function menu(){const previous=await page.locator('.ai-chat-message.assistant').count();await page.getByRole('button',{name:'AI 작성 도움'}).click();await page.waitForFunction(n=>document.querySelectorAll('.ai-chat-message.assistant').length>n,previous);return page.locator('.ai-chat-message.assistant').last();}
  async function has(m,name){assert.equal(await m.getByRole('button',{name,exact:true}).count(),1,name);}
  let m=await menu();await has(m,'인적사항 내용에 필요한 정보 확인');assert.equal(await m.getByText('현재 자료로 도움 가능',{exact:true}).count(),0);
  await page.locator('[data-iew-id="placement"]').click();await page.locator('#iew-special').fill('특수학급에서 주 3회 참여');
  m=await menu();await has(m,'배치·지원계획 내용 도움');
  await page.locator('#iew-special').fill('');m=await menu();await has(m,'배치·지원계획 내용에 필요한 정보 확인');
  await page.locator('[data-iew-id="current"]').click();await page.getByLabel('강점',{exact:true}).fill('그림을 보고 선택함');
  m=await menu();await has(m,'현행수준 내용 도움');await has(m,'우선 목표 찾기');
  await page.getByRole('button',{name:'의사소통',exact:true}).click();m=await menu();await has(m,'현행수준 내용에 필요한 정보 확인');
  await page.locator('[data-iew-id="plan"]').click();await page.locator('#iew-goal-text').fill('도움 그림을 가리킨다');
  await page.locator('[data-iew-id="assessment"]').click();m=await menu();await has(m,'학기별 평가 평가 계획 도움');
  await page.locator('[data-iew-id="plan"]').click();await page.locator('[data-iew-action="add-goal"]').click();await page.locator('[data-iew-id="assessment"]').click();m=await menu();await has(m,'학기별 평가 평가 계획에 필요한 정보 확인');
  await page.locator('[data-iew-id="current"]').click();await page.getByRole('button',{name:'양식 편집',exact:true}).click();await page.getByRole('button',{name:'현행수준 제목 수정'}).click();await page.locator('#iew-form-name').fill('현재 상태');await page.locator('#mockup-dialog').getByRole('button',{name:'저장'}).click();await page.getByRole('button',{name:'완료',exact:true}).click();
  m=await menu();await has(m,'현재 상태 내용에 필요한 정보 확인');
  await page.locator('.iew-toolbar [data-iew-id="records"]').click();await page.locator('[data-iew-record="report:sample"]').check();await page.getByRole('button',{name:'선택한 기록 연결'}).click();await page.locator('.iew-record-back').click();
  m=await menu();await has(m,'현재 상태 내용 도움');
  await page.locator('[data-iew-id="assessment"]').click();m=await menu();await has(m,'학기별 평가 평가 계획에 필요한 정보 확인');await page.locator('[data-iew-id="current"]').click();
  await page.locator('.iew-toolbar [data-iew-id="records"]').click();await page.getByRole('button',{name:'연결 해제'}).first().click();await page.locator('.iew-record-back').click();m=await menu();await has(m,'현재 상태 내용에 필요한 정보 확인');
  await page.getByRole('button',{name:'양식 편집',exact:true}).click();
  await page.getByRole('button',{name:'+ 섹션 추가'}).click();
  await page.locator('#iew-builder-name').fill('가상 자료');
  await page.locator('#mockup-dialog').getByRole('button',{name:'추가',exact:true}).click();
  const extra=page.locator('.iew-builder-section').filter({hasText:'가상 자료'});
  await extra.getByRole('button',{name:'+ 항목 추가'}).click();
  await page.locator('#iew-builder-name').fill('새 관찰');
  await page.locator('#mockup-dialog').getByRole('button',{name:'추가',exact:true}).click();
  await page.getByLabel('새 관찰',{exact:true}).fill('가상 관찰 입력');
  await page.getByRole('button',{name:'완료',exact:true}).click();
  m=await menu();await has(m,'현재 상태 내용 도움');
  await page.getByRole('button',{name:'양식 편집',exact:true}).click();
  await page.getByRole('button',{name:'가상 자료 섹션 삭제'}).click();
  await page.locator('#mockup-dialog').getByRole('button',{name:'삭제',exact:true}).click();
  await page.getByRole('button',{name:'완료',exact:true}).click();
  m=await menu();await has(m,'현재 상태 내용에 필요한 정보 확인');
  assert.equal(requests.length,0);assert.deepEqual(errors,[]);
  console.log('IEP QA: blank/filled/cleared, domain and goal isolation, renamed step, report attach/detach and zero-token menu passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
