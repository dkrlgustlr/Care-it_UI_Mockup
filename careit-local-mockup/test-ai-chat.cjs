const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const http = require('node:http');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const base = pathToFileURL(path.join(__dirname, 'careit-mockup.html')).href;
  async function open(viewport = { width: 390, height: 844 }) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    page.setDefaultTimeout(8000);
    await page.goto(base + (viewport.width < 768 ? '?previewMode=app' : '') + '#/ai-chat');
    await page.getByRole('heading', { name: '무엇을 도와드릴까요?' }).waitFor();
    return page;
  }
  async function send(page, text) {
    await page.getByRole('textbox', { name: '메시지' }).fill(text);
    await page.getByRole('textbox', { name: '메시지' }).press('Enter');
  }
  try {
    const page = await open();
    assert.equal(await page.locator('.app-bottom-nav a, .app-bottom-nav button').count(), 5);
    await page.getByRole('button', { name: '오늘 일지 작성 도와줘' }).click();
    await page.getByRole('button', { name: '전수테스트', exact: true }).click();
    await page.getByText(/활동이나 모습을 알려주세요/).waitFor();
    await page.screenshot({ path: path.join(__dirname, '_qa', 'ai-chat-mobile.png') });
    await send(page, '블록 놀이를 했어요. 친구와 함께 쌓았어요.');
    const journal = page.frameLocator('iframe[data-kind="journal"]');
    await journal.locator('#journal-raw').waitFor();
    assert.equal(await page.locator('[data-ai-resize]').isVisible(), false);
    await journal.locator('#journal-raw').waitFor({ state: 'visible' });
    await page.frame({ url: /aiEmbed=journal/ }).waitForFunction(() => document.querySelector('#journal-raw')?.value.includes('친구와 함께'));
    await page.getByRole('button', { name: '대화로 돌아가기' }).click();
    await send(page, '짧게 바꿔줘');
    await page.getByRole('button', { name: '변경 내용 적용' }).waitFor();
    assert.equal(await journal.locator('#journal-raw').inputValue(), '블록 놀이를 했어요. 친구와 함께 쌓았어요.');
    await page.getByRole('button', { name: '변경 내용 적용' }).click();
    await journal.locator('#journal-raw').waitFor({ state: 'visible' });
    await page.frame({ url: /aiEmbed=journal/ }).waitForFunction(() => document.querySelector('#journal-raw')?.value === '블록 놀이를 했어요.');
    assert.equal(await journal.locator('#journal-raw').inputValue(), '블록 놀이를 했어요.');
    await journal.locator('[data-action="save-journal"]').click();
    await page.getByText(/일지를 저장했어요/).waitFor({ state: 'attached' });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('careit-ui-mockup-20260923-v1')).savedJournals);
    assert.ok(saved.some(row => row.recipient === 2 && row.text.includes('블록 놀이를 했어요.')));
    await page.getByRole('button', { name: '대화로 돌아가기' }).click();
    await page.getByRole('link', { name: '저장한 기록 보기' }).click();
    await page.locator('.records-page').waitFor();
    assert.match(await page.locator('.records-page').innerText(), /블록 놀이를 했어요/);
    await page.goto(base + '?previewMode=app#/ai-chat');
    assert.match(await page.locator('.ai-chat-messages').innerText(), /블록 놀이를 했어요/);
    await page.close();

    const reportPage = await open({ width: 1440, height: 900 });
    await send(reportPage, '지난주 리포트 확인해줘');
    await reportPage.getByRole('button', { name: '전수테스트', exact: true }).click();
    await reportPage.getByRole('button', { name: '기존 리포트 보기' }).waitFor();
    await reportPage.getByRole('button', { name: '새로 생성하기' }).click();
    await reportPage.getByRole('button', { name: '리포트 생성', exact: true }).click();
    const report = reportPage.frameLocator('iframe[data-kind="report"]');
    await report.locator('.configured-report').waitFor();
    await reportPage.screenshot({ path: path.join(__dirname, '_qa', 'ai-chat-report.png') });
    const chatBox = await reportPage.locator('.ai-chat-main').boundingBox();
    const previewBox = await reportPage.locator('.ai-chat-preview').boundingBox();
    assert.ok(chatBox.x + chatBox.width <= previewBox.x);
    const handle = reportPage.getByRole('separator', { name: '대화창 너비 조절' });
    await handle.waitFor();
    const workspace = await reportPage.locator('.ai-chat-workspace').boundingBox();
    const initialHandle = await handle.boundingBox();
    await reportPage.mouse.move(initialHandle.x + initialHandle.width / 2, initialHandle.y + initialHandle.height / 2);
    await reportPage.mouse.down();
    await reportPage.mouse.move(workspace.x + 10, initialHandle.y + initialHandle.height / 2, { steps: 6 });
    await reportPage.mouse.up();
    assert.equal(Math.round((await reportPage.locator('.ai-chat-main').boundingBox()).width), 320);
    await handle.focus();
    await handle.press('ArrowRight');
    assert.equal(Math.round((await reportPage.locator('.ai-chat-main').boundingBox()).width), 336);
    await handle.press('End');
    assert.ok((await reportPage.locator('.ai-chat-preview').boundingBox()).width >= 360);
    await handle.press('Home');
    await reportPage.waitForFunction(() => JSON.parse(localStorage.getItem('careit-ui-mockup-20260923-v1')).aiChatDemo.chatWidth === 320);
    await reportPage.reload();
    await handle.waitFor();
    assert.equal(Math.round((await reportPage.locator('.ai-chat-main').boundingBox()).width), 320);
    await reportPage.setViewportSize({ width:768, height:900 });
    await reportPage.waitForFunction(() => window.innerWidth === 768 && document.querySelector('[data-ai-resize]')?.getAttribute('aria-valuenow') === '320');
    assert.ok((await reportPage.locator('.ai-chat-preview').boundingBox()).width >= 360);
    await reportPage.setViewportSize({ width:767, height:900 });
    await handle.waitFor({ state:'hidden' });
    assert.equal(Math.round((await reportPage.locator('.ai-chat-preview').boundingBox()).width), 767);
    const generated = await reportPage.evaluate(() => JSON.parse(localStorage.getItem('careit-ui-mockup-20260923-v1')).generatedReports);
    assert.ok(generated.some(row => row.recipient === 2));
    await reportPage.close();

    const insufficient = await open();
    await send(insufficient, '지난주 리포트 만들어줘');
    await insufficient.getByRole('button', { name: '그림책 샘플', exact: true }).click();
    await insufficient.getByText(/3일 이상 필요해요/).waitFor();
    await insufficient.getByRole('button', { name: '일지 작성하기' }).waitFor();
    await insufficient.close();

    const attachments = await open();
    await attachments.locator('#ai-chat-files').setInputFiles([
      { name: '사진.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') },
      { name: '문서.pdf', mimeType: 'application/pdf', buffer: Buffer.from('demo') },
    ]);
    assert.equal(await attachments.locator('.ai-chat-attachment img').count(), 1);
    await attachments.getByRole('button', { name: '문서.pdf 첨부 취소' }).click();
    await attachments.getByRole('button', { name: '메시지 보내기' }).click();
    await attachments.getByText(/파일 내용을 읽을 수 없어요/).waitFor();
    assert.match(await attachments.locator('.ai-chat-messages').innerText(), /사진.png/);
    assert.equal(await attachments.locator('.ai-chat-message.user img').count(), 1);
    await attachments.reload();
    assert.match(await attachments.locator('.ai-chat-messages').innerText(), /사진.png/);
    await attachments.close();

    const actions = await open();
    await send(actions, '일지 템플릿 이름 수정해줘');
    await actions.getByRole('button', { name: '일지 템플릿 2', exact: true }).click();
    await send(actions, '우리반 템플릿');
    await actions.getByRole('button', { name: '변경하기', exact: true }).click();
    await actions.getByText(/템플릿 이름을.*바꿨어요/).waitFor();
    assert.equal(await actions.evaluate(() => window.__careitAiBridge.state.journalTemplates[1].name), '우리반 템플릿');
    await send(actions, '전수테스트 일지 삭제해줘');
    await actions.getByText('어떤 일지를 휴지통으로 옮길까요?').waitFor();
    await actions.locator('.ai-chat-message.assistant').last().locator('.ai-chat-choice').first().click();
    await actions.getByRole('button', { name: '휴지통으로 이동' }).click();
    await actions.getByText(/일지를 휴지통으로 옮겼어요/).waitFor();
    assert.ok(await actions.evaluate(() => window.__careitAiBridge.state.trash.some(item => item.type === 'journal' && item.recipient === 2)));
    await send(actions, '요금제 차이 알려줘');
    await actions.getByRole('link', { name: '요금제 보기' }).waitFor();
    await send(actions, '리포트 템플릿 수정해줘');
    const templateLink = actions.getByRole('link', { name: '템플릿 관리 열기' });
    await templateLink.waitFor();
    assert.equal(await templateLink.getAttribute('href'), '#/recipients?tab=report');
    await actions.close();

    const add = await open();
    await add.evaluate(async () => { const bridge=window.__careitAiBridge;bridge.state.recipients[4].active=false;await bridge.store.save(JSON.stringify(bridge.state)); });
    await send(add, '새 관리대상 추가해줘');
    await add.getByText('추가할 관리대상의 이름을 알려주세요.').waitFor();
    await send(add, '별빛 샘플');
    await add.getByRole('button', { name: '추가하기', exact: true }).waitFor();
    await send(add, '네');
    await add.getByText('별빛 샘플 관리대상을 추가했어요.').waitFor();
    assert.ok(await add.evaluate(() => window.__careitAiBridge.state.recipients.some(person => person.name === '별빛 샘플')));
    await add.close();

    const cancelled = await open();
    await send(cancelled, '오늘 일지 작성 도와줘');
    await cancelled.getByRole('button', { name: '중단', exact: true }).click();
    await cancelled.getByText(/요청을 중단했어요/).waitFor();
    await cancelled.getByRole('button', { name: '다시 시도' }).click();
    await cancelled.getByRole('button', { name: '그림책 샘플', exact: true }).waitFor();
    await cancelled.close();

    const conflict = await open({ width: 1440, height: 900 });
    await send(conflict, '전수테스트 오늘 일지 작성해줘');
    await conflict.getByText(/활동이나 모습을 알려주세요/).waitFor();
    await send(conflict, '처음 내용이에요. 두 번째 문장이에요.');
    const conflictJournal = conflict.frameLocator('iframe[data-kind="journal"]');
    await conflictJournal.locator('#journal-raw').waitFor();
    await conflict.frame({ url: /aiEmbed=journal/ }).waitForFunction(() => document.querySelector('#journal-raw')?.value.includes('두 번째'));
    await send(conflict, '짧게 바꿔줘');
    await conflict.getByRole('button', { name: '변경 내용 적용' }).waitFor();
    await conflictJournal.locator('#journal-raw').fill('직접 고친 내용');
    await conflict.getByRole('button', { name: '변경 내용 적용' }).click();
    await conflict.getByText(/그동안 일지 내용이 바뀌었어요/).waitFor();
    assert.equal(await conflictJournal.locator('#journal-raw').inputValue(), '직접 고친 내용');
    await conflict.close();

    const resume = await open();
    await send(resume, '전수테스트 일지 찾아줘');
    await resume.getByText('일지를 골라 주세요.').waitFor();
    await resume.locator('.ai-chat-message.assistant').last().locator('.ai-chat-choice').first().click();
    const savedJournal = resume.frameLocator('iframe[data-kind="journal"]');
    await savedJournal.locator('#journal-raw').fill('저장 전 고친 내용');
    await resume.waitForFunction(() => Object.keys(window.__careitAiBridge.state.aiChatDemo.editDrafts || {}).length > 0);
    await resume.getByRole('button', { name: '대화로 돌아가기' }).click();
    await resume.goto(base + '?previewMode=app#/records');
    await resume.goto(base + '?previewMode=app#/ai-chat');
    await resume.getByRole('button', { name: '일지 보기', exact: true }).last().click();
    const restoredJournal = resume.frameLocator('iframe[data-kind="journal"]');
    await restoredJournal.locator('#journal-raw').waitFor();
    await resume.frame({ url: /aiEmbed=journal/ }).waitForFunction(() => document.querySelector('#journal-raw')?.value === '저장 전 고친 내용');
    await resume.getByRole('button', { name: '대화로 돌아가기' }).click();
    await resume.goto(base + '?previewMode=app#/records');
    await resume.evaluate(async () => { const bridge=window.__careitAiBridge,chat=bridge.state.aiChatDemo,draft=Object.values(chat.editDrafts)[0];bridge.state.savedJournals.unshift({recipient:2,date:draft.date,text:'다른 곳에서 저장한 내용',values:{'journal-raw':'다른 곳에서 저장한 내용'}});await bridge.store.save(JSON.stringify(bridge.state)); });
    await resume.goto(base + '?previewMode=app#/ai-chat');
    await resume.getByRole('button', { name: '일지 보기', exact: true }).last().click();
    await resume.getByText(/저장된 일지가 바뀌어 이전 수정 내용을 자동 적용하지 않았어요/).waitFor({ state:'attached' });
    assert.equal(await resume.frameLocator('iframe[data-kind="journal"]').locator('#journal-raw').inputValue(), '다른 곳에서 저장한 내용');
    await resume.getByRole('button', { name: '대화로 돌아가기' }).click();
    await resume.getByRole('button', { name: '이전 작성 내용 보기' }).click();
    await resume.getByText(/저장 전 고친 내용/).waitFor();
    await resume.close();

    const server = http.createServer((req, res) => {
      if (new URL(req.url, 'http://localhost').pathname !== '/careit-mockup.html') { res.writeHead(404);res.end();return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(path.join(__dirname, 'careit-mockup.html')).pipe(res);
    });
    await new Promise((resolve, reject) => { server.once('error', reject);server.listen(0, '127.0.0.1', resolve); });
    try {
      const local = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      local.setDefaultTimeout(8000);
      await local.goto(`http://127.0.0.1:${server.address().port}/careit-mockup.html#/ai-chat`);
      await send(local, '전수테스트 일지 작성해줘');
      await local.getByText(/활동이나 모습을 알려주세요/).waitFor();
      await send(local, '로컬 서버에서 블록 놀이를 했어요.');
      const localFrame = local.frameLocator('iframe[data-kind="journal"]');
      await localFrame.locator('#journal-raw').waitFor();
      await local.frame({ url: /aiEmbed=journal/ }).waitForFunction(() => document.querySelector('#journal-raw')?.value.includes('로컬 서버에서'));
      await send(local, '저장해줘');
      await local.getByText(/일지를 저장했어요/).waitFor();
      assert.ok(await local.evaluate(() => window.__careitAiBridge.state.savedJournals.some(row => row.text.includes('로컬 서버에서'))));
      await localFrame.locator('[data-options="recipients"]').click();
      await localFrame.getByRole('option', { name: '음악 샘플', exact: true }).click();
      await local.waitForFunction(() => window.__careitAiBridge.state.aiChatDemo.flow?.recipient === 4);
      assert.equal(await local.evaluate(() => window.__careitAiBridge.state.aiChatDemo.preview.recipient), 4);
      await local.close();
    } finally { await new Promise(resolve => server.close(resolve)); }
    console.log('AI chat journal, report, records, settings, attachments and continuity passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
