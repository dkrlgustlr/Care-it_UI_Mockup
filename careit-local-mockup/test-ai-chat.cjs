const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const base = pathToFileURL(path.join(__dirname, 'careit-mockup.html')).href;
    await page.goto(base + '?previewMode=app#/ai-chat');
    await page.getByRole('heading', { name: '무엇을 도와드릴까요?' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.ai-chat-mark')?.naturalWidth > 0);
    assert.equal(await page.locator('.app-bottom-nav a, .app-bottom-nav button').count(), 5);
    await page.getByRole('button', { name: '오늘 일지 작성 도와줘' }).click();
    assert.match(await page.locator('.ai-chat-messages').innerText(), /예시 답변/);
    const journal = page.frameLocator('iframe[data-kind="journal"]');
    await journal.locator('.journal-page').waitFor();
    const parentState = await page.evaluate(() => localStorage.getItem('careit-ui-mockup-20260923-v1'));
    await journal.locator('#journal-raw').fill('직접 수정한 일지');
    await journal.locator('[data-action="save-journal"]').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('careit-ui-mockup-20260923-v1')), parentState);
    await page.getByRole('button', { name: '대화로 돌아가기' }).click();
    await page.getByRole('button', { name: '일지 보기' }).click();
    assert.equal(await journal.locator('#journal-raw').inputValue(), '직접 수정한 일지');
    await page.getByRole('button', { name: '대화로 돌아가기' }).click();
    assert.equal(await page.getByRole('button', { name: '새 대화' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '이전 대화' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '사진 및 파일 첨부' }).count(), 1);
    await page.locator('#ai-chat-files').setInputFiles([
      { name: '사진.png', mimeType: 'image/png', buffer: Buffer.from('demo') },
      { name: '문서.pdf', mimeType: 'application/pdf', buffer: Buffer.from('demo') },
    ]);
    assert.match(await page.locator('[data-ai-attachments]').innerText(), /사진.png/);
    await page.getByRole('button', { name: '문서.pdf 첨부 취소' }).click();
    assert.doesNotMatch(await page.locator('[data-ai-attachments]').innerText(), /문서.pdf/);
    await page.getByRole('textbox', { name: '메시지' }).fill('테스트 질문');
    await page.getByRole('textbox', { name: '메시지' }).press('Enter');
    assert.match(await page.locator('.ai-chat-messages').innerText(), /사진.png/);
    assert.equal(await page.locator('[data-ai-attachments]').isVisible(), false);
    await page.locator('#ai-chat-files').setInputFiles({ name: '첨부.txt', mimeType: 'text/plain', buffer: Buffer.from('demo') });
    await page.getByRole('button', { name: '메시지 보내기' }).click();
    assert.match(await page.locator('.ai-chat-messages').innerText(), /첨부.txt/);
    assert.match(await page.locator('.ai-chat-messages').innerText(), /실제 답변은 AI 연결 후 제공/);
    assert.match(await page.locator('.ai-chat-messages').innerText(), /일지 예시 화면을 열었어요/);
    const composer = await page.locator('.ai-chat-composer').boundingBox();
    const nav = await page.locator('.app-bottom-nav').boundingBox();
    assert.ok(composer.y + composer.height <= nav.y, '입력창이 하단 메뉴와 겹치지 않아야 해요');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + '#/ai-chat');
    assert.equal(await page.locator('.sidebar a[data-route="/ai-chat"]').getAttribute('aria-current'), 'page');
    await page.getByRole('button', { name: '이번 주 리포트 확인하고 싶어' }).click();
    const report = page.frameLocator('iframe[data-kind="report"]');
    await report.locator('.reports-page').waitFor();
    await report.locator('.configured-report').waitFor();
    const chat = await page.locator('.ai-chat-main').boundingBox();
    const preview = await page.locator('.ai-chat-preview').boundingBox();
    assert.ok(chat.x + chat.width <= preview.x, 'PC에서 미리보기가 대화 오른쪽에 있어야 해요');
    console.log('AI chat mockup navigation, conversation and layout passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
