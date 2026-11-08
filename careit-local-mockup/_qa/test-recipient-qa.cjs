const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'mockup.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('(() => {')), context);

const state={
  recipients:[{name:'삭제 대상',active:false},{name:'유지 대상',active:true}],
  drafts:{0:{memo:'private'},1:{memo:'keep'}}, draftDates:{0:'2026-11-08',1:'2026-11-08'},
  configuration:{0:['private'],1:['keep']},quickChecks:{0:['private'],1:['keep']},scoring:{0:{title:'private'},1:{title:'keep'}},reportTemplates:{0:'private',1:'keep'},reportRemoved:{0:true,1:true},
  savedJournals:[{recipient:0,text:'private'},{recipient:1,text:'keep'}],generatedReports:[{recipient:0,id:'a'},{recipient:1,id:'b'}],trash:[{recipient:0},{recipient:1}],
  hiddenReportIds:['0:a','1:b'],deletedJournalKeys:[JSON.stringify([0,'date','private']),JSON.stringify([1,'date','keep'])],
  journalSchemaSnapshots:{[JSON.stringify([0,'private'])]:{},[JSON.stringify([1,'keep'])]:{}},
  journalTemplates:[{name:'공통 템플릿'}],
  iep:{drafts:{0:{input:'private'},1:{input:'keep'}},plans:[{id:'a',recipient:0},{id:'b',recipient:1}],savedDrafts:{a:{},b:{}},usage:{jobs:[{recipient:0},{recipient:1}]},monthlyArchive:{drafts:{0:{},1:{}},savedDrafts:{a:{},b:{}},plans:{a:{recipient:0},b:{recipient:1}}}}
};
assert.equal(context.mockupJournalRecipient(state,0),1);
assert.equal(context.mockupJournalRecipient({recipients:[{active:false},{deleted:true,active:true}]},0),-1);
context.mockupDeleteRecipientData(state,0);
assert.equal(JSON.stringify(state.recipients[0]),'{"deleted":true,"active":false}');
assert.equal(state.recipients[1].name,'유지 대상');
for(const key of ['drafts','draftDates','configuration','quickChecks','scoring','reportTemplates','reportRemoved']){assert.equal(state[key][0],undefined);assert.notEqual(state[key][1],undefined);}
for(const key of ['savedJournals','generatedReports','trash'])assert.deepEqual(state[key].map(item=>item.recipient),[1]);
assert.deepEqual(state.hiddenReportIds,['1:b']);
assert.equal(state.deletedJournalKeys.length,1);
assert.equal(Object.keys(state.journalSchemaSnapshots).length,1);
assert.equal(state.journalTemplates[0].name,'공통 템플릿');
assert.equal(state.iep.plans.length,1);
assert.equal(state.iep.plans[0].recipient,1);
assert.equal(state.iep.drafts[0],undefined);
assert.equal(state.iep.savedDrafts.a,undefined);
assert.equal(state.iep.monthlyArchive.plans.a,undefined);
assert.equal(state.iep.monthlyArchive.savedDrafts.a,undefined);
assert.equal(state.iep.usage.jobs.length,1);
const generation=source.slice(source.indexOf("else if(action==='generate-report')"),source.indexOf("else if(action==='reset-design')",source.indexOf("else if(action==='generate-report')")));
assert.equal((generation.match(/if\(!state\.aiConsent\)/g)||[]).length,2);
console.log('Active recipient selection, recipient data deletion and report consent guards passed.');
