const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 let calls=[],outputs=[],developer='',step=0,done=0,reply=''; const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/careit-mockup.html',r=>r.fulfill({status:200,contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
 await page.route('**/api/local-ai/**',async r=>{
  const path=new URL(r.request().url()).pathname; let result={};
  if(path.endsWith('/status'))result={connected:true,usage:{limit:500000,remaining:450000}};
  else if(path.endsWith('/models'))result={models:[{slug:'gpt-6-luna'}]};
  else if(path.endsWith('/respond')){
   const turn=r.request().postDataJSON().turn;
   if(!step)developer=turn.filter(x=>x.role==='developer').map(x=>x.content).join('\n');
   outputs.push(...turn.filter(x=>x.type==='function_call_output').slice(-1).map(x=>JSON.parse(x.output)));
   if(step<calls.length){const [name,args]=calls[step++];result={output:[{type:'function_call',name,call_id:`call_${step}`,arguments:JSON.stringify(args)}]};}
   else {done++;result={text:reply||`시험 완료 ${done}`,output:[]};}
  }
  await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
 });
 const request=async(kind,actions)=>{calls=actions;outputs=[];step=0;const expected=done+1;await page.locator(`[data-iep-help="${kind}"]`).click();await page.getByText(`시험 완료 ${expected}`,{exact:true}).waitFor();};
 const fill=(target,value)=>['interact',{action:'fill',target,value}];
 try{
  await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
  await page.waitForTimeout(500);
  await page.locator('[data-iew-id="placement"]').click();
  await request('placement',[fill('특수학급 활동 내용·방법','기존 기록 기반 지원')]);
  assert.equal(await page.locator('#iew-special').inputValue(),'기존 기록 기반 지원');
  await page.locator('[data-iew-id="services"]').click();
  await request('services',[fill('보조공학','그림 의사소통판')]);
  assert.equal(await page.locator('#iew-assistive').inputValue(),'그림 의사소통판');
  await page.locator('[data-iew-id="current"]').click();
  calls=[];outputs=[];step=0;reply='관찰한 모습을 알려주세요?';
  await page.locator('[data-iep-help="current"]').click();await page.getByText(reply,{exact:true}).waitFor();
  reply='';calls=[fill('현재 수행 모습','그림을 가리킴')];outputs=[];step=0;const expected=done+1;
  await page.locator('#ai-chat-input').fill('그림을 가리킴');await page.locator('#ai-chat-form').evaluate(form=>form.requestSubmit());
  await page.getByText(`시험 완료 ${expected}`,{exact:true}).waitFor();
  assert.equal(await page.locator('#iew-current').inputValue(),'그림을 가리킴');
  assert.match(developer,/IEP 작성 규칙/);
  await page.evaluate(()=>{const s=window.__careitAiBridge.state;(s.generatedReports||=[]).unshift({id:'ai-selected',recipient:0,from:'2026-10-01',to:'2026-10-07',generated:'2026-10-08',version:1,mock:true},{id:'ai-unselected',recipient:0,from:'2026-09-01',to:'2026-09-07',generated:'2026-09-08',version:1,mock:true});});
  await page.locator('[data-iew-id="plan"]').click();
  await page.locator('[data-iew-id="records"]').click();
  await page.locator('[data-iew-record="report:ai-selected"]').check();
  await page.locator('[data-iew-action="attach"]').click();
  await page.locator('.iew-record-back').click();
  await request('goal',[fill('단기목표','그림으로 도움 요청')]);
  assert.equal(await page.locator('#iew-goal-text').inputValue(),'그림으로 도움 요청');
  assert.match(developer,/2026-10-01/);assert.doesNotMatch(developer,/2026-09-01/);
  await page.evaluate(()=>{(window.__careitAiBridge.state.hiddenReportIds||=[]).push('0:ai-selected');});
  await request('education',[fill('교육내용과 활동','그림 카드를 사용한다'),fill('교육방법과 지원','카드를 보여준다')]);
  assert.doesNotMatch(developer,/2026-10-01/);assert.match(developer,/unavailableSources\":1/);
  assert.equal(await page.locator('#iew-activity').inputValue(),'그림 카드를 사용한다');
  await page.locator('[data-iew-id="assessment"]').click();
  await request('assessment',[fill('평가 방법','놀이 중 요청을 관찰한다'),fill('평가 기준','3회 중 2회 요청한다'),fill('평가 기간','3월~5월'),fill('월 평가','목표를 달성했다'),fill('실제 행동','실제로 했음'),fill('학기말 평가 보고','목표를 달성했다')]);
  assert.equal(await page.locator('#iew-assessment-method').inputValue(),'놀이 중 요청을 관찰한다');
  assert.equal(await page.locator('#iew-assessment-criterion').inputValue(),'3회 중 2회 요청한다');
  assert.equal(await page.locator('#iew-assessment-period').inputValue(),'3월~5월');
  assert.equal(await page.locator('#iew-monthly-evaluation').inputValue(),'');
  assert.equal(await page.locator('#iew-semesterEvaluation').inputValue(),'');
  assert.equal(await page.locator('[data-iew-key="behavior"]').inputValue(),'');
  assert(outputs.slice(-3).every(o=>!o.ok),JSON.stringify(outputs));
  assert.match(developer,/관찰 결과나 달성 여부/);
  await request('assessment',[fill('평가 방법','기존 내용 덮어쓰기')]);
  assert.equal(await page.locator('#iew-assessment-method').inputValue(),'놀이 중 요청을 관찰한다');
  assert.equal(outputs.at(-1).ok,false);
  await page.locator('[data-iew-id="plan"]').click();
  assert.equal(await page.locator('#iew-evaluation').inputValue(),'놀이 중 요청을 관찰한다');
  assert.equal(await page.locator('#iew-criterion').inputValue(),'3회 중 2회 요청한다');
  assert.deepEqual(errors,[]);
  console.log('IEP AI steps and evaluation guard: passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
