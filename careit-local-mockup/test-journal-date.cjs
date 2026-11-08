const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('mockup.js', 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('(() => {')), context);

assert.equal(context.mockupJournalStartDate('2026-11-08'), '2026-11-05');
for (const day of ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']) {
  assert.equal(context.mockupJournalDateAllowed(day, '2026-11-08'), true, day);
}
for (const day of ['2026-11-04', '2026-11-09', '2026-11-31', '', 'not-a-date']) {
  assert.equal(context.mockupJournalDateAllowed(day, '2026-11-08'), false, day);
}
assert.equal(context.mockupJournalStartDate('2026-01-02'), '2025-12-30');
assert.equal(context.mockupJournalStartDate('2024-03-01'), '2024-02-27');
assert.equal(context.mockupJournalDateAllowed('2024-02-29', '2024-03-01'), true);
assert.equal(context.mockupJournalDateAllowed('2023-02-29', '2023-03-01'), false);
console.log('Journal date range checks passed.');
