const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  let step=0,readResult,fillResults=[],mode='normal';
  const ids=['#journal-raw','#journal-finalSocialEmotional','#journal-finalLearningActivity','#journal-finalHealthSafety','#journal-finalSpecialNotes'];
  const labels=['자유 메모 ! _ ?＆','사회 · 정서','학습 · 활동','건강 · 안전','특이사항'];
  const call=(name,args)=>({type:'function_call',name,call_id:`call_${step}`,arguments:JSON.stringify(args)});
  await page.route('**/careit-mockup.html',route=>route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'careit-mockup.html'))}));
  await page.route('**/api/local-ai/**',async route=>{
    const url=route.request().url();let body;
    if(url.endsWith('/status'))body={connected:true};
    else if(url.endsWith('/models'))body={models:[{slug:'gpt-6-luna'}]};
    else if(url.endsWith('/respond')){
      const sent=route.request().postDataJSON(),last=sent.turn.filter(item=>item.type==='function_call_output').at(-1);
      if(last){const output=JSON.parse(last.output);if(!readResult)readResult=output;else fillResults.push(output);}
      if(step===0){step++;body={text:'',output:[call('read_field',{target:'일지 기록 전체'})]};}
      else if(mode==='conflict'&&step===1){await page.locator(ids[0]).fill('사용자가 중간에 직접 수정한 내용');step++;body={text:'',output:[call('interact',{action:'fill',target:labels[0],value:'AI가 다시 쓴 내용'})]};}
      else if(mode==='normal'&&step<=5){const i=step-1;step++;body={text:'',output:[call('interact',{action:'fill',target:labels[i],value:`가상으로 다듬은 내용 ${i+1}`})]};}
      else body={text:'일지 기록을 다듬었어요.',output:[]};
    }else body={};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  try{
    await page.goto('http://127.0.0.1:8767/careit-mockup.html#/journals/new?recipient=0');
    for(let i=0;i<ids.length;i++)await page.locator(ids[i]).fill(`가상 원문 ${i+1}`);
    await page.locator('.sidebar [data-action="ai-toggle"]').click();
    await page.waitForTimeout(500);
    await page.locator('#ai-chat-input').fill('일지기록에 적어둔 멘트들 다듬어줘');
    await page.locator('#ai-chat-form').evaluate(form=>form.requestSubmit());
    await page.getByText('일지 기록을 다듬었어요.',{exact:true}).waitFor({timeout:15000});
    assert.equal(readResult.fields.length,5);
    assert.deepEqual(readResult.fields.map(field=>field.value),ids.map((_,i)=>`가상 원문 ${i+1}`));
    assert.equal(fillResults.length,5);
    assert(fillResults.every(result=>result.ok),JSON.stringify(fillResults));
    for(let i=0;i<ids.length;i++)assert.equal(await page.locator(ids[i]).inputValue(),`가상으로 다듬은 내용 ${i+1}`);
    step=0;readResult=null;fillResults=[];mode='conflict';
    await page.locator('#ai-chat-input').fill('일지기록에 적어둔 멘트들 다듬어줘');
    await page.locator('#ai-chat-form').evaluate(form=>form.requestSubmit());
    await page.waitForFunction(()=>!document.querySelector('.ai-chat-loading'));
    assert.equal(await page.locator(ids[0]).inputValue(),'사용자가 중간에 직접 수정한 내용');
    assert.equal(fillResults[0].ok,false);
    console.log('AI reads and updates all five current journal fields: passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
