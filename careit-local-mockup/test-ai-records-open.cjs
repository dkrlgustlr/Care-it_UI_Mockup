const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const url = pathToFileURL(path.join(__dirname,'careit-mockup.html')).href;
  try {
    for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      const page = await browser.newPage({viewport});
      page.setDefaultTimeout(8000);
      const send = async text => {await page.locator('#ai-chat-input').fill(text);await page.locator('#ai-chat-input').press('Enter');};
      await page.goto(url+(viewport.width<768?'?previewMode=app':'')+'#/ai-chat');
      await send('리포트 채점 기준 편집해줘');
      await page.locator('[data-action="ai-chat-choice"]').first().click();
      const scoring=page;
      await scoring.locator('#score-edit-form').waitFor();
      await send('기록탭 열어봐');
      await page.getByText('기록 화면을 열었어요.',{exact:true}).waitFor();
      const records=page;
      await records.locator('.records-page').waitFor({state:'visible'});
      assert.equal(await records.locator('[data-options="record-types"] span').innerText(),'일지');
      assert.equal(await page.title(),'기록 · 케어릿');
      await page.close();
    }
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    page.setDefaultTimeout(8000);
    await page.goto(url+'#/ai-chat');
    await page.locator('#ai-chat-input').fill('리포트 채점 기준 편집해줘');
    await page.locator('#ai-chat-input').press('Enter');
    await page.locator('[data-action="ai-chat-choice"]').first().click();
    const scoring=page;
    const question=scoring.locator('.score-area-panel:not([hidden]) textarea').first();
    await question.fill('변경 중인 문항');
    await page.locator('#ai-chat-input').fill('기록탭 열어봐');
    await page.locator('#ai-chat-input').press('Enter');
    await page.locator('#mockup-dialog[open]').waitFor();
    assert.equal(await question.inputValue(),'변경 중인 문항');
    assert.equal(await page.locator('.records-page').count(),0);
    await page.close();
    console.log('AI records navigation and unsaved template protection: passed');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
