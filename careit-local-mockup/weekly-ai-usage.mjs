import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const WEEKLY_LIMIT = 500000;
export function weightedUsage(usage) {
  const input=usage?.input_tokens, output=usage?.output_tokens;
  if (!Number.isSafeInteger(input) || input<0 || !Number.isSafeInteger(output) || output<0 || !Number.isSafeInteger(input+output*5)) throw new Error('토큰 사용량이 올바르지 않아요.');
  return input+output*5;
}
const WEEK = 7 * 24 * 60 * 60 * 1000;

export function createWeeklyUsage(file) {
  function read() {
    if (!existsSync(file)) return {};
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('사용량 기록을 읽지 못했어요.');
    return data;
  }
  const key = subject => createHash('sha256').update(subject).digest('hex');
  function write(data) {
    mkdirSync(dirname(file),{recursive:true,mode:0o700});
    const tmp=`${file}.${randomUUID()}.tmp`;
    writeFileSync(tmp,JSON.stringify(data),{mode:0o600});renameSync(tmp,file);
  }
  function migrate(data, account, now) {
    const entry=data[account];if(!entry || entry.version===2)return;
    const oldStart=Date.parse(entry.start);
    if(!Number.isFinite(oldStart)||!Number.isSafeInteger(entry.used)||entry.used<0)throw new Error('사용량 기록을 읽지 못했어요.');
    // The previous ledger did not retain the first-use time; preserve current usage from migration time.
    data[account]={version:2,start:new Date(now).toISOString(),cycle:0,used:now<oldStart+WEEK?entry.used:0};
    write(data);
  }
  function begin(subject, now = Date.now()) {
    const data=read(),account=key(subject);migrate(data,account,now);
    if(!data[account]){data[account]={version:2,start:new Date(now).toISOString(),cycle:0,used:0};write(data);}
    return get(subject,now);
  }
  function get(subject, now = Date.now()) {
    const data=read(),account=key(subject);migrate(data,account,now);const entry=data[account];
    if(!entry)return {limit:WEEKLY_LIMIT,used:0,remaining:WEEKLY_LIMIT,resetAt:null};
    const start=Date.parse(entry.start),cycle=Math.max(0,Math.floor((now-start)/WEEK));
    if(!Number.isFinite(start)||!Number.isSafeInteger(entry.cycle)||entry.cycle<0||!Number.isSafeInteger(entry.used)||entry.used<0)throw new Error('사용량 기록을 읽지 못했어요.');
    const used=entry.cycle===cycle?entry.used:0;
    return {limit:WEEKLY_LIMIT,used,remaining:Math.max(0,WEEKLY_LIMIT-used),resetAt:new Date(start+(cycle+1)*WEEK).toISOString()};
  }
  function add(subject, tokens, now = Date.now()) {
    if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error('토큰 사용량이 올바르지 않아요.');
    begin(subject,now);const data=read(),account=key(subject),previous=data[account],cycle=Math.max(0,Math.floor((now-Date.parse(previous.start))/WEEK));
    const used=previous.cycle===cycle?previous.used:0;
    if (!Number.isSafeInteger(used) || used<0 || !Number.isSafeInteger(used+tokens)) throw new Error('사용량 기록을 읽지 못했어요.');
    data[account]={...previous,cycle,used:used+tokens};write(data);
    return get(subject,now);
  }
  function record(subject, entry) {
    const data=read(),account=key(subject);if(!data[account])throw new Error('사용량 기록을 찾을 수 없어요.');
    const log=data[account].qaLog ||= [];
    log.push(entry);if(log.length>500)log.splice(0,log.length-500);write(data);
  }
  function history(subject){return (read()[key(subject)]?.qaLog||[]).slice(-100).reverse();}
  function reset(subject, now=Date.now()){
    const data=read(),account=key(subject),qaLog=data[account]?.qaLog;
    data[account]={version:2,start:new Date(now).toISOString(),cycle:0,used:0,...(qaLog?{qaLog}:{})};write(data);
    return get(subject,now);
  }
  return {get,begin,add,record,history,reset};
}
