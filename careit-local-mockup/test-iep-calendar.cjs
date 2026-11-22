const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const url=pathToFileURL(path.join(__dirname,'careit-mockup.html')).href;
  try{
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
      page.setDefaultTimeout(8000);
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      const plan=()=>page.evaluate(()=>window.__careitAiBridge.state.iep.semesterPlans.find(item=>item.recipient===0));
      await page.goto(url+(width===390?'?previewMode=app':'')+'#/iep');
      await page.locator('[data-iew-id="assessment"]').click();
      assert.equal((await plan()).domains[0].goals[0].observations.length,0);
      assert.equal(await page.getByRole('button',{name:'관찰 날짜 (필수)'}).count(),0);
      await page.getByLabel('실제 행동',{exact:false}).first().fill('관찰 내용');
      await page.reload();
      await page.locator('[data-iew-id="assessment"]').click();
      assert.equal(await page.getByLabel('실제 행동',{exact:false}).first().inputValue(),'관찰 내용');
      await page.getByRole('button',{name:'관찰 추가'}).click();
      assert.equal(await page.getByRole('button',{name:'관찰 날짜 (필수)'}).count(),0);
      await page.locator('[data-iew-id="meeting"]').click();
      await page.getByRole('button',{name:'회의 날짜'}).click();
      const meetingDay=page.locator('.datefield-panel [data-date]:not(:disabled)').first(),meetingDate=await meetingDay.getAttribute('data-date');
      await meetingDay.click();
      assert.equal((await plan()).meeting.date,meetingDate);
      await page.reload();
      await page.locator('[data-iew-id="meeting"]').click();
      assert.match(await page.getByRole('button',{name:'회의 날짜'}).innerText(),new RegExp(`^${meetingDate.slice(0,4)}년`));
      await page.getByRole('button',{name:'회의 날짜'}).click();
      await page.locator('.datefield-today').click();
      assert.equal((await plan()).meeting.date,'');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('IEP observation without date, meeting calendar, persistence and mobile: passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
