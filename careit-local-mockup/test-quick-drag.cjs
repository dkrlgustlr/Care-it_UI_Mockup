const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const url = pathToFileURL(path.join(__dirname, 'careit-mockup.html')).href + '#/settings/configuration?recipient=0&template=1';
  try {
    for (const mode of ['mouse', 'touch']) {
      const context = await browser.newContext({ viewport: { width: mode === 'mouse' ? 1280 : 390, height: 900 }, hasTouch: mode === 'touch', isMobile: mode === 'touch' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      const cards = page.locator('[data-quick-order]'), first = cards.first(), second = cards.nth(1);
      const name = await first.locator('header strong').innerText();
      await first.locator('.configuration-drag-handle').scrollIntoViewIfNeeded();
      const start = await first.locator('.configuration-drag-handle').boundingBox(), target = await second.boundingBox();
      let cdp;
      if (mode === 'mouse') {
        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
        await page.mouse.down();
        await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 6 });
      } else {
        cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x + start.width / 2, y: start.y + start.height / 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2 }] });
      }
      const moving = page.locator('.configuration-drag-moving');
      assert.equal(await moving.count(), 1);
      assert.equal(await moving.getAttribute('data-quick-order'), '0');
      assert.equal(await first.evaluate(el => getComputedStyle(el).opacity), '1');
      assert.equal(await page.locator('.configuration-drag-placeholder').count(), 1);
      assert.equal(await page.locator('.configuration-drag-placeholder').evaluate(el => getComputedStyle(el).order), '1');
      assert.equal(await second.evaluate(el => getComputedStyle(el).order), '0');
      assert.equal(await page.locator('.configuration-drag-ghost').count(), 0);
      assert.equal(await cards.count(), await page.locator('.configuration-card:not(.configuration-drag-ghost)').count());
      if (mode === 'mouse') await page.mouse.up();
      else await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const dialog = page.locator('#mockup-dialog');
      assert.match(await dialog.innerText(), /퀵체크 순서를 바꿀까요/);
      await dialog.getByRole('button', { name: '변경', exact: true }).click();
      await page.waitForFunction(expected => document.querySelectorAll('[data-quick-order]')[1]?.querySelector('header strong')?.textContent === expected, name);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${mode}: actual quick-check moves, with saved order passed`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
