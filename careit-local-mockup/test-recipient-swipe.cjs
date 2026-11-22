const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(5000);
  const client=await page.context().newCDPSession(page);
  const base=pathToFileURL(path.join(__dirname,'careit-mockup.html')).href;
  async function swipe(x,y,dx,dy){
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  async function selected(name){assert.equal(await page.locator(`[data-recipient-tab="${name}"]`).getAttribute('aria-pressed'),'true');}
  for(const query of ['','?previewMode=app']){
    await page.goto(base+query+'#/recipients');
    await selected('recipients');
    await swipe(320,300,-180,4);await selected('journal');
    await swipe(320,300,-180,2);await selected('report');
    await swipe(320,300,-180,2);await selected('report');
    await swipe(70,300,180,3);await selected('journal');
    await swipe(70,300,20,-140);await selected('journal');
    await page.locator('[data-recipient-tab="recipients"]').click();await selected('recipients');
    assert.equal(await page.locator('dialog[open]').count(),0);
  }
  await page.setViewportSize({width:1024,height:768});
  await swipe(320,300,-180,4);await selected('recipients');
  await browser.close();
  console.log('Mobile app and web tab swipes, vertical scrolling, boundaries and desktop passed');
})().catch(error=>{console.error(error);process.exit(1)});
