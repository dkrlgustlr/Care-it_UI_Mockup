// Run: node test-checkout.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'mockup.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('(() => {')), context);
assert.equal(context.mockupProfileInitial('QA'),'Q');
assert.equal(context.mockupProfileInitial(' 김선생 '),'김');
assert.equal(context.mockupProfileInitial(''),'?');
for (const [plan, expected] of [['starter',14900],['team',39900],['yearly',null]]) {
  assert.equal(context.mockupCheckoutPrice(plan),expected);
}
for (const [today, months, expected] of [
  ['2026-10-06', 0, '2026.10.06'],
  ['2026-10-06', 1, '2026.11.06'],
  ['2026-01-31', 1, '2026.02.28'],
  ['2026-01-31', 2, '2026.03.31'],
  ['2028-01-31', 1, '2028.02.29'],
  ['2026-12-31', 1, '2027.01.31'],
  ['2026-10-06', 12, '2027.10.06'],
  ['2028-02-29', 12, '2029.02.28']
]) assert.equal(context.mockupBillingDate(today, months), expected);
for (const terms of [false,true]) for (const renewal of [false,true]) {
  const sub=context.mockupCheckoutSubscription('team','2026-01-31',{terms,renewal},'2026-01-31T01:00:00Z');
  if (!terms || !renewal) { assert.equal(sub,null); continue; }
  assert.equal(sub.amount,39900);
  assert.equal(sub.cycle,'monthly');
  assert.equal(sub.nextBillingOn,'2026.02.28');
  assert.equal(sub.consent.amount,sub.amount);
  assert.equal(sub.consent.nextBillingOn,sub.nextBillingOn);
  assert.equal(sub.consent.acceptedAt,'2026-01-31T01:00:00Z');
  assert.equal(sub.autoRenew,true);
  const cancelled=context.mockupStopRenewal(sub,'2026-02-02T01:00:00Z');
  assert.equal(sub.autoRenew,true,'Cancellation must not mutate the original before persistence succeeds');
  assert.equal(cancelled.autoRenew,false);
  assert.equal(cancelled.amount,39900);
  assert.equal(cancelled.consent,sub.consent);
  assert.equal(context.mockupSubscriptionPeriod(cancelled,'2026-02-27').end,'2026.02.27');
  assert.equal(context.mockupSubscriptionPeriod(cancelled,'2026-02-27').ended,false);
  assert.equal(context.mockupSubscriptionPeriod(cancelled,'2026-02-28').ended,true);
}
assert.equal(context.mockupCheckoutSubscription('yearly','2026-01-31',{terms:true,renewal:true},'now'),null);
assert.equal(context.mockupRefundDeadline('2026-11-08'),'2026-11-15');
assert.equal(context.mockupRefundDeadline('2026-01-31'),'2026-02-07');
assert.equal(context.mockupRefundDeadline('2026-02-30'),null);
assert.equal(context.mockupSubscriptionPeriod({refundDemoOn:'2026-11-08'},'2026-11-08').ended,true);
assert.equal(context.mockupActivePlan({subscription:null},'2026-11-08'),null);
assert.equal(context.mockupActivePlan({subscription:{plan:'starter',autoRenew:true,nextBillingOn:'2026.12.08'}},'2026-11-08'),'starter');
assert.equal(context.mockupActivePlan({subscription:{plan:'team',autoRenew:false,nextBillingOn:'2026.12.08'}},'2026-11-08'),'team');
assert.equal(context.mockupActivePlan({subscription:{plan:'team',autoRenew:false,nextBillingOn:'2026.11.08'}},'2026-11-08'),null);
assert.equal(context.mockupActivePlan({subscription:{plan:'team',refundDemoOn:'2026-11-08'}},'2026-11-08'),null);
const restoreState={subscription:{plan:'starter',nextBillingOn:'2026.12.08',autoRenew:true},recipients:[{active:true},{active:false,pausedByPlanLimit:true},{active:false},{active:false,deleted:true,pausedByPlanLimit:true}]};
context.mockupRestorePlanRecipients(restoreState,'2026-11-08');
assert.equal(restoreState.recipients[1].active,true);
assert.equal(restoreState.recipients[1].pausedByPlanLimit,undefined);
assert.equal(restoreState.recipients[2].active,false);
assert.equal(restoreState.recipients[3].active,false);
const capped={subscription:restoreState.subscription,recipients:[...Array.from({length:4},()=>({active:true})),{active:false,pausedByPlanLimit:true},{active:false,pausedByPlanLimit:true}]};
context.mockupRestorePlanRecipients(capped,'2026-11-08');
assert.equal(capped.recipients.filter(r=>r.active).length,5);
assert.equal(capped.recipients[5].pausedByPlanLimit,true);
for (const legacy of [
  {plan:'team',cycle:'yearly',amount:346800,paidOn:'2026-10-06',nextBillingOn:'2027.10.06',invites:['sample@example.test']},
  {plan:'team',cycle:'monthly',amount:29900,paidOn:'2026-10-06',nextBillingOn:'2026.11.06',invites:[]}
]) {
  const cancelled=context.mockupStopRenewal(legacy,'2026-10-12T01:00:00Z');
  for (const field of ['amount','cycle','paidOn','nextBillingOn','invites']) assert.equal(cancelled[field],legacy[field]);
  assert.equal(context.mockupSubscriptionPeriod(cancelled,'2026-10-12').ended,false);
}
console.log('Checkout passed: monthly prices, separate required consents, date boundaries, cancellation and legacy records.');
