const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  const base = pathToFileURL(path.join(__dirname,'careit-mockup.html')).href;
  for (const [label,viewport] of [['desktop',{width:1280,height:720}],['mobile',{width:390,height:844}]]) {
    const page = await browser.newPage({ viewport, reducedMotion:'reduce' });
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'#/settings/configuration?recipient=0&template=1');
    await page.locator('[data-action="edit-quick-check"]').first().click();
    const type = page.locator('#quick-dialog [data-options="quick-type"]');
    const initial = await type.innerText();
    await type.click();
    assert.equal(await page.locator('#quick-type-picker .quick-check-type-card').count(),6);
    const rect = await page.locator('#quick-type-picker').boundingBox();
    assert.ok(rect.width < viewport.width && rect.height < viewport.height);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
    await page.locator('#quick-type-picker label').filter({has:page.locator('input[name="quick-type-choice"][value="숫자"]')}).click();
    await page.locator('#quick-type-picker .quick-check-type-footer [data-action="quick-type-cancel"]').click();
    assert.equal(await type.innerText(),initial);
    await type.click();
    await page.locator('#quick-type-picker label').filter({has:page.locator('input[name="quick-type-choice"][value="숫자"]')}).click();
    await page.locator('#quick-type-picker [data-action="quick-type-save"]').click();
    assert.match(await page.locator('#mockup-dialog').innerText(),/이미 쓴 일지의 값은 그대로/);
    await page.locator('#mockup-dialog [data-action="close-dialog"]').click();
    assert.equal(await type.innerText(),initial);
    await type.click();
    await page.locator('#quick-type-picker label').filter({has:page.locator('input[name="quick-type-choice"][value="숫자"]')}).click();
    await page.locator('#quick-type-picker [data-action="quick-type-save"]').click();
    await page.locator('#mockup-dialog [data-action="confirm-dialog"]').click();
    assert.equal(await page.locator('#quick-dialog [data-options="quick-type"]').innerText(),'숫자');
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(label+' picker selection, cancel and confirmation passed');
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
