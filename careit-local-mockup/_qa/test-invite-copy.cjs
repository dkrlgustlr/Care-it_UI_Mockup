const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'mockup.js'), 'utf8');
const start = source.indexOf("else if(action==='copy-account-invite'){");
const end = source.indexOf("else if(action==='password-preview')", start);
assert.ok(start >= 0 && end > start);
const body = source.slice(source.indexOf('{', start) + 1, source.lastIndexOf('}', end));
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const copy = new AsyncFunction('$', 'navigator', 'document', 'toast', body);

(async()=>{
  const input = {value:'file:///mock.html#/invite?code=careit-demo',focus(){this.focused=true;},select(){this.selected=true;}};
  let result='', clipboard='';
  await copy(()=>input,{clipboard:{writeText:async value=>{clipboard=value;}}},{},message=>result=message);
  assert.equal(clipboard,input.value);
  assert.equal(result,'초대 링크를 복사했어요.');
  await copy(()=>input,{clipboard:{writeText:async()=>{throw new Error('denied');}}},{execCommand:()=>true},message=>result=message);
  assert.ok(input.focused && input.selected);
  assert.equal(result,'초대 링크를 복사했어요.');
  await copy(()=>input,{}, {execCommand:()=>false}, message=>result=message);
  assert.equal(result,'링크를 선택해 직접 복사해 주세요.');
  console.log('Invite clipboard, fallback and failure messages passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
