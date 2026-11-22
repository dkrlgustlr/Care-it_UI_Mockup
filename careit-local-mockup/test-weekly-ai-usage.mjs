import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createWeeklyUsage, weightedUsage, WEEKLY_LIMIT } from './weekly-ai-usage.mjs';

const dir=mkdtempSync(join(tmpdir(),'careit-weekly-'));
const file=join(dir,'usage.json');
try {
  const ledger=createWeeklyUsage(file), sunday=Date.parse('2026-11-22T04:30:00Z'), monday=Date.parse('2026-11-22T15:00:00Z'),week=7*86400000;
  assert.equal(weightedUsage({input_tokens:800,output_tokens:200,total_tokens:1000,output_tokens_details:{reasoning_tokens:100}}),1800);
  assert.equal(weightedUsage({input_tokens:0,output_tokens:12}),60);
  assert.throws(()=>weightedUsage({input_tokens:800}));
  assert.throws(()=>weightedUsage({input_tokens:1,output_tokens:-1}));
  assert.equal(ledger.get('account-a',sunday).remaining,WEEKLY_LIMIT);
  assert.equal(ledger.get('account-a',sunday).resetAt,null);
  assert.equal(ledger.begin('account-a',sunday).resetAt,'2026-11-29T04:30:00.000Z');
  assert.equal(ledger.add('account-a',1200,sunday).used,1200);
  assert.equal(ledger.add('account-a',300,sunday).remaining,498500);
  assert.equal(createWeeklyUsage(file).get('account-a',sunday).used,1500);
  assert.equal(ledger.get('account-b',sunday).used,0);
  assert.equal(ledger.get('account-a',monday).remaining,498500);
  assert.equal(ledger.get('account-a',sunday+week-1).used,1500);
  assert.equal(ledger.get('account-a',sunday+week).remaining,WEEKLY_LIMIT);
  assert.equal(ledger.add('account-a',500001,sunday+week).remaining,0);
  assert.equal(ledger.get('account-a',sunday+2*week).remaining,WEEKLY_LIMIT);
  assert.throws(()=>ledger.add('account-a',-1,monday));
  assert.doesNotMatch(readFileSync(file,'utf8'),/account-a|account-b/);
  const legacyKey=createHash('sha256').update('legacy').digest('hex');
  writeFileSync(file,JSON.stringify({[legacyKey]:{start:'2026-11-15T15:00:00.000Z',used:720}}));
  assert.equal(ledger.get('legacy',sunday).used,720);
  assert.equal(ledger.get('legacy',sunday).resetAt,'2026-11-29T04:30:00.000Z');
  console.log('Weekly usage first-use anchor, migration, weighting and rollover: passed');
} finally { rmSync(file,{force:true});rmdirSync(dir); }
