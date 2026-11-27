const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();
 try{
  await page.goto(pathToFileURL(path.join(__dirname,'careit-mockup.html')).href+'#/iep');
  await page.evaluate(async()=>{
   const b=window.__careitAiBridge;
   b.state.aiPanelOpen=true;
   b.state.aiChatDemo.messages=[{role:'assistant',text:'먼저 확인해 주세요.\n\n1. **평가 방법:** 관찰\n2. **평가 기준:** 기록\n\n<script>window.bad=true</script>'}];
   await b.store.save(JSON.stringify(b.state));
  });
  await page.reload();
  const answer=page.locator('.ai-chat-answer');
  assert.equal(await answer.locator('ol li').count(),2);
  assert.equal(await answer.locator('li strong').first().innerText(),'평가 방법:');
  assert.equal(await answer.locator('script').count(),0);
  assert.equal(await page.evaluate(()=>window.bad),undefined);
  assert((await answer.innerText()).includes('<script>'));
  console.log('AI chat formatting and escaping passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
