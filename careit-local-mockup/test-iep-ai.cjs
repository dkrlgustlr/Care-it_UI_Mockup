const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const url=pathToFileURL(path.join(__dirname,'careit-mockup.html')).href;
  const page=await browser.newPage({viewport:{width:1920,height:900}});
  page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const send=async text=>{await page.locator('#ai-chat-input').fill(text);await page.locator('#ai-chat-input').press('Enter');};
  try{
    await page.goto(url+'#/');
    assert.equal(await page.locator('.sidebar [data-route="/iep"]').count(),1);
    await page.evaluate(()=>{window.__careitAiBridge.state.recipients[0].ageBand='만 3~5세';});
    await page.locator('.sidebar [data-route="/iep"]').click();
    await page.evaluate(()=>{location.hash='#/iep?view=monthly';});
    const observation=page.locator('#iep-observation'),goal=page.locator('#iep-monthGoal');
    await observation.fill('그림을 보여주면 도움 그림을 가리켜요.');
    await goal.fill('기존 목표');
    await page.getByRole('button',{name:'목표 함께 정하기'}).click();
    await page.getByText(/월 목표에 담고 싶은 내용을 알려주세요/).waitFor();
    await send('놀이 중 그림으로 도움을 요청한다.');
    await page.getByText(/입력한 문장이에요/).waitFor();
    assert.equal(await goal.inputValue(),'기존 목표');
    await page.getByRole('button',{name:'제안 반영'}).last().click();
    assert.equal(await goal.inputValue(),'놀이 중 그림으로 도움을 요청한다.');

    await page.getByRole('button',{name:'목표 함께 정하기'}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('.ai-chat-message')].filter(el=>el.textContent.includes('월 목표에 담고 싶은 내용을 알려주세요')).length===2);
    await send('변경 제안');await page.getByRole('button',{name:'제안 반영'}).last().waitFor();
    await observation.fill('그림을 스스로 고른 모습');
    await page.getByRole('button',{name:'제안 반영'}).last().click();
    await page.getByText(/대상이나 계획 내용이 바뀌어 제안을 반영하지 않았어요/).waitFor();
    assert.equal(await goal.inputValue(),'놀이 중 그림으로 도움을 요청한다.');

    await page.locator('[data-iep-action="manual"]').click();
    await page.locator('#iep-result-activity').waitFor();
    await page.getByText('계획 구성에 참고한 자료').click();
    assert.equal(await page.getByRole('link',{name:'장애인 등에 대한 특수교육법 시행규칙'}).count(),1);
    await page.locator('[data-iep-help="activity"]').click();
    await page.getByText(/활동 계획에 담고 싶은 내용을 알려주세요/).waitFor();
    const activity=page.locator('#iep-result-activity'),original=await activity.inputValue();
    await send('그림 카드를 고르는 놀이');await page.getByRole('button',{name:'제안 반영'}).last().waitFor();
    assert.equal(await activity.inputValue(),original);
    await page.getByRole('button',{name:'제안 반영'}).last().click();
    assert.equal(await activity.inputValue(),'그림 카드를 고르는 놀이');
    await page.locator('[data-iep-help="evaluation"]').click();
    await page.getByText(/평가방법에 담고 싶은 내용을 알려주세요/).waitFor();
    await send('활동 중 도움 요청과 지원 정도를 기록한다.');
    await page.getByRole('button',{name:'제안 반영'}).last().waitFor();
    await page.getByRole('button',{name:'제안 반영'}).last().click();
    assert.equal(await page.locator('#iep-result-evaluationMethod').inputValue(),'활동 중 도움 요청과 지원 정도를 기록한다.');
    assert.equal(await page.locator('#iep-result-evaluationResult').inputValue(),'');
    await page.locator('#iep-result-content').fill('그림으로 도움을 요청하는 활동');
    await page.locator('#iep-result-support').fill('필요할 때 그림을 보여준다.');
    await page.locator('#iep-result-criterion').fill('요청 방식과 지원 정도');
    await page.locator('[data-iep-action="save"]').click();
    await page.getByText('저장 완료',{exact:true}).waitFor();
    await page.locator('[data-iep-action="saved"]').click();
    await page.locator('[data-iep-action="copy"]').click();
    await page.locator('#iep-result-activity').waitFor();
    assert.equal(await page.locator('#iep-result-evaluationResult').inputValue(),'');
    assert.match(await page.locator('.iep-result-header').innerText(),/2026\.10\.01/);
    assert.deepEqual(errors,[]);

    const example=await browser.newPage({viewport:{width:1920,height:900}});
    await example.goto(url+'#/iep?view=monthly');
    const existing=await example.locator('#iep-monthGoal').inputValue();
    await example.getByRole('button',{name:'목표 함께 정하기'}).click();
    await example.getByRole('button',{name:'문장 예시 보기'}).click();
    await example.getByText(/도움이 필요할 때 그림을 사용해 도움을 요청한다/).waitFor();
    assert.equal(await example.locator('#iep-monthGoal').inputValue(),existing);
    await example.getByRole('button',{name:'기존 내용 유지'}).click();
    assert.equal(await example.locator('#iep-monthGoal').inputValue(),existing);
    await example.close();

    const navigation=await browser.newPage({viewport:{width:1920,height:900}});
    await navigation.goto(url+'#/');
    await navigation.locator('.sidebar [data-action="ai-toggle"]').click();
    await navigation.locator('#ai-chat-input').fill('IEP 열어줘');
    await navigation.locator('#ai-chat-input').press('Enter');
    await navigation.locator('.iep-page').waitFor();
    await navigation.locator('[data-iew-id="plan"]').click();
    assert.equal(await navigation.getByRole('button',{name:'AI에게 목표 작성 요청'}).count(),1);
    await navigation.close();

    const mobile=await browser.newPage({viewport:{width:390,height:844}});
    await mobile.goto(url+'?previewMode=app#/iep?view=monthly');
    await mobile.getByRole('button',{name:'목표 함께 정하기'}).click();
    assert.equal(await mobile.locator('#ai-dock').isVisible(),true);
    await mobile.locator('[data-action="ai-close"]').click();
    assert.equal(await mobile.locator('#iep-observation').isVisible(),true);
    await mobile.close();
    console.log('IEP navigation, reviewed suggestions, stale protection and mobile: passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
