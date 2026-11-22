const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  page.setDefaultTimeout(120000);
  try{
    await page.goto('http://127.0.0.1:8767/careit-mockup.html#/');
    await page.evaluate(async()=>{const b=window.__careitAiBridge;b.state.savedJournals.unshift({recipient:0,date:'2026-11-05',text:'가상 검증 일지: 파란나비 그림을 관찰했다.'});await b.store.save(JSON.stringify(b.state));});
    await page.locator('.sidebar [data-action="ai-toggle"]').click();
    await page.waitForTimeout(1200);
    await page.locator('#ai-chat-input').fill('가상 사례야. IEP 화면을 열고 4번 현재학습수행수준의 현재 수행 모습에 "그림을 가리켰다."라고 입력해줘.');
    await page.locator('#ai-chat-form').evaluate(form=>form.requestSubmit());
    await page.locator('.ai-chat-message.assistant').last().waitFor();
    await page.waitForFunction(()=>!document.querySelector('.ai-chat-loading'),null,{timeout:120000});
    const first=await page.locator('.ai-chat-message.assistant').last().innerText();
    assert.equal(await page.locator('[data-iew-id="current"]').getAttribute('aria-pressed'),'true',first);
    assert.equal(await page.locator('#iew-current').inputValue(),'그림을 가리켰다.',first);
    await page.locator('#ai-chat-input').fill('파란나비가 나온 일지 찾아줘.');
    await page.locator('#ai-chat-form').evaluate(form=>form.requestSubmit());
    await page.waitForFunction(()=>!document.querySelector('.ai-chat-loading'),null,{timeout:120000});
    const second=await page.locator('.ai-chat-message.assistant').last().innerText();
    assert.match(second,/2026|11월|파란나비/,second);
    console.log(JSON.stringify({navigation:first,search:second}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
