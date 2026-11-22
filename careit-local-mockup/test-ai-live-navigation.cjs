const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  page.setDefaultTimeout(120000);
  try{
    await page.goto('http://127.0.0.1:8767/careit-mockup.html#/iep');
    await page.locator('#iew-className').fill('가상 테스트 학급');
    await page.locator('.sidebar [data-action="ai-toggle"]').click();
    await page.waitForTimeout(1000);
    await page.locator('#ai-chat-input').fill('오늘 일지 작성 도와줘');
    await page.locator('#ai-chat-form').evaluate(form=>form.requestSubmit());
    await page.locator('.ai-chat-message.assistant').last().waitFor();
    await page.waitForFunction(()=>!document.querySelector('.ai-chat-loading'),null,{timeout:120000});
    const answer=await page.locator('.ai-chat-message.assistant').last().innerText();
    assert.match(page.url(),/#\/journals\/new/,answer);
    const plan=await page.evaluate(()=>window.__careitAiBridge.state.iep.semesterPlans[0]);
    assert.equal(plan.savedRevision,plan.revision,answer);
    assert.equal(plan.personal.className,'가상 테스트 학급');
    assert.doesNotMatch(answer,/직접.*이동|이동해 주세요/);
    assert.doesNotMatch(answer,/응답을 완료하지 못|요청을 처리하지 못|다시 요청해 주세요/);
    console.log('GPT-6 Luna: IEP saved and journal opened');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
