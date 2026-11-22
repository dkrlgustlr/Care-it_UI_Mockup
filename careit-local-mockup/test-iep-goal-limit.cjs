const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1920,height:900},reducedMotion:'reduce'});
  const url=pathToFileURL(path.join(__dirname,'careit-mockup.html')).href;
  const positions=()=>page.evaluate(()=>Object.fromEntries(['.sidebar','#ai-dock','main'].map(selector=>{
    const rect=document.querySelector(selector).getBoundingClientRect();return [selector,{x:rect.x,width:rect.width}];
  })));
  const checkPositions=(before,after)=>{for(const key of Object.keys(before)){assert.ok(Math.abs(before[key].x-after[key].x)<1,`${key} moved`);assert.ok(Math.abs(before[key].width-after[key].width)<1,`${key} resized`);}};
  try{
    await page.goto(url+'#/iep');
    await page.locator('[data-iew-id="plan"]').click();
    await page.locator('.sidebar [data-action="ai-toggle"]').click();
    for(let i=1;i<10;i++){
      await page.locator('#iew-goal-text').fill(`단기목표 ${i}: 그림과 놀이를 활용한 도움 요청 활동`);
      await page.locator('[data-iew-action="add-goal"]').click();
    }
    assert.equal(await page.locator('.iew-goal-tab').count(),10);
    assert.equal(await page.locator('[data-iew-action="add-goal"]').isDisabled(),true);
    assert.match(await page.locator('[data-iew-action="add-goal"]').innerText(),/10\/10/);
    const tabBox=await page.locator('.iew-goal-tab.active').boundingBox(),barBox=await page.locator('.iew-goals').boundingBox();
    assert.ok(tabBox.x>=barBox.x-1&&tabBox.x+tabBox.width<=barBox.x+barBox.width+1,'active goal should remain visible');
    const nextId=await page.locator('.iew-goal-tab').nth(8).getAttribute('data-iew-id');
    const before=await positions();
    await page.locator('[data-iew-action="remove-goal"]').click();
    await page.locator('#mockup-dialog[open]').waitFor();
    checkPositions(before,await positions());
    await page.locator('#mockup-dialog [data-action="close-dialog"]').click();
    assert.equal(await page.locator('.iew-goal-tab').count(),10);
    await page.locator('[data-iew-action="remove-goal"]').click();
    await page.locator('#mockup-dialog [data-action="confirm-dialog"]').click();
    assert.equal(await page.locator('.iew-goal-tab').count(),9);
    assert.equal(await page.locator('.iew-goal-tab.active').getAttribute('data-iew-id'),nextId);
    assert.equal(await page.locator('[data-iew-action="add-goal"]').isEnabled(),true);

    await page.evaluate(async()=>{
      const bridge=window.__careitAiBridge,plan=bridge.state.iep.semesterPlans.find(item=>item.recipient===0),domain=plan.domains[0];
      for(let i=0;i<3;i++)domain.goals.push({...structuredClone(domain.goals[0]),id:crypto.randomUUID(),text:`기존 목표 ${i}`,months:{},observations:[]});
      await bridge.store.save(JSON.stringify(bridge.state));
    });
    await page.reload();
    await page.locator('[data-iew-id="plan"]').click();
    assert.equal(await page.locator('.iew-goal-tab').count(),12);
    assert.equal(await page.locator('[data-iew-action="add-goal"]').isDisabled(),true);
    assert.match(await page.locator('[data-iew-action="add-goal"]').innerText(),/12\/10/);
    await page.locator('.nav-handle').click();
    const compactBefore=await positions();
    await page.locator('[data-iew-action="remove-goal"]').click();
    await page.locator('#mockup-dialog[open]').waitFor();
    checkPositions(compactBefore,await positions());
    await page.locator('#mockup-dialog [data-action="close-dialog"]').click();
    assert.equal(await page.locator('.iew-goal-tab').count(),12);
    console.log('Goal limit, preserved excess goals, selection and modal layout: passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
