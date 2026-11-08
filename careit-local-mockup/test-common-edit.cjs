// Run: node test-common-edit.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'mockup.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('(() => {')), context);
const plain = value => JSON.parse(JSON.stringify(value));
const state = {
  recipients: [{active:true},{active:true},{active:false},{deleted:true}],
  configuration: {1:['개별 영역']}, quickChecks: {1:[{name:'개별 체크'}]},
  scoring: {1:{title:'개별 기준'}}, reportTemplates: {1:'개별 기준'},
  savedJournals: [{recipient:0,text:'이전 기록'}], savedReports: [{recipient:0,title:'이전 리포트'}]
};
const original=JSON.stringify(state);
assert.equal(context.mockupSaveCommonTemplate(state,'unknown',{}),false);
assert.equal(JSON.stringify(state),original);
const journal={labels:['공통 영역'],quickChecks:[{name:'공통 체크',choices:[{name:'완료'}]}]};
assert.equal(context.mockupSaveCommonTemplate(state,'journal',journal),true);
assert.deepEqual(plain(state.commonTemplates.journal),journal);
journal.quickChecks[0].choices[0].name='아직 저장하지 않은 수정';
assert.equal(state.commonTemplates.journal.quickChecks[0].choices[0].name,'완료');
const report={title:'공통 기준',domains:[{name:'의사소통',questions:['도움을 요청한다.']}]};
context.mockupSaveCommonTemplate(state,'report',report);
assert.deepEqual(plain(state.commonTemplates.report),report);
report.domains[0].questions[0]='아직 저장하지 않은 문항';
assert.equal(state.commonTemplates.report.domains[0].questions[0],'도움을 요청한다.');
const previousReport=JSON.stringify(state.commonTemplates.report);
context.mockupSaveCommonTemplate(state,'journal',journal);
assert.equal(state.commonTemplates.journal.quickChecks[0].choices[0].name,'아직 저장하지 않은 수정');
assert.equal(JSON.stringify(state.commonTemplates.report),previousReport);
assert.deepEqual(Object.keys(state.commonTemplates).sort(),['journal','report']);
const {commonTemplates,...individualState}=state;
assert.equal(JSON.stringify(individualState),original);
console.log('Common templates passed: one template per kind, independent drafts, individual settings and records preserved.');
