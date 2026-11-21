const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const base=pathToFileURL(path.join(__dirname,'careit-mockup.html')).href;
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.setDefaultTimeout(8000);
  const send=async text=>{await page.locator('#ai-chat-input').fill(text);await page.locator('#ai-chat-input').press('Enter');};
  try {
    await page.goto(base+'#/ai-chat');
    const name=await page.evaluate(async()=>{
      const bridge=window.__careitAiBridge,s=bridge.state,index=2;
      s.subscription={plan:'starter',nextBillingOn:'2099.01.01',autoRenew:true};s.aiConsent=true;
      s.recipients[index].active=true;
      s.drafts[index]={'journal-raw':'오늘  그림책을 읽었어요.','journal-finalLearningActivity':'블록을  쌓았어요.','quick-0':'퀵체크 비밀 값'};
      const d=new Date(),date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
      s.draftDates[index]=date;await bridge.store.save(JSON.stringify(s));return s.recipients[index].name;
    });
    await send(`${name} 오늘 일지 문장 다듬어줘`);
    const journal=page;
    await journal.locator('#journal-raw').waitFor();
    await page.getByText(/공백만 정리한 예시/).waitFor();
    assert.equal(await journal.locator('[data-action="ai-preview"]').count(),0);
    assert.equal(await journal.locator('#journal-raw').inputValue(),'오늘  그림책을 읽었어요.');
    assert.ok(!(await page.locator('.ai-chat-messages').innerText()).includes('퀵체크 비밀 값'));
    await journal.locator('#journal-raw').fill('직접 바꾼 원문');
    await page.getByRole('button',{name:'변경 내용 적용',exact:true}).last().click();
    await page.getByText(/일지 내용이 바뀌었거나 수정할 수 없어요/).waitFor();
    assert.equal(await journal.locator('#journal-raw').inputValue(),'직접 바꾼 원문');
    await journal.locator('#journal-raw').fill('다시  그림책을 읽었어요.');
    await send('문장 정리해줘');
    await page.getByRole('button',{name:'변경 내용 적용',exact:true}).last().click();
    await page.getByText(/일지에 반영했어요. 내용을 확인한 뒤 직접 저장/).waitFor();
    assert.equal(await journal.locator('#journal-raw').inputValue(),'다시 그림책을 읽었어요.');
    assert.equal(await journal.locator('#journal-finalLearningActivity').inputValue(),'블록을 쌓았어요.');
    assert.equal(await page.evaluate(()=>window.__careitAiBridge.state.savedJournals.some(row=>row.text==='다시 그림책을 읽었어요.')),false);
    for(const mode of ['free','no-consent']){
      const other=await browser.newPage({viewport:{width:1440,height:900}});other.setDefaultTimeout(8000);
      await other.goto(base+'#/ai-chat');
      await other.evaluate(async mode=>{
        const bridge=window.__careitAiBridge,s=bridge.state;
        s.recipients.forEach((person,i)=>person.active=i===0);
        s.subscription=mode==='free'?null:{plan:'starter',nextBillingOn:'2099.01.01',autoRenew:true};
        s.couponPlusFrom='';s.couponPlusUntil='';s.aiConsent=mode==='free';
        const d=new Date();s.draftDates[0]=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
        s.drafts[0]={'journal-raw':'실제 관찰 내용'};await bridge.store.save(JSON.stringify(s));
      },mode);
      await other.locator('#ai-chat-input').fill('문장 정리해줘');await other.locator('#ai-chat-input').press('Enter');
      await other.getByText(mode==='free'?/문장 정리는 플러스와 팀 요금제/:/문장 정리 전에 AI 기능 동의/).waitFor();
      assert.equal(await other.getByRole('button',{name:'변경 내용 적용'}).count(),0);
      await other.close();
    }
    const mobile=await browser.newPage({viewport:{width:390,height:844}});mobile.setDefaultTimeout(8000);
    await mobile.goto(base+'?previewMode=app#/ai-chat');
    await mobile.evaluate(async()=>{
      const bridge=window.__careitAiBridge,s=bridge.state;s.recipients.forEach((person,i)=>person.active=i===0);
      s.subscription={plan:'starter',nextBillingOn:'2099.01.01',autoRenew:true};s.aiConsent=true;
      const d=new Date();s.draftDates[0]=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
      s.drafts[0]={'journal-raw':'오늘  산책했어요.'};await bridge.store.save(JSON.stringify(s));
    });
    await mobile.locator('#ai-chat-input').fill('문장 정리해줘');await mobile.locator('#ai-chat-input').press('Enter');
    await mobile.getByText(/공백만 정리한 예시/).waitFor();
    await mobile.getByRole('button',{name:'변경 내용 적용',exact:true}).click();
    await mobile.getByRole('button',{name:'케어릿 AI 닫기'}).click();
    await mobile.locator('#journal-raw').waitFor({state:'visible'});
    await mobile.waitForFunction(()=>document.querySelector('#journal-raw')?.value==='오늘 산책했어요.');
    await mobile.close();
    console.log('AI conversation polish, review and conflict protection: passed');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
