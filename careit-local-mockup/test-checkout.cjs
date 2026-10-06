// Run: node test-checkout.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'mockup.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('(() => {')), context);
for (const [monthlyPrice, months, expected] of [
  [14900, 1, 14900], [14900, 12, 166800],
  [29900, 1, 29900], [29900, 12, 346800]
]) assert.equal(context.mockupCheckoutPrice(monthlyPrice, months), expected);
for (const [today, months, expected] of [
  ['2026-10-06', 0, '2026.10.06'],
  ['2026-10-06', 1, '2026.11.06'],
  ['2026-01-31', 1, '2026.02.28'],
  ['2028-01-31', 1, '2028.02.29'],
  ['2026-12-31', 1, '2027.01.31'],
  ['2026-10-06', 12, '2027.10.06'],
  ['2028-02-29', 12, '2029.02.28']
]) assert.equal(context.mockupBillingDate(today, months), expected);
console.log('Checkout passed: monthly/annual prices and billing dates.');
