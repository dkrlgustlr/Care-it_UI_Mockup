const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  let release;const pending=new Promise(resolve=>release=resolve);
  await page.route('**/careit-mockup.html',route=>route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'careit-mockup.html'))}));
  await page.route('**/api/local-ai/**',async route=>{
    const url=route.request().url();
    if(url.endsWith('/respond')){await pending;try{await route.fulfill({json:{text:'늦은 응답',output:[]}});}catch{}return;}
    await route.fulfill({json:url.endsWith('/status')?{connected:true}:{models:[{slug:'gpt-6-luna'}]}});
  });
  try{
    await page.goto('http://127.0.0.1:8767/careit-mockup.html#/');
    await page.locator('.sidebar [data-action="ai-toggle"]').click();
    await page.waitForTimeout(500);
    await page.locator('#ai-chat-input').fill('가상 테스트');
    await page.locator('#ai-chat-form').evaluate(form=>form.requestSubmit());
    const stop=page.getByRole('button',{name:'응답 중단'});
    await stop.waitFor();
    assert.equal(await stop.getAttribute('type'),'button');
    assert.equal(await page.locator('.ai-chat-loading button').count(),0);
    await stop.click();release();
    await page.getByText('요청을 중단했어요. 입력한 내용은 대화에 남아 있어요.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'메시지 보내기'}).getAttribute('type'),'submit');
    assert.equal(await page.getByText('늦은 응답',{exact:true}).count(),0);
    console.log('Send button switches to stop and cancels the pending reply: passed');
  }finally{release();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
