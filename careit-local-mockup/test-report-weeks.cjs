// Run: node test-report-weeks.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'mockup.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('(() => {')), context);
const week = (date, offset=0) => context.mockupReportWeek(date, offset);
const eligibility = (range, today, days) => context.mockupReportEligibility(range, today, days);
const plain = value => JSON.parse(JSON.stringify(value));

for (const date of ['2026-10-09','2026-10-10','2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15']) {
  assert.deepEqual(plain(week(date)), {from:'2026-10-09',to:'2026-10-15'});
}
assert.deepEqual(plain(week('2026-10-14',-1)), {from:'2026-10-02',to:'2026-10-08'});
assert.deepEqual(plain(week('2026-10-16',-1)), {from:'2026-10-09',to:'2026-10-15'});
assert.deepEqual(plain(week('2026-10-01')), {from:'2026-09-25',to:'2026-10-01'});
assert.deepEqual(plain(week('2026-01-01')), {from:'2025-12-26',to:'2026-01-01'});
assert.equal(week('2026-02-30'), null);

assert.equal(eligibility(week('2026-10-14'),'2026-10-15').reason, 'future');
assert.equal(eligibility(week('2026-10-14'),'2026-10-16').allowed, true);
assert.equal(eligibility(week('2026-10-23'),'2026-10-14').reason, 'future');
assert.equal(eligibility(week('2026-09-11'),'2026-10-17').allowed, true);
assert.equal(eligibility(week('2026-09-11'),'2026-10-18').reason, 'expired');
assert.equal(eligibility(week('2026-09-04'),'2026-10-14').reason, 'expired');
assert.equal(eligibility(week('2019-01-31'),'2019-02-28').expiresOn, '2019-02-28');
assert.equal(eligibility(week('2019-01-31'),'2019-03-01').allowed, false);
assert.equal(eligibility(week('2036-01-31'),'2036-02-29').expiresOn, '2036-02-29');
assert.equal(eligibility(week('2036-01-31'),'2036-03-01').allowed, false);
assert.equal(eligibility({from:'2026-09-04',to:'2026-09-18'},'2026-10-14').reason, 'invalid');
assert.equal(eligibility({from:'2026-10-03',to:'2026-10-09'},'2026-10-14').reason, 'invalid');
assert.equal(eligibility({from:'',to:''},'2026-10-14').reason, 'empty');

// 모든 날짜가 자신의 주간과 같은 생성 가능 여부를 갖습니다. 일부 날짜만 선택 가능한 주간은 없습니다.
let availableDays=0;
for (let i=0;i<61;i++) {
  const date=new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10);
  const allowed=eligibility(week(date),'2026-10-14').allowed;
  assert.equal(allowed, date>='2026-09-11'&&date<='2026-10-08', date);
  if(allowed) availableDays++;
}
assert.equal(availableDays,28);
const recordWeek=week('2026-09-18');
const notice=(range,today,days)=>context.mockupReportNotice(eligibility(range,today,days),days);
assert.match(notice(recordWeek,'2026-10-14',0),/일지가 없어요/);
assert.match(notice(recordWeek,'2026-10-14',2),/2일 기록/);
assert.match(notice(recordWeek,'2026-10-14',3),/생성할 수 있어요/);
assert.match(notice(week('2026-09-04'),'2026-10-14',3),/기한이 지났어요/);
assert.match(notice(week('2026-10-14'),'2026-10-14',3),/10월 16일부터/);
for(const count of [0,2,3])assert.equal(notice(recordWeek,'2026-10-14',count).split('\n').length,2);
for(const count of [0,1,2])assert.equal(eligibility(recordWeek,'2026-10-14',count).reason,'insufficient');
for(const count of [3,7])assert.equal(eligibility(recordWeek,'2026-10-14',count).allowed,true);
assert.equal(eligibility(week('2026-10-14'),'2026-10-14',7).reason,'future');
assert.equal(eligibility(week('2026-09-04'),'2026-10-14',7).reason,'expired');
const rows=[['2026-09-17'],['2026-09-18'],['2026-09-18'],['2026-09-22'],['2026-09-25']];
assert.equal(context.mockupReportDays(recordWeek,rows),2,'Same-day duplicates and adjacent weeks must not meet the threshold');
rows.push(['2026-09-24']);
assert.equal(context.mockupReportDays(recordWeek,rows),3);
assert.equal(eligibility(recordWeek,'2026-10-14',context.mockupReportDays(recordWeek,rows)).allowed,true);
assert.equal(context.mockupReportDays({from:'',to:''},rows),0);
for(const today of ['2026-10-14','2026-10-16','2027-01-01','2028-03-02']){
  const samples=plain(context.mockupReportSampleJournals(today));
  assert.equal(samples.length,9);
  assert.equal(new Set(samples.map(x=>x.date)).size,9);
  [4,2,0,3].forEach((count,index)=>{
    const range=week(today,-index-1),days=context.mockupReportDays(range,samples.map(x=>[x.date]));
    assert.equal(days,count);
    assert.equal(eligibility(range,today,days).allowed,count>=3);
  });
  assert.ok(samples.every(x=>x.text.startsWith('[리포트 예시]')));
}
const october=plain(context.mockupReportCalendarDates(2026,9));
assert.equal(october[0],'2026-09-27');
assert.equal(october.at(-1),'2026-10-31');
assert.equal(october.length,35);
const january=plain(context.mockupReportCalendarDates(2026,0));
assert.equal(january[0],'2025-12-28');
assert.equal(january.at(-1),'2026-01-31');
for(const year of [2026,2028])for(let month=0;month<12;month++){
  const dates=plain(context.mockupReportCalendarDates(year,month));
  const first=new Date(`${dates[0]}T00:00:00Z`),last=new Date(`${dates.at(-1)}T00:00:00Z`);
  assert.equal(first.getUTCDay(),0);
  assert.equal(last.getUTCDay(),6);
  assert.equal(dates.length%7,0);
  assert.equal(new Set(dates).size,dates.length);
  assert.ok(dates.length<=42);
  assert.equal(dates.length,Math.ceil((new Date(Date.UTC(year,month,1)).getUTCDay()+new Date(Date.UTC(year,month+1,0)).getUTCDate())/7)*7,'Fill only existing month rows');
  assert.equal(dates.filter(date=>Number(date.slice(5,7))===month+1).length,new Date(Date.UTC(year,month+1,0)).getUTCDate());
  dates.forEach((date,i)=>assert.equal(date,new Date(first.getTime()+i*86400000).toISOString().slice(0,10)));
}
console.log('Report weeks passed: eligibility, record thresholds, samples and adjacent-month padding without extra rows.');
