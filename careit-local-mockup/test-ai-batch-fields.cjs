const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage();let calls=0,results=[],mode='batch';
  await page.route('**/careit-mockup.html',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync('careit-mockup.html')}));
  await page.route('**/api/local-ai/**',r=>{
   const url=r.request().url();let result={};
   if(url.endsWith('/status'))result={connected:true};
   else if(url.endsWith('/models'))result={models:[{slug:'gpt-6-luna'}]};
   else if(url.endsWith('/respond')){
    const body=r.request().postDataJSON();results=body.turn.filter(x=>x.type==='function_call_output').map(x=>JSON.parse(x.output));
    result=calls++===0?{output:[{type:'function_call',name:mode==='batch'?'fill_fields':'interact',call_id:'batch',arguments:JSON.stringify(mode==='batch'?{fields:[{target:'단기목표',value:'가상 단기목표'},{target:'평가 기준',value:'평가 계획안: 다섯 번 중 네 번 관찰한다.'},{target:'지도 상황',value:'가상 만들기 활동'},{target:'지원 방법',value:'그림을 보여준다.'}]}:{action:'fill',target:'장기목적',value:'근거 없는 목적'})}]}:{text:mode==='batch'?'작성했어요.':'근거가 부족해요.',output:[]};
   }
   return r.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
  await page.locator('[data-iew-id="plan"]').click();
  await page.getByRole('link',{name:'케어릿 AI',exact:true}).click();
  await page.locator('#ai-chat-input').fill('단기목표와 평가 기준, 지도 상황과 지원 방법을 작성해줘');
  await page.locator('#ai-chat-input').press('Enter');
  await page.getByText('작성했어요.',{exact:true}).waitFor();
  assert.equal(calls,2);
  assert.equal(results[0].ok,true);
  assert.equal(await page.locator('#iew-criterion').inputValue(),'다섯 번 중 네 번 관찰한다.');
  assert.equal(await page.locator('#iew-instruction-support').inputValue(),'그림을 보여준다.');
  mode='long';calls=0;results=[];
  await page.locator('#ai-chat-input').fill('장기목적을 작성해줘');
  await page.locator('#ai-chat-input').press('Enter');
  await page.getByText('근거가 부족해요.',{exact:true}).waitFor();
  assert.equal(results[0].ok,false);
  assert.match(results[0].message,/근거가 부족/);
  assert.equal(await page.locator('#iew-longGoal').inputValue(),'');
  console.log('Batch fills four IEP fields in one tool call and removes redundant prefix');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
