const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(pathToFileURL(path.join(__dirname, 'careit-mockup.html')).href + '#/iep');
    await page.getByRole('button', { name: '학기', exact: true }).click();
    await page.getByRole('option', { name: '1학기', exact: true }).click();
    await page.locator('[data-iew-id="current"]').click();
    await page.getByLabel('강점', { exact: true }).fill('다른 학기 보존');
    await page.locator('[data-iew-action="save"]').click();
    await page.getByRole('button', { name: '학기', exact: true }).click();
    await page.getByRole('option', { name: '2학기', exact: true }).click();
    await page.locator('[data-iew-id="current"]').click();
    await page.getByLabel('강점', { exact: true }).fill('초기화할 내용');
    await page.getByRole('button', { name: '양식 편집', exact: true }).click();
    await page.getByRole('button', { name: '단계 추가', exact: true }).click();
    await page.locator('#iew-new-step-name').fill('테스트 단계');
    await page.locator('#mockup-dialog').getByRole('button', { name: '추가', exact: true }).click();
    const reset = page.getByRole('button', { name: 'IEP 초기화', exact: true }), dialog = page.locator('#mockup-dialog');
    await reset.click();
    assert.match(await dialog.innerText(), /작성한 내용과 연결한 리포트/);
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(await page.locator('.iew-tabs [data-iew-action="section"]').count(), 9);
    await reset.click();
    await dialog.getByRole('button', { name: '초기화', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.iew-tabs [data-iew-action="section"]').length === 8);
    await page.locator('[data-iew-id="current"]').click();
    assert.equal(await page.getByLabel('강점', { exact: true }).inputValue(), '');
    assert.equal(await page.locator('.iew-domain').count(), 5);
    await page.reload();
    assert.equal(await page.locator('.iew-tabs [data-iew-action="section"]').count(), 8);
    await page.getByRole('button', { name: '학기', exact: true }).click();
    await page.getByRole('option', { name: '1학기', exact: true }).click();
    await page.locator('[data-iew-id="current"]').click();
    assert.equal(await page.getByLabel('강점', { exact: true }).inputValue(), '다른 학기 보존');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await reset.isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('IEP reset cancellation, defaults, persistence and other-term isolation passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
