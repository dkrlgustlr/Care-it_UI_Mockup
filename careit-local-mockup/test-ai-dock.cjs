const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const url=pathToFileURL(path.join(__dirname,'careit-mockup.html')).href;
  const open=async(viewport,route='#/journals/new?recipient=0')=>{
    const page=await browser.newPage({viewport});page.setDefaultTimeout(8000);
    page.on('pageerror',error=>console.error('PAGE ERROR',error.message));
    await page.goto(url+(viewport.width<768?'?previewMode=app':'')+route);
    return page;
  };
  const paid=page=>page.evaluate(async()=>{const bridge=window.__careitAiBridge;bridge.state.subscription={plan:'starter',nextBillingOn:'2099.01.01',autoRenew:true};bridge.state.aiConsent=true;await bridge.store.save(JSON.stringify(bridge.state));});
  const send=async(page,text)=>{await page.locator('#ai-chat-input').fill(text);await page.locator('#ai-chat-input').press('Enter');};
  try{
    const page=await open({width:1920,height:900});await paid(page);
    const journal=page.locator('#journal-raw');await journal.fill('오늘  함께 놀았어요.');
    await page.evaluate(()=>window.originalJournalNode=document.querySelector('#journal-raw'));
    await page.locator('.sidebar [data-action="ai-toggle"]').click();
    assert.equal(await page.locator('#ai-dock').isVisible(),true);
    assert.equal(await page.evaluate(()=>window.originalJournalNode===document.querySelector('#journal-raw')),true);
    assert.equal(await journal.inputValue(),'오늘  함께 놀았어요.');
    assert.equal(await page.locator('iframe').count(),0);
    const handle=page.locator('.ai-dock-resizer');await handle.focus();await handle.press('Home');
    assert.equal(Math.round((await page.locator('#ai-dock').boundingBox()).width),320);
    await handle.press('ArrowRight');assert.equal(Math.round((await page.locator('#ai-dock').boundingBox()).width),336);
    const pos=await handle.boundingBox();await page.mouse.move(pos.x+pos.width/2,pos.y+pos.height/2);await page.mouse.down();await page.mouse.move(pos.x+pos.width/2+60,pos.y+pos.height/2);await page.mouse.up();
    assert.ok((await page.locator('#ai-dock').boundingBox()).width>=390);
    await handle.press('End');
    assert.equal(Math.round((await page.locator('#main-content').boundingBox()).width),988);
    await page.setViewportSize({width:1440,height:900});
    await handle.waitFor({state:'hidden'});
    assert.ok((await page.locator('#main-content').boundingBox()).width>=988);
    await page.setViewportSize({width:1920,height:900});await handle.waitFor();
    await send(page,'문장 정리해줘');await page.getByText(/공백만 정리한 예시/).waitFor();
    await page.getByRole('button',{name:'변경 내용 적용',exact:true}).click();
    assert.equal(await journal.inputValue(),'오늘 함께 놀았어요.');
    await page.locator('[data-action="ai-close"]').click();assert.equal(await page.locator('#ai-dock').isHidden(),true);
    assert.equal(await journal.inputValue(),'오늘 함께 놀았어요.');
    await page.locator('.sidebar [data-action="ai-toggle"]').click();
    assert.equal(await page.evaluate(()=>window.originalJournalNode===document.querySelector('#journal-raw')),true);
    await send(page,'기록탭 열어봐');await page.locator('#mockup-dialog[open]').waitFor();
    await page.locator('#mockup-dialog [data-action="close-dialog"]').click();assert.equal(await journal.inputValue(),'오늘 함께 놀았어요.');
    await page.close();

    const create=await open({width:1920,height:900},'#/ai-chat');
    assert.equal(await create.locator('#ai-dock').isVisible(),true);
    await send(create,'리포트 채점 기준 만들어줘');await create.getByText(/어떤 상황이나 영역/).waitFor();
    await send(create,'자유 놀이에서 의사소통');await create.locator('#score-edit-form').waitFor();
    await create.getByText(/고정된 예시 문항/).waitFor();
    assert.equal(await create.locator('#score-template-title').inputValue(),'놀이 관찰 기준');
    assert.equal(await create.locator('iframe').count(),0);
    await send(create,'“의사소통”을 “의사 표현”으로 바꿔줘');
    await create.getByText(/리포트 기준 초안에 반영/).waitFor();
    assert.equal(await create.locator('#score-domain-title-0').inputValue(),'의사 표현');
    await create.locator('#score-edit-form button[type="submit"]:visible').click();
    await create.waitForFunction(()=>window.__careitAiBridge.state.customReportTemplates?.length===1);
    assert.equal(await create.evaluate(()=>window.__careitAiBridge.state.customReportTemplates[0].domains[0].name),'의사 표현');
    await send(create,'기록탭 열어봐');await create.locator('.records-page').waitFor();
    assert.equal(await create.locator('#ai-dock').isVisible(),true);
    await create.close();

    const restored=await open({width:1920,height:900},'#/journals/new?recipient=2&entry=0');
    await restored.locator('#journal-raw').waitFor();
    await restored.evaluate(async()=>{
      const bridge=window.__careitAiBridge,s=bridge.state,screen=document.querySelector('#screen');
      const values=Object.fromEntries([...screen.querySelectorAll('input[id],textarea[id]')].map(el=>[el.id,(el.type==='radio'||el.type==='checkbox')?el.checked:el.value]));
      const base=JSON.stringify({date:document.querySelector('[data-action="date"]').dataset.value,values:Object.fromEntries(Object.entries(values).filter(([id])=>!id.startsWith('journal-field-label-')))});
      values['journal-raw']='이전 AI 화면에서 작성한 내용';
      s.aiChatDemo.editDrafts={[JSON.stringify(['journal',2,'','',0])]:{values,base,date:document.querySelector('[data-action="date"]').dataset.value}};
      await bridge.store.save(JSON.stringify(s));
    });
    await restored.reload();
    assert.equal(await restored.locator('#journal-raw').inputValue(),'이전 AI 화면에서 작성한 내용');
    await restored.locator('[data-action="save-journal"]').click();
    await restored.waitForFunction(()=>!Object.keys(window.__careitAiBridge.state.aiChatDemo.editDrafts||{}).length);
    await restored.evaluate(async()=>{const bridge=window.__careitAiBridge,s=bridge.state;s.aiPanelOpen=true;s.aiChatDemo.editDrafts={[JSON.stringify(['journal',2,'','',0])]:{values:{'journal-raw':'충돌한 이전 작성 내용'},base:'이전 저장 상태'}};await bridge.store.save(JSON.stringify(s));});
    await restored.reload();
    await restored.getByText(/저장된 일지가 바뀌어 이전 수정 내용을 자동 적용하지 않았어요/).waitFor();
    assert.notEqual(await restored.locator('#journal-raw').inputValue(),'충돌한 이전 작성 내용');
    await restored.getByRole('button',{name:'이전 작성 내용 보기'}).click();
    await restored.getByText(/충돌한 이전 작성 내용/).waitFor();
    await restored.close();

    const mobile=await open({width:390,height:844});await paid(mobile);
    const mobileJournal=mobile.locator('#journal-raw');await mobileJournal.fill('오늘  산책했어요.');
    await mobile.locator('.ai-dock-launcher').click();assert.equal(await mobile.locator('#ai-dock').isVisible(),true);
    await send(mobile,'문장 정리해줘');await mobile.getByText(/공백만 정리한 예시/).waitFor();
    await mobile.getByRole('button',{name:'변경 내용 적용',exact:true}).click();
    await mobile.locator('[data-action="ai-close"]').click();
    assert.equal(await mobileJournal.inputValue(),'오늘 산책했어요.');
    assert.equal(await mobile.locator('iframe').count(),0);
    await mobile.close();
    console.log('AI dock, resizing, journal context, templates and mobile: passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
