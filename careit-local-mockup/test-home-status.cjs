// Run: node test-home-status.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('mockup.js','utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(0,source.indexOf('(() => {')),context);
const today='2026-11-08',checks=[{type:'척도'},{type:'텍스트'}];
const status=state=>JSON.parse(JSON.stringify(context.mockupHomeJournalStatus(state,0,today,checks)));
assert.deepEqual(status({}),{done:false,draft:false,draftDate:''});
assert.equal(status({drafts:{0:{'quick-0':'1','quick-0-selected':'','journal-field-label-1':'제목'}}}).draft,false);
assert.equal(status({drafts:{0:{'quick-0':'2','quick-0-selected':'true'}}}).draft,true);
assert.deepEqual(status({drafts:{0:{'quick-1':'메모'}},draftDates:{0:'2026-11-06'}}),{done:false,draft:true,draftDate:'2026-11-06'});
const saved={recipient:0,date:today,text:'저장한 일지'};
assert.equal(status({savedJournals:[saved]}).done,true);
assert.equal(status({savedJournals:[saved],deletedJournalKeys:[JSON.stringify([0,today,saved.text])]}).done,false);
assert.equal(status({savedJournals:[{...saved,recipient:1}]}).done,false);
console.log('Home journal status checks passed.');
