const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('mockup.js', 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('(() => {')), context);
const valid = (min, max) => context.mockupScaleRange(min, max).valid;

assert.equal(valid('', ''), true);
assert.equal(valid(0, 1), true);
assert.equal(valid('-2', '2'), true);
assert.equal(valid('1', '11'), true);
assert.equal(valid('1', '1'), false);
assert.equal(valid('6', ''), false);
assert.equal(valid('', '1'), false);
assert.equal(valid('2', '1'), false);
assert.equal(valid('1', '12'), false);
assert.equal(valid('1.5', '5'), false);
assert.equal(valid('9007199254740992', '9007199254740993'), false);

const preview = source.slice(source.indexOf('  function quickPreview('), source.indexOf('  function updateTimeField('));
context.escapeHTML = value => String(value);
vm.runInContext(preview, context);
const example = {name:'척도',type:'척도',min:'1',max:'1',scaleStart:'',scaleEnd:''};
assert.match(context.quickPreview(example, 0, true), /척도 범위를 2~11단계로/);
assert.match(context.quickPreview(example, 0, false), /quick-check-slider/);
example.min='0';example.max='2';
assert.match(context.quickPreview(example, 0, true), /min="0" max="2"/);

const editor = source.slice(source.indexOf('  function drawQuickEditor('), source.indexOf('  function quickOptionEditor('));
let dialogMarkup = '';
context.quickDraft = {name:'척도',type:'척도',min:'1',max:'1.6',choices:[],scaleStart:'',scaleEnd:''};
context.quickIndex = 0;
context.editorDialog = (id, cls, title, markup) => { dialogMarkup = markup; };
vm.runInContext(editor, context);
context.drawQuickEditor();
assert.match(dialogMarkup, /id="quick-edit-form" novalidate/);
assert.match(dialogMarkup, /id="quick-scale-error" role="alert" hidden/);
assert.match(dialogMarkup, /aria-describedby="quick-scale-error"/);

const save = source.slice(source.indexOf('  async function saveQuick('), source.indexOf('  function scoreSeed('));
const error = {hidden:true};
const inputs = { '#quick-min':{validity:{badInput:false},setAttribute(){}}, '#quick-max':{validity:{badInput:false},setAttribute(){}} };
context.readQuickDraft = () => {};
context.$ = selector => selector === '#quick-scale-error' ? error : inputs[selector];
vm.runInContext(save, context);
(async () => {
  await context.saveQuick();
  assert.equal(error.hidden, false, 'decimal range is rejected with inline feedback');
  error.hidden = true;
  context.quickDraft.max = '';
  inputs['#quick-max'].validity.badInput = true;
  await context.saveQuick();
  assert.equal(error.hidden, false, 'incomplete number cannot silently become the default');
  console.log('Scale range limits and inline validation passed');
})().catch(error => { console.error(error); process.exit(1); });
