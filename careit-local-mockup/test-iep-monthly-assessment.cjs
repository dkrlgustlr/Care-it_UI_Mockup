const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const choose=async(selector,label)=>{
    const id=await page.locator(selector).getAttribute('id');
    await page.locator(`[data-iep-select="${id}"]`).click();
    await page.getByRole('option',{name:label,exact:true}).click();
  };
  try{
    await page.goto(pathToFileURL(path.join(__dirname,'careit-mockup.html')).href+'#/');
    await page.locator('.sidebar [data-route="/iep"]').click();
    await page.locator('[data-iew-id="plan"]').click();
    await page.locator('#iew-goal-text').fill('그림으로 도움을 요청한다');
    await page.locator('[data-iew-id="assessment"]').click();
    assert.match(await page.locator('.iew-assessment-goal').innerText(),/그림으로 도움을 요청한다/);
    const firstMonth=await page.locator('[data-iew-switch="month"]').inputValue();
    const options=await page.locator('[data-iew-switch="month"] option').allTextContents();
    const secondMonth=options[1];
    await page.locator('#iew-monthly-goal').fill('이번 달 도움을 요청한다');
    await page.locator('#iew-monthly-plan').fill('그림 카드를 보여준다');
    await page.locator('[data-iew-key="behavior"]').fill('그림을 가리켰다');
    await choose('[data-iew-switch="month"]',secondMonth);
    assert.equal(await page.locator('#iew-monthly-goal').inputValue(),'');
    assert.equal(await page.locator('[data-iew-key="behavior"]').inputValue(),'');
    await page.locator('[data-iew-key="behavior"]').fill('손을 들었다');
    await choose('[data-iew-switch="month"]',`${firstMonth}월`);
    assert.equal(await page.locator('[data-iew-key="behavior"]').inputValue(),'그림을 가리켰다');
    await page.waitForFunction(()=>!window.__careitAiBridge.store.pending);
    await page.reload();
    await page.locator('[data-iew-id="assessment"]').click();
    assert.equal(await page.locator('#iew-monthly-goal').inputValue(),'이번 달 도움을 요청한다');
    assert.equal(await page.locator('[data-iew-key="behavior"]').inputValue(),'그림을 가리켰다');
    await page.evaluate(async()=>{
      const b=window.__careitAiBridge,p=b.state.iep.semesterPlans[0],g=p.domains[0].goals[0];
      g.observations.push({id:'legacy-observation',date:'',situation:'기존 상황',behavior:'기존 관찰',support:'',evidence:''});
      await b.store.save(JSON.stringify(b.state));
    });
    await page.reload();await page.locator('[data-iew-id="assessment"]').click();
    assert.match(await page.locator('#iew-content').innerText(),/월 미지정 관찰/);
    assert.equal(await page.locator('#iew-observation-behavior-legacy-observation').inputValue(),'기존 관찰');
    await choose('[data-iew-assign-month="legacy-observation"]',secondMonth);
    assert.equal(await page.getByText('월 미지정 관찰').count(),0);
    await choose('[data-iew-switch="month"]',secondMonth);
    await page.getByRole('button',{name:'관찰 2',exact:true}).click();
    assert.equal(await page.locator('#iew-observation-behavior-legacy-observation').inputValue(),'기존 관찰');
    await page.locator('[data-iew-id="document"]').click();
    assert.match(await page.locator('#iew-content').innerText(),/이번 달 도움을 요청한다/);
    assert.match(await page.locator('#iew-content').innerText(),/기존 관찰/);
    assert.deepEqual(errors,[]);
    console.log('IEP monthly assessment: passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
