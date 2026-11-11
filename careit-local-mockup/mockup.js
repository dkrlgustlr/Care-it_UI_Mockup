/* UI 동작과 샘플 데이터. 서버 요청 없이 이 브라우저 안에서만 실행됩니다. */
function createMockupStorage({storage,key,locks,onBlocked}) {
  let lastSaved=null,blocked=false,pending=0,queue=Promise.resolve();
  try { lastSaved=storage.getItem(key); } catch {}
  const initial=lastSaved;
  function stop(reason) {if(!blocked){blocked=true;onBlocked(reason);}return false;}
  function check() {
    if(blocked)return false;
    try {return storage.getItem(key)===lastSaved||stop('conflict');}
    catch {return stop('unavailable');}
  }
  function save(snapshot) {
    pending++;
    const write=()=>{
      if(!check())return false;
      try {storage.setItem(key,snapshot);lastSaved=snapshot;return true;}
      catch {return stop('unavailable');}
    };
    // 같은 출처의 탭에서 동시에 저장해도 비교와 쓰기를 한 번에 하나씩 수행합니다.
    queue=queue.then(()=>locks?locks.request(key,write):write()).catch(()=>stop('unavailable')).finally(()=>pending--);
    return queue;
  }
  return {initial,save,check,get blocked(){return blocked;},get pending(){return pending;}};
}
function mockupCheckoutPrice(plan) {
  return ({starter:14900,team:39900})[plan] ?? null;
}
function mockupScaleRange(minValue,maxValue) {
  const min=Number(minValue==null||minValue===''?1:minValue),max=Number(maxValue==null||maxValue===''?5:maxValue);
  return {min,max,valid:Number.isSafeInteger(min)&&Number.isSafeInteger(max)&&max>min&&max-min<=10};
}
function mockupBillingDate(today, months = 0) {
  const [year, month, day] = today.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
function mockupCheckoutSubscription(plan, today, consent, acceptedAt) {
  const amount=mockupCheckoutPrice(plan);
  if (!Number.isInteger(amount) || consent.terms!==true || consent.renewal!==true) return null;
  const nextBillingOn=mockupBillingDate(today,1);
  return {plan,cycle:'monthly',paidOn:today,amount,nextBillingOn,autoRenew:true,invites:[],
    consent:{version:'2026-10-12-checkout',acceptedAt,terms:true,renewal:true,plan,cycle:'monthly',amount,currency:'KRW',nextBillingOn}};
}
function mockupSubscriptionPeriod(sub, today) {
  if (sub.refundDemoOn) return {end:sub.refundDemoOn.replaceAll('-','.'),ended:true};
  const [year,month,day]=sub.nextBillingOn.split('.').map(Number);
  const end=new Date(Date.UTC(year,month-1,day-1)).toISOString().slice(0,10).replaceAll('-','.');
  return {end,ended:sub.autoRenew===false && today.replaceAll('-','.')>=sub.nextBillingOn};
}
function mockupRefundDeadline(paidOn) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn||'')) return null;
  const date=new Date(`${paidOn}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==paidOn) return null;
  date.setUTCDate(date.getUTCDate()+7);
  return date.toISOString().slice(0,10);
}
function mockupStopRenewal(sub, cancelledAt) {
  return {...sub,autoRenew:false,cancelledAt};
}
function mockupAddDays(value, days) {
  const date=new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}
function mockupCouponPeriod(state,today,days) {
  const sub=state.subscription, paid=sub&&!mockupSubscriptionPeriod(sub,today).ended;
  if(paid&&sub.plan==='team')return null;
  let start=paid?sub.nextBillingOn.replaceAll('.','-'):today;
  if(state.couponPlusUntil&&state.couponPlusUntil>=start)start=mockupAddDays(state.couponPlusUntil,1);
  return {start,end:mockupAddDays(start,days-1)};
}
function mockupRecipientCapacity(state,today) {
  return mockupActivePlan(state,today) ? 5 : 1;
}
function mockupActivePlan(state,today) {
  if(state.subscription && !mockupSubscriptionPeriod(state.subscription,today).ended)return state.subscription.plan;
  return state.couponPlusFrom<=today && state.couponPlusUntil>=today ? 'starter' : null;
}
function mockupRestorePlanRecipients(state,today) {
  let remaining=mockupRecipientCapacity(state,today)-state.recipients.filter(r=>r.active&&!r.deleted).length;
  for (const recipient of state.recipients) {
    if (remaining<=0) break;
    if (!recipient.deleted && !recipient.active && recipient.pausedByPlanLimit) {
      recipient.active=true;
      delete recipient.pausedByPlanLimit;
      remaining--;
    }
  }
}
function mockupJournalRecipient(state,requested) {
  const person=state.recipients[requested];
  if(person?.active&&!person.deleted)return requested;
  return state.recipients.findIndex(item=>item.active&&!item.deleted);
}
function mockupDeleteRecipientData(state,index) {
  state.recipients[index]={deleted:true,active:false};
  for(const key of ['drafts','draftDates','configuration','quickChecks','scoring','reportTemplates','reportRemoved'])if(state[key])delete state[key][index];
  for(const key of ['savedJournals','generatedReports','trash'])if(state[key])state[key]=state[key].filter(item=>item.recipient!==index);
  if(state.hiddenReportIds)state.hiddenReportIds=state.hiddenReportIds.filter(key=>!key.startsWith(`${index}:`));
  if(state.deletedJournalKeys)state.deletedJournalKeys=state.deletedJournalKeys.filter(key=>{try{return JSON.parse(key)[0]!==index;}catch{return true;}});
  if(state.journalSchemaSnapshots)for(const key of Object.keys(state.journalSchemaSnapshots)){try{if(JSON.parse(key)[0]===index)delete state.journalSchemaSnapshots[key];}catch{}}
  const iep=state.iep;
  if(iep){
    const ids=new Set((iep.plans||[]).filter(plan=>plan.recipient===index).map(plan=>plan.id));
    for(const [id,plan] of Object.entries(iep.monthlyArchive?.plans||{}))if(plan.recipient===index)ids.add(id);
    if(iep.drafts)delete iep.drafts[index];
    if(iep.plans)iep.plans=iep.plans.filter(plan=>plan.recipient!==index);
    if(iep.usage?.jobs)iep.usage.jobs=iep.usage.jobs.filter(job=>job.recipient!==index);
    for(const id of ids){if(iep.savedDrafts)delete iep.savedDrafts[id];if(iep.monthlyArchive?.savedDrafts)delete iep.monthlyArchive.savedDrafts[id];if(iep.monthlyArchive?.plans)delete iep.monthlyArchive.plans[id];}
    if(iep.monthlyArchive?.drafts)delete iep.monthlyArchive.drafts[index];
  }
}
function mockupReportWeek(value, offset=0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value||'')) return null;
  const date=new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==value) return null;
  date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+2)%7+offset*7);
  const from=date.toISOString().slice(0,10);
  date.setUTCDate(date.getUTCDate()+6);
  return {from,to:date.toISOString().slice(0,10)};
}
function mockupJournalStartDate(today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today||'')) return '';
  const date=new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==today) return '';
  date.setUTCDate(date.getUTCDate()-3);
  return date.toISOString().slice(0,10);
}
function mockupJournalDateAllowed(date,today) {
  const start=mockupJournalStartDate(today);
  if(!start||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return false;
  const parsed=new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date&&date>=start&&date<=today;
}
function mockupReportDays(range, rows) {
  return range?.from&&range?.to?new Set(rows.filter(row=>row[0]>=range.from&&row[0]<=range.to).map(row=>row[0])).size:0;
}
function mockupReportSampleJournals(today) {
  const examples=[
    '블록 놀이에서 원하는 색을 골랐고, 연결이 어려울 때 그림을 가리켜 도움을 요청했어요.',
    '그림책의 동물을 가리키며 소리를 따라 했고, 익숙한 장면에서 먼저 몸짓으로 표현했어요.',
    '산책 중 멈춤 안내를 듣고 기다렸으며, 다시 출발할 때 손짓을 보고 함께 걸었어요.',
    '정리 시간에 그림 안내를 보고 놀잇감을 바구니에 넣었고, 마지막 한 개는 도움을 받아 정리했어요.'
  ];
  return [4,2,0,3].flatMap((count,index)=>{
    const week=mockupReportWeek(today,-index-1);
    return Array.from({length:count},(_,dayIndex)=>{
      const date=new Date(`${week.from}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+dayIndex*2);
      return {date:date.toISOString().slice(0,10),text:`[리포트 예시] ${examples[dayIndex]}`};
    });
  });
}
function mockupReportCalendarDates(year, month) {
  const day=new Date(Date.UTC(year,month,1)),last=new Date(Date.UTC(year,month+1,0)),dates=[];
  day.setUTCDate(day.getUTCDate()-day.getUTCDay());
  last.setUTCDate(last.getUTCDate()+6-last.getUTCDay());
  for(;day<=last;day.setUTCDate(day.getUTCDate()+1))dates.push(day.toISOString().slice(0,10));
  return dates;
}
function mockupReportEligibility(range, today, days=null) {
  if (!range?.from || !range?.to) return {allowed:false,reason:'empty'};
  const week=mockupReportWeek(range.from);
  if (!week || week.from!==range.from || week.to!==range.to) return {allowed:false,reason:'invalid'};
  const next=new Date(`${range.to}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate()+1);
  const opensOn=next.toISOString().slice(0,10);
  // 종료일 이후 최대 30일까지, 다음 달에 같은 날짜가 없으면 말일까지 허용합니다.
  const monthEnd=mockupBillingDate(range.to,1).replaceAll('.','-'),thirtyDays=new Date(`${range.to}T00:00:00Z`);thirtyDays.setUTCDate(thirtyDays.getUTCDate()+30);
  const expiresOn=[monthEnd,thirtyDays.toISOString().slice(0,10)].sort()[0];
  const reason=today<opensOn?'future':today>expiresOn?'expired':days!==null&&days<3?'insufficient':'';
  return {allowed:!reason,reason,opensOn,expiresOn};
}
function mockupReportNotice(status, days) {
  if(status.reason==='insufficient')return `${days?`일지를 ${days}일 기록했어요.`:'저장된 일지가 없어요.'}\n주간 일지가 3일 이상 필요해요.`;
  if(status.reason==='expired')return '생성 기한이 지났어요.\n주간 종료 후 1개월까지만 가능해요.';
  if(status.reason==='future'){
    const [,month,day]=status.opensOn.split('-').map(Number);
    return `아직 생성할 수 없는 주간이에요.\n${month}월 ${day}일부터 생성할 수 있어요.`;
  }
  if(status.allowed)return `일지 ${days}일이 있어 생성할 수 있어요.\n날짜를 눌러 주간을 선택해 주세요.`;
  return '날짜에 마우스를 올리면\n생성 가능 여부를 알려드려요.';
}
function mockupSaveCommonTemplate(state, kind, draft) {
  if(!['journal','report'].includes(kind))return false;
  state.commonTemplates ||= {};
  state.commonTemplates[kind]=JSON.parse(JSON.stringify(draft));
  return true;
}
function mockupRecentVisitUpsert(items, visit) {
  return [visit,...(Array.isArray(items)?items:[]).filter(item=>item&&item.key!==visit.key)].slice(0,20);
}
function mockupRecentJournalHash(text) {
  let hash=2166136261;
  for(const char of String(text||'')){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(36);
}
function mockupProfileInitial(name) {
  return (Array.from(String(name||'').trim())[0]||'?').toLocaleUpperCase('ko-KR');
}
async function mockupPasswordHash(password, salt) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256);
  return Array.from(new Uint8Array(bits),byte=>byte.toString(16).padStart(2,'0')).join('');
}
const MOCKUP_PROFILE_AVATARS = [
  'assets/profile-avatars/avatar-01.png', 'assets/profile-avatars/avatar-02.png',
  'assets/profile-avatars/avatar-03.png', 'assets/profile-avatars/avatar-04.png',
  'assets/profile-avatars/avatar-05.png', 'assets/profile-avatars/avatar-06.png',
  'assets/profile-avatars/avatar-07.png', 'assets/profile-avatars/avatar-08.png',
  'assets/profile-avatars/avatar-09.png', 'assets/profile-avatars/avatar-10.png',
  'assets/profile-avatars/avatar-11.png', 'assets/profile-avatars/avatar-12.png'
];
function mockupAssignProfileAvatar(profile, random = Math.random) {
  if (Number.isInteger(profile.avatarIndex) && profile.avatarIndex >= 0 && profile.avatarIndex < MOCKUP_PROFILE_AVATARS.length) return false;
  profile.avatarIndex = Math.floor(random() * MOCKUP_PROFILE_AVATARS.length);
  return true;
}
function mockupHomeJournalStatus(state, index, today, checks) {
  const done=(state.savedJournals||[]).some(row=>row.recipient===index&&row.date===today&&!(state.deletedJournalKeys||[]).includes(JSON.stringify([index,row.date,row.text])));
  const draft=Object.entries(state.drafts?.[index]||{}).some(([id,value])=>{
    const match=id.match(/^quick-(\d+)$/);
    return !id.startsWith('journal-field-label-')&&!(match&&checks[Number(match[1])]?.type==='척도')&&!(id.endsWith('-selected')&&value!=='true')&&value!==false&&value!==''&&value!==undefined;
  });
  return {done,draft,draftDate:state.draftDates?.[index]||''};
}
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mockupNotice = {title:'돌봄 기록부터 리포트까지, 케어릿과 함께',summary:'일지 작성부터 주간 리포트 확인까지 알아보세요.'};
  const embedded = JSON.parse($('#saved-design').textContent || '{}');
  const STORAGE = 'careit-ui-mockup-20260923-v1' + (embedded.exportId ? '-'+embedded.exportId : '');
  const store=createMockupStorage({storage:localStorage,key:STORAGE,locks:navigator.locks,onBlocked:showStorageBlock});
  let state = {...embedded};
  try { state = {...state, ...JSON.parse(store.initial || '{}')}; } catch {}
  state.edits ||= {};
  state.drafts ||= {};
  state.draftDates ||= {};
  state.savedJournals ||= [];
  state.configuration ||= {};
  state.quickChecks ||= {};
  // 기존에 저장한 식사 선택 항목에도 문구 변경을 반영합니다.
  for (const items of Object.values(state.quickChecks)) {
    for (const item of items) {
      if (!['아침 식사','점심 식사','저녁 식사'].includes(item.name)) continue;
      for (const choice of item.choices || []) {
        if (choice.name === '도시락/기타') choice.name = '도시락';
      }
    }
  }
  state.scoring ||= {};
  state.trash ||= [];
  state.reportTemplates ||= {};
  state.journalTemplateConfigs ||= {};
  state.journalSchemaSnapshots ||= {};
  state.journalTemplates ||= [
    {name:'일지 템플릿 1',quickChecks:6},
    {name:'일지 템플릿 2',quickChecks:6},
    {name:'일지 템플릿 3',quickChecks:6},
    {name:'일지 템플릿 4',quickChecks:8},
    {name:'일지 템플릿 5',quickChecks:12}
  ];
  state.profile ||= {name:'합성 QA c9b8b579',email:'qa1@careit.kr'};
  const profileAvatarAssigned = mockupAssignProfileAvatar(state.profile);
  state.marketingConsent ||= false;
  state.aiConsent ??= true;
  if ((!state.subscription && !state.planDemoFree) || (state.subscription && !['starter','team'].includes(state.subscription.plan))) state.subscription={plan:'team',cycle:'monthly',amount:39900,paidOn:'2026-10-29',nextBillingOn:'2026.11.29',autoRenew:true,invites:[],source:'live'};
  if (state.subscription?.source==='live'&&!/^\d{4}\.\d{2}\.\d{2}$/.test(state.subscription.nextBillingOn||'')) state.subscription.nextBillingOn='2026.11.29';
  const checkoutPlans = {starter:{name:'플러스'},team:{name:'팀'}};
  // 연간은 이전에 저장된 결제 내역을 표시할 때만 사용합니다. 새 결제는 월간만 제공합니다.
  const checkoutCycles = {monthly:{name:'월간',months:1,unit:'월'},yearly:{name:'연간',months:12,unit:'년'}};
  const won = value => `${value.toLocaleString('ko-KR')}원`;
  const currentDate = () => new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  const TODAY = currentDate();
  const ageBands = ['만 3세 미만','만 3~5세','만 6~12세','만 13~17세','만 18세 이상'];
  state.recipients ||= [
    {name:'산책 샘플', count:11, date:'2026/09/10', active:true, memo:''},
    {name:'그림책 샘플', count:8, date:'2026/09/10', active:true, memo:''},
    {name:'테스트용 9.14', count:1, date:'2026/09/14', active:true, memo:''},
    {name:'이지훈', count:1, date:'2026/09/13', active:false, memo:''}
  ];
  if (state.replicaBaseline!=='careit-live-20261108-journal') {
    state.recipients=[
      {name:'산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플',count:15,date:'2026/10/02',active:true,memo:'[QA 2026-10-02 AI 정리 검증용, 실제 돌봄 기록 아님] 오늘 산책을 20분쯤 했고 점심은 반 정도 드셨다. 오후에는 좀 졸려 하셨는데 간식을 드시고 나서 괜찮아지셨다. 친구와 블록 쌓기를 하다가 무너지자 잠깐 속상해했지만, 금방 다시 했다.'},
      {name:'그림책 샘플',count:8,date:'2026/10/02',active:true,memo:'awdaw.'},
      {name:'전수테스트',count:5,date:'2026/10/05',active:true,memo:'Android app full test 1005. Synthetic record, not a real care note. 점심을 잘 드셨고 20분 동안 걸으셨다.'},
      {name:'시발 롬_＆-＃',count:2,date:'2026/10/06',active:true,memo:'기분: 13:16 · 아침 식사: ㅇㅇ'}
    ];
    state.replicaBaseline='careit-live-20261108-journal';
  }
  let addedHomeSample=false;
  if (!state.homeFiveSampleSeeded) {
    if (state.recipients.length===4 && state.recipients.every(person=>person.active && !person.deleted)) {
      state.recipients.push({name:'음악 샘플',count:0,date:currentDate().replaceAll('-','/'),active:true,memo:''});
      addedHomeSample=true;
    }
    state.homeFiveSampleSeeded=true;
  }
  if (!state.homeDraftExampleSeeded && state.recipients[4]?.name==='음악 샘플') {
    if (!state.drafts[4] && !state.savedJournals.some(row=>row.recipient===4 && row.date===TODAY)) {
      state.drafts[4]={'journal-raw':'[목업 예시] 좋아하는 음악을 들으며 손뼉을 쳤어요.'};
      state.draftDates[4]=TODAY;
    }
    state.homeDraftExampleSeeded=true;
    addedHomeSample=true;
  }
  const previousAgeBands = {'만 3세':'만 3~5세','만 4세':'만 3~5세','만 5세':'만 3~5세','만 6~7세':'만 6~12세','만 8~12세':'만 6~12세'};
  let ageBandsChanged = false;
  for (const person of state.recipients) {
    if (!Object.hasOwn(previousAgeBands, person.ageBand)) continue;
    person.ageBand = previousAgeBands[person.ageBand];
    ageBandsChanged = true;
  }
  const originalJournalRows = [
    ['2026-09-22','9월 22일 (화)','[합성 QA 2026-09-22] 임시저장 복원과 직접 저장 후 정리 검증용 기록입니다. 실제 돌봄 기록이 아닙니다.'],
    ['2026-09-18','9월 18일 (금)','도윤이는 오늘 왁뿌빵 먹기 체험학습을 했다. 왁뿌 체험을 통해 촉감 교육을 목표하였으나, 옷이 너무 따가워 빨갛게 반점이 생기고 부어올랐다. 그로 인해 기분이 좋지 않아 충분한 교육이 되지 못했다. 관련 알러지 및 아토피 여부를 확인 부탁한다.'],
    ['2026-09-15','9월 15일 (화)','지훈이가 걸어가다가 넘어졌다.'],
    ['2026-09-08','9월 8일 (화)','아파트 놀이터에 가서 그네를 10분 동안 타고 공놀이를 했다. 지난번에 횡단보도 앞에서 알려준 멈춤 신호를 기억하고, 오늘 신호등 앞에서 스스로 멈춰서 기다렸다. 흙밭에서 개미 움직이는거 보더니 개미 집 어디야 물어보고 돋보기로 3분 동안 유심히 관찰함. 집 돌아와서 병원 역할놀이 했는데 청진기 들고 엄마 가슴에 대며 어디 아파요 물어봄. 지난번 스티커 붙'],
    ['2026-09-06','9월 6일 (일)','집에서 가족들과 사각형, 원형 블록 10개를 분류하는 놀이를 했다. 오빠가 파란 블록 가져가니까 내꺼야 하고 뺏으려다가 내가 차례대로 쓰자 하니까 삐져서 5분간 구석에 앉아있음. 달래주니까 다시 와서 집 모양 만들었다. 종이컵을 쌓아 높이를 비교하는 활동을 했는데, 5개를 쌓다가 무너지자 짜증을 내며 종이를 찌그러뜨렸다. 다시 알려주니 4개까지 차곡차곡 쌓'],
    ['2026-09-04','9월 4일 (금)','오전에 산책을 나가 나뭇잎 4장을 줍고 벤치에서 15분 동안 쉬었다. 도토리를 보고 가져가도 되냐고 물어봐서 산에 양보하자고 하니 약간 아쉬워하며 내려놓았다. 오후에는 집에서 숲속 동물 책 읽어달라함. 책에서 곰이 나오자 곰 시늉을 하며 거실을 두 바퀴 돌았다. 크레파스로 나무를 그릴 때 초록색을 잡기에 종이를 빳빳하게 잡아주었다. 씻을 때는 혼자 손을 씻'],
    ['2026-09-02','9월 2일 (수)','아침에 동네 길을 걸으며 가게 앞 화분을 살펴보았다. 오르막에서는 천천히 걸었고 내리막에서는 옆 사람과 간격을 맞췄다.'],
    ['2026-08-31','8월 31일 (월)','오후에 공원까지 약 15분 걸었다. 신호등 앞에서는 먼저 걸음을 멈추고 건널 때 다시 출발했다.'],
    ['2026-08-30','8월 30일 (일)','오전에 공원 둘레길을 걸으며 나무와 새 소리를 살펴보았다. 마지막 구간에서는 속도가 조금 느려져 잠시 쉬었다.'],
    ['2026-08-27','8월 27일 (목)','오후에 집 근처 길을 약 10분 걸었다. 계단 앞에서는 난간을 잡고 한 칸씩 올라갔다.'],
    ['2026-08-24','8월 24일 (월)','오전에 공원 산책을 하며 벤치까지 천천히 걸었다. 돌아오는 길에는 신호를 보고 잠시 멈췄다.']
  ];
  const quickFields = [
    ['아침 식사',['완식','절반','거부','도시락']], ['점심 식사',['완식','절반','거부','도시락']],
    ['저녁 식사',['완식','절반','거부','도시락']], ['복약',['완료','해당없음','보호자 요청(미복용)','거부']],
    ['기분',['매우좋음','평온','불안','예민/공격성']], ['활동',['적극참여','보통','관찰필요','미참여']]
  ];
  const liveJournalQuickChecks = () => [
    {name:'아침 식사',type:'텍스트',active:true,choices:[],min:'',max:'',unit:'',maxLength:200},
    {name:'점심 식사',type:'선택형',columns:2,multiple:false,active:true,choices:['완식','절반','거부','도시락'].map(name=>({name,active:true})),min:'',max:'',unit:'',maxLength:500},
    {name:'저녁 식사',type:'선택형',columns:3,multiple:false,active:true,choices:['완식','절반','거부','도시락','1','9'].map(name=>({name,active:true})),min:'',max:'',unit:'',maxLength:500},
    {name:'복약',type:'선택형',columns:2,multiple:false,active:true,choices:['완료','해당없음','보호자 요청(미복용)','거부'].map(name=>({name,active:true})),min:'',max:'',unit:'',maxLength:500},
    {name:'기분',type:'시각',active:true,choices:[],min:'',max:'',unit:'',maxLength:500},
    {name:'활동',type:'시간 길이',active:true,choices:[],min:'',max:'',unit:'',maxLength:500},
    {name:'물 섭취량',type:'숫자',active:true,choices:[],min:'0',max:'',unit:'mL',maxLength:500},
    {name:'asdas',type:'척도',active:true,choices:[],min:'1',max:'5',unit:'',maxLength:500}
  ];
  if (state.liveJournalBaseline!=='2026-11-08') {
    state.journalTemplates[0]={name:'플 릿 ! 1 1 1 1 & _ 1 1 1 1 1 1 1',quickChecks:8};
    state.journalTemplateConfigs[0]={labels:['자유 메모 ! _ ?＆','사회 · 정서','학습 · 활동','건강 · 안전','특이사항'],quickChecks:liveJournalQuickChecks()};
    delete state.quickChecks[0];
    state.recipients[0].templateIndex=0;
    state.liveJournalBaseline='2026-11-08';
  }
  if(!state.waterSampleBaseline){
    for(const checks of [state.journalTemplateConfigs[0]?.quickChecks,state.quickChecks[0]]){
      const example=checks?.find(q=>q.name==='dd'&&q.type==='숫자'&&q.min==='1'&&q.max==='10'&&['','5555555555'].includes(q.unit));
      if(example)Object.assign(example,{name:'물 섭취량',min:'0',max:'',unit:'mL'});
    }
    state.waterSampleBaseline=true;
  }
  if (state.liveRecipientBaseline!=='2026-11-08') {
    state.journalTemplates=[
      {name:'플 릿 ! 1 1 1 1＆_ 1 1 1 11111111',quickChecks:8},
      {name:'일지 템플릿 2',quickChecks:6},
      {name:'일지 템플릿 3',quickChecks:6},
      {name:'일지 템플릿 4',quickChecks:12},
      {name:'일지 템플릿 5',quickChecks:12}
    ];
    Object.assign(state.recipients[0],{templateIndex:0,cardMemo:'산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플산책 샘플'});
    Object.assign(state.recipients[1],{count:20,templateIndex:4,cardMemo:''});
    Object.assign(state.recipients[2],{count:7,templateIndex:3,cardMemo:'합성 테스트 대상입니다.'});
    Object.assign(state.recipients[3],{templateIndex:0,cardMemo:'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'});
    state.reportTemplates={0:'누리과정',1:'누리과정',2:'사고·사회 참여',3:'누리과정'};
    state.liveRecipientBaseline='2026-11-08';
  }
  if(state.liveStartDateBaseline!=='2026-11-08'){['2026/09/10','2026/09/10','2026/10/04','2026/10/21'].forEach((date,i)=>{if(state.recipients[i])state.recipients[i].startDate=date;});state.liveStartDateBaseline='2026-11-08';}
  if(state.journalTemplates[0]?.name==='플 릿 ! 1 1 1 1 & _ 1 1 1 1 1 1 1')state.journalTemplates[0].name='플 릿 ! 1 1 1 1＆_ 1 1 1 11111111';
  const extraQuick=(name,type,settings={})=>({name,type,active:true,choices:[],min:'',max:'',unit:'',maxLength:200,...settings});
  const liveBaseQuick=()=>quickFields.map(([name,choices],i)=>({name,type:'선택형',columns:2,multiple:i===4,active:true,choices:choices.map(name=>({name,active:true})),min:'',max:'',unit:'',maxLength:200}));
  if(!state.journalTemplateConfigs[3])state.journalTemplateConfigs[3]={labels:['자유 메모','정서','활동기록','건강 · 안전','특이사항'],quickChecks:[...liveBaseQuick(),extraQuick('T시각','시각'),extraQuick('T숫자','숫자',{min:'0',max:'10',unit:'번'}),extraQuick('T척도','척도',{min:'1',max:'5'}),extraQuick('T텍스트','텍스트'),extraQuick('T시간','시간 길이'),extraQuick('T선택2','선택형',{columns:3,choices:['가','나','다','라','마','바','사'].map(name=>({name,active:true}))})]};
  if(!state.journalTemplateConfigs[4])state.journalTemplateConfigs[4]={labels:['자유 메모','사회 · 정서','학습 · 활동','건강 · 안전','특이사항'],quickChecks:[...liveBaseQuick(),extraQuick('QA 수분','숫자',{min:'0',max:'3000',unit:'컵'}),extraQuick('QA 컨디션','척도',{min:'1',max:'5'}),extraQuick('QA 메모','텍스트'),extraQuick('QA 낮잠','시간 길이'),extraQuick('QA 기상','시각'),extraQuick('QA 간식','선택형',{columns:3,choices:['과일','과자','없음'].map(name=>({name,active:true}))})]};
  if (state.liveReportBaseline!=='2026-11-08-v3') {
    const old=CAREIT_OBSERVATION.templates[0],previousDefault={title:'누리과정',templateId:old.id,version:old.version,domains:old.domains.map(d=>({name:d.name,questions:[...d.questions]}))};
    if(!state.scoring[0]||JSON.stringify(state.scoring[0])===JSON.stringify(previousDefault))delete state.scoring[0];
    state.liveReportBaseline='2026-11-08-v3';
  }
  state.liveAppReplica = true;
  let route = '/', params = new URLSearchParams(), recipient = 0, detailRecipient = 0, recordTab = 'journals', recipientTab = 'recipients';
  const recordRange = {from:'', to:''};
  let recordPage=1;
  const reportRange = mockupReportWeek(currentDate(),-1);
  let editingRecipient = null, recipientFormSnapshot='', recipientFormReplaceConfirmed=false, editing = false, toastTimer, activePopupTrigger, footerBusinessOpen = false;
  const persist = () => store.save(JSON.stringify(state));
  if (ageBandsChanged || addedHomeSample || profileAvatarAssigned) persist();
  function toast(message,allowBlocked=false) { if(store.blocked&&!allowBlocked)return;clearTimeout(toastTimer); const el = $('#mockup-toast'); el.textContent = message; el.hidden = false; toastTimer = setTimeout(() => el.hidden = true, 3200); }
  function showStorageBlock(reason) {
    closePopups();clearTimeout(toastTimer);$('#mockup-toast').hidden=true;
    $('#mockup-storage-title').textContent=reason==='conflict'?'다른 탭에서 내용이 변경됐어요':'자동 저장을 사용할 수 없어요';
    $('#mockup-storage-message').textContent=reason==='conflict'?'다른 탭의 내용을 덮어쓰지 않도록 이 탭의 저장을 멈췄어요.':'현재 작성 내용은 이 탭에 남아 있어요. 먼저 내려받아 보관해 주세요.';
    $('.mockup-editor-status').textContent='저장이 중단됐어요. 현재 내용을 내려받아 보관할 수 있어요.';
    const modal=$('#mockup-storage-dialog');if(!modal.open)modal.showModal();
  }
  window.addEventListener('storage',event=>{if(event.storageArea===localStorage&&(event.key===STORAGE||event.key===null))store.check();});
  window.addEventListener('focus',()=>store.check());
  window.addEventListener('beforeunload',event=>{if(store.pending||journalDirty()||configurationDirty()||scorePageDirty()){event.preventDefault();event.returnValue='';}});
  $('#mockup-storage-dialog').addEventListener('cancel',event=>event.preventDefault());
  let confirmAction,pendingNavigation=null,pendingClose=null,navigationApproved=false;
  function dialog(title, html, confirmLabel, onConfirm, danger=false) {
    closePopups();
    const modal=$('#mockup-dialog');
    $('#mockup-dialog-title').textContent=title; $('#mockup-dialog-body').innerHTML=html;
    const infoClose=$('[data-dialog-close]',modal);infoClose.hidden=!!confirmLabel;if(confirmLabel)infoClose.removeAttribute('data-action');else infoClose.dataset.action='close-dialog';
    $('.dialog-actions',modal).innerHTML=confirmLabel?`<button type="button" class="button secondary" data-action="close-dialog">취소</button><button type="button" class="button ${danger?'danger':'primary'}" data-action="confirm-dialog">${escapeHTML(confirmLabel)}</button>`:'';
    confirmAction=onConfirm;
    if(!modal.open)modal.showModal();
  }
  function cancelPendingNavigation(){pendingNavigation=null;confirmAction=null;$('#mockup-dialog').close();}
  $('#mockup-dialog').addEventListener('click',event=>{if(!pendingNavigation||event.target!==event.currentTarget)return;const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)cancelPendingNavigation();});
  $('#mockup-dialog').addEventListener('cancel',event=>{if(pendingNavigation){event.preventDefault();cancelPendingNavigation();}});
  function applyDesign() {
    $('#design-overrides').textContent = `${state.color ? `:root{--primary:${state.color};--primary-action:${state.color};--primary-dark:${state.color};}` : ''}\n${state.radius != null ? `:root{--radius-card:${state.radius}px;}` : ''}\n${state.css || ''}`;
    if (state.color) $('#mockup-color').value = state.color;
    if (state.radius != null) $('#mockup-radius').value = state.radius;
    $('#mockup-radius-value').value = `${state.radius ?? 8}px`;
    $('#mockup-css').value = state.css || '';
  }
  function registerEdits() {
    // 문구 단위로만 편집 가능하게 하여 버튼, 입력 필드, 레이아웃 구조를 유지합니다.
    const elements = $$('h1,h2,h3,h4,p,strong,small,dt,dd,time,button,span,label,a', $('#root')).concat($$('dialog[open] h2,dialog[open] p,dialog[open] button,dialog[open] label'));
    const counts = {};
    for (const el of elements) {
      if (el.children.length || !el.textContent.trim() || el.closest('svg, .sr-only, dialog:not([open])')) continue;
      if (!el.dataset.editKey) {
        const scope = el.closest('.sidebar') ? 'sidebar' : el.closest('.site-footer') ? 'footer' : route;
        const signature = `${scope}|${el.tagName}|${el.textContent.trim()}`;
        counts[signature] = (counts[signature] || 0) + 1;
        el.dataset.editKey = signature + '|' + counts[signature];
      }
      if (state.edits[el.dataset.editKey] !== undefined) el.textContent = state.edits[el.dataset.editKey];
      el.contentEditable = editing ? 'true' : 'false';
      if (editing) el.setAttribute('spellcheck', 'false');
    }
  }
  function setEditMode(enabled) {
    editing = enabled; document.body.classList.toggle('mockup-editing', editing);
    $('#mockup-edit-mode').checked = editing; registerEdits();
  }
  function routeTo(hash) { if (location.hash === hash) { navigationApproved=false; render(); } else location.hash = hash; }
  function syncProfileAvatar(avatar) {
    if (!avatar) return;
    const img=document.createElement('img');
    img.alt=''; img.src=MOCKUP_PROFILE_AVATARS[state.profile.avatarIndex];
    img.addEventListener('error',()=>{avatar.textContent=mockupProfileInitial(state.profile.name);},{once:true});
    avatar.replaceChildren(img);
  }
  function syncSidebarProfile() {
    const link=$('.sidebar .account-summary'),name=state.profile.name||'';
    $('strong',link).textContent=name;
    syncProfileAvatar($('.avatar',link));
    link.setAttribute('aria-label',`계정 설정, ${name}`);
  }
  function restoreAccountName(row) {
    if (!row?.isConnected) return;
    row.classList.remove('is-editing');
    $('.account-value',row).innerHTML=`<span data-account-name>${escapeHTML(state.profile.name)}</span> <button class="button tertiary" type="button" data-action="edit-account-name">수정</button>`;
  }
  async function saveAccountName(input) {
    if (input.dataset.cancelled || input.dataset.saving) return;
    input.dataset.saving='true';
    const row=input.closest('.account-profile-row'),name=input.value.trim(),previous=state.profile.name;
    if (!name) { restoreAccountName(row); toast('이름을 입력해 주세요.'); return; }
    if (name!==previous) {
      state.profile.name=name;
      if (!await persist()) { state.profile.name=previous; restoreAccountName(row); return; }
      syncSidebarProfile();
    }
    restoreAccountName(row);
  }
  function syncSidebarTheme() {
    const dark=state.sidebarTheme==='dark',button=$('.sidebar-tools [data-action="theme"]');
    document.body.dataset.theme=dark?'dark':'light';
    const label=dark?'라이트 모드로 변경':'다크 모드로 변경';
    button.setAttribute('aria-label',label);button.dataset.tooltip=label;
  }
  function syncAppNavigation() {
    if(new URLSearchParams(location.search).get('previewMode')!=='app')return;
    document.body.classList.add('mobile-app-preview');
    const layout=$('.app-layout');let nav=$('.app-bottom-nav',layout);
    if(!nav){
      nav=document.createElement('nav');nav.className='app-bottom-nav';nav.setAttribute('aria-label','주요 메뉴');
      ['/','/journals/new','/reports','/records'].forEach(path=>nav.append($('.sidebar nav a[data-route="'+path+'"]',layout).cloneNode(true)));
      const more=document.createElement('button');more.type='button';more.dataset.action='sidebar';more.setAttribute('aria-controls','app-sidebar');more.setAttribute('aria-expanded','false');more.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg><span>더보기</span>';nav.append(more);layout.append(nav);
    }
    $$('.app-bottom-nav a',layout).forEach(a=>{const source=$('.sidebar nav a[data-route="'+a.dataset.route+'"]',layout);a.setAttribute('href',source.getAttribute('href'));const active=a.dataset.route===route;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    $('.app-bottom-nav button',layout).classList.toggle('active',!['/','/journals/new','/reports','/records'].includes(route));
  }
  function ensureMobileMenuScrim() {
    const layout=$('.app-layout');if($('.mobile-menu-scrim',layout))return;
    const scrim=document.createElement('button');scrim.type='button';scrim.className='mobile-menu-scrim';scrim.dataset.action='sidebar';scrim.setAttribute('aria-label','메뉴 닫기');layout.append(scrim);
  }
  function updateMobileScrollTitle() {
    const title=$('.mobile-scroll-title'),heading=$('#screen h1');
    if(!title)return;
    title.hidden=!matchMedia('(max-width:767px)').matches||route==='/'||!heading||heading.getBoundingClientRect().bottom>64;
  }
  window.addEventListener('scroll',updateMobileScrollTitle,{passive:true});
  window.addEventListener('resize',updateMobileScrollTitle,{passive:true});
  function render() {
    if(location.hash==='#main-content'){ $('#main-content').focus(); return; }
    if(state.couponPlusFrom<=currentDate()&&state.couponPlusUntil>=currentDate()){
      const previous=JSON.stringify(state.recipients);mockupRestorePlanRecipients(state,currentDate());
      if(JSON.stringify(state.recipients)!==previous)persist();
    }
    closePopups();
    $$('dialog[open]').forEach(x => x.close());
    const hash = location.hash.slice(1) || '/';
    [route] = hash.split('?'); params = new URLSearchParams(hash.split('?')[1] || '');
    if(['/','/journals/new','/reports'].includes(route)&&state.recipients.filter(r=>r.active&&!r.deleted).length>mockupRecipientCapacity(state,currentDate())){routeTo('#/recipients');return;}
    if(route==='/journals/new'){
      const raw=Number(params.get('recipient')||0),requested=Number.isInteger(raw)&&raw>=0?raw:0;
      if(params.has('entry')){if(!state.recipients[requested]||state.recipients[requested].deleted){routeTo('#/records');return;}}
      else {const chosen=mockupJournalRecipient(state,requested);if(chosen<0){routeTo('#/recipients');toast('일지를 작성하려면 활성 관리대상이 필요해요.');return;}if(chosen!==requested||!params.has('recipient')){params.set('recipient',String(chosen));history.replaceState(null,'','#'+route+'?'+params);}}
    }
    if(route==='/records'&&!params.has('recipient'))params.set('recipient','all');
    const pageTitles={'/':'홈','/guide':'케어릿 이용 방법','/journals/new':'일지 작성','/reports':'리포트','/records':'기록','/recipients':'대상·템플릿','/plans':'요금제','/settings':'설정','/settings/licenses':'오픈소스 라이선스','/privacy':'개인정보처리방침','/terms':'이용약관','/settings/configuration':'일지 편집','/recipients/scoring':'리포트 템플릿 편집','/notifications':'알림','/notices':'공지사항','/coupons':'쿠폰함','/invite':'친구 초대'};document.title=pageTitles[route]?`${pageTitles[route]} · 케어릿`:'케어릿';
    document.body.dataset.mobileHome=String(route==='/');
    const scrollTitle=$('.mobile-scroll-title');if(scrollTitle){scrollTitle.textContent=route==='/journals/new'&&params.has('entry')?'일지 수정':pageTitles[route]||'';scrollTitle.hidden=true;}
    const allRecords=route==='/records'&&params.get('recipient')==='all';
    recipient = allRecords?0:Math.max(0, Math.min(state.recipients.length - 1, Number(params.get('recipient') || 0)));
    const template = $$('template[data-path]').find(x => x.dataset.path === route);
    if (!template) { dialog('화면 범위 안내', '<p>이 페이지는 이번 목업에 포함되지 않았습니다. 주요 메뉴 화면에서 작업해 주세요.</p>'); return; }
    $('#screen').replaceChildren(template.content.cloneNode(true));
    const sidebarRoute = ['/settings/configuration','/recipients/scoring'].includes(route) ? '/recipients' : route.startsWith('/settings/') ? '/settings' : route;
    $$('.sidebar nav a').forEach(a => { const current = a.dataset.route === sidebarRoute; a.classList.toggle('active', current); if (current) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    const couponLink=$('.sidebar-tools a[data-route="/coupons"]');
    if(route==='/coupons')couponLink.setAttribute('aria-current','page');else couponLink.removeAttribute('aria-current');
    syncSidebarProfile();
    $$('.sidebar nav a').filter(a=>['/journals/new','/reports'].includes(a.dataset.route)).forEach(a=>a.href=`#${a.dataset.route}?recipient=${recipient}`);
    $$('[data-options="recipients"] span', $('#screen')).forEach(x => x.textContent = allRecords?'전체':state.recipients[recipient].name);
    if (route === '/') renderHome();
    if (route === '/notices') {
      $('[data-notice-title]').textContent=mockupNotice.title;
      if ($('[data-notice-summary]')) $('[data-notice-summary]').textContent=mockupNotice.summary;
    }
    if (route === '/journals/new') prepareJournal();
    if (route === '/iep') iep.mount($('.iep-page'),recipient);
    if (route === '/records') {recordTab=['journals','reports','trash'].includes(params.get('tab'))?params.get('tab'):'journals';updateRecordFilters(); renderRecords(); }
    if (route === '/recipients') {if(['recipients','journal','report'].includes(params.get('tab')))recipientTab=params.get('tab');renderRecipients();}
    if (route === '/plans') preparePlans();
    if (route === '/coupons') prepareCoupons();
    if (route === '/notifications' && state.notificationsRead) { $$('.notification-list .unread').forEach(x => x.classList.remove('unread')); $$('[data-action="read-notification"]').forEach(x => x.remove()); }
    editingCommonJournal=route==='/settings/configuration';
    commonJournalDraft=null;
    if (route === '/settings/configuration') prepareConfiguration();
    if (route === '/recipients/scoring') prepareScoring();
    if (route === '/settings') prepareSettings();
    if (route === '/reports') {
      $('[data-options="report-templates"] span').textContent=currentScoring().title;
      const summary=$('[data-report-template-summary]');
      if(summary)summary.textContent=`영역 ${currentScoring().domains.length}개 · 문항 ${currentScoring().domains.reduce((total,domain)=>total+domain.questions.length,0)}개`;
      const selected=reportRecords(recipient).find(item=>item.id===params.get('report'));
      if(selected)Object.assign(reportRange,{from:selected.from,to:selected.to});
      else if(params.get('week')==='latest')Object.assign(reportRange,mockupReportWeek(currentDate(),-1));
      else if(params.has('from')){const week=mockupReportWeek(params.get('from'));if(week&&week.from===params.get('from'))Object.assign(reportRange,week);}
      updateReportPeriod();
    }
    recordRecentVisit();
    $('.site-footer-business').hidden=route!=='/plans'&&!footerBusinessOpen;$('[data-billing-guide]').hidden=route!=='/plans';$('[data-settings-license]').hidden=route!=='/settings';
    $('.site-footer-business-toggle')?.setAttribute('aria-expanded',String(footerBusinessOpen));
    if (matchMedia('(max-width:1023px)').matches) $('.app-layout').classList.add('mockup-nav-collapsed');
    syncSidebarButton();
    ensureMobileMenuScrim();
    syncAppNavigation();
    registerEdits(); window.scrollTo(0,0); requestAnimationFrame(()=>{scaleReports();updateMobileScrollTitle();});
    if (route === '/plans' && !mockupActivePlan(state,currentDate()) && ['starter','team','pro'].includes(params.get('plan'))) openPlanCheckout(params.get('plan'));
  }
  let journalSavedSnapshot=null,journalSavedRecord=null,journalSaving=false,journalAiComparison=null;
  function setDraftStatus(message){$$('[data-draft-status]').forEach(status=>status.textContent=message);}
  function journalSnapshot(){return JSON.stringify({date:$('[data-action="date"]')?.dataset.value,values:Object.fromEntries($$('input[id],textarea[id]',$('#screen')).filter(el=>!el.id.startsWith('journal-field-label-')).map(el=>[el.id,(el.type==='radio'||el.type==='checkbox')?el.checked:el.value]))});}
  function journalHasContent(){return $$('input[id],textarea[id]',$('#screen')).some(el=>!el.id.startsWith('journal-field-label-')&&el.type!=='range'&&((el.type==='radio'||el.type==='checkbox')?el.checked:el.value.trim()!==''));}
  function journalDirty(){return route==='/journals/new'&&!!$('[data-action="save-journal"]')&&!!state.recipients[recipient]?.active&&(journalSavedSnapshot===null?journalHasContent():journalSnapshot()!==journalSavedSnapshot);}
  function updateJournalSaveState(){
    if(route!=='/journals/new')return;
    const button=$('[data-action="save-journal"]'),title=$('[data-journal-save-title]');if(!button||!title)return;
    if(!state.recipients[recipient]?.active){button.disabled=true;title.textContent='저장한 일지';setDraftStatus('비활성 관리대상의 일지는 확인만 할 수 있어요.');return;}
    const changed=journalSavedSnapshot===null?journalHasContent():journalSnapshot()!==journalSavedSnapshot;
    button.disabled=journalSaving||!changed;
    title.textContent=journalSavedSnapshot===null?'일지 저장 전':changed?'변경 내용 저장 전':'일지 저장 완료';
    if(journalSavedSnapshot!==null&&!changed)setDraftStatus('변경하면 다시 저장할 수 있어요.');
    else if(journalSavedSnapshot!==null&&changed&&params.get('entry')!==null)setDraftStatus('일지 저장을 눌러 변경 내용을 반영해 주세요.');
    else if(journalSavedSnapshot!==null&&changed&&$('[data-draft-status]')?.textContent==='변경하면 다시 저장할 수 있어요.')setDraftStatus('변경 내용은 이 브라우저에 자동 보관돼요.');
  }
  function prepareJournal() {
    journalAiComparison=null;
    journalSavedSnapshot=null;journalSavedRecord=null;journalSaving=false;
    const editIndex=params.get('entry'),savedRow=editIndex===null?null:journalRows()[Number(editIndex)],savedSchema=savedRow?.schema||state.journalSchemaSnapshots[journalSchemaKey(recipient,savedRow)];
    $('[data-quick-checks]').innerHTML = (savedSchema?.quickChecks||getQuickChecks()).map((q,i)=>q.active?quickPreview(q,i,false):'').join('');
    const dateButton=$('[data-action="date"]');dateButton.dataset.value=currentDate();dateButton.querySelector('span').textContent=formatDate(currentDate());
    const templateButton=$('[data-options="journal-templates"] span');
    if(templateButton)templateButton.textContent=state.journalTemplates[state.recipients[recipient].templateIndex||0]?.name||'일지 템플릿 1';
    const config = savedSchema?.labels||state.configuration[recipient] || journalTemplateConfig(recipient).labels;
    if(config) $$('.journal-inline-title-input').forEach((el,i) => el.value=config[i]||el.value);
    let draft = state.drafts[recipient] || {};
    if(editIndex===null&&Object.entries(draft).some(([id,value])=>!id.startsWith('journal-field-label-')&&document.getElementById(id)?.type!=='range'&&value!==false&&value!==''&&value!==undefined&&!(id.endsWith('-selected')&&value!=='true'))){setDraftStatus('자동 저장한 내용을 복원했어요 · 일지 저장 전');}
    if(editIndex===null){const requested=params.get('date'),date=state.draftDates[recipient]||(mockupJournalStartDate(requested)?requested:'');if(date){dateButton.dataset.value=date;dateButton.querySelector('span').textContent=formatDate(date);}if(date&&!mockupJournalDateAllowed(date,currentDate())){$('.journal-toolbar').insertAdjacentHTML('afterend','<aside class="journal-notice" data-journal-date-warning role="status"><div><strong>선택한 날짜에는 새 일지를 작성할 수 없어요</strong><span>오늘부터 3일 전까지 날짜를 선택해 주세요.</span></div></aside>');}}
    if (editIndex !== null) {
      const row = journalRows()[Number(editIndex)];
      if (row) {
        draft = row.values&&typeof row.values==='object' ? row.values : {'journal-raw':row[2]};
        $('.page-header h1').innerHTML = '<span class="journal-title-prefix">저장한 </span>일지 수정';
        $('[data-options="recipients"]').disabled=true;$('[data-action="date"]').disabled=true;
        setDraftStatus('수정한 내용은 일지 저장을 눌러 반영해 주세요');
        const controls=$('.journal-actions>div:last-child'),ai=$('[data-action="ai-preview"]');controls.insertAdjacentHTML('afterbegin','<button class="button danger" type="button" data-action="delete-journal">일지 삭제</button>');if(row[0]!==currentDate())ai.disabled=true;
        $('[data-action="date"] span').textContent = formatDate(row[0]);
        $('[data-action="date"]').dataset.value = row[0];
      }
    }
    $$('input[id], textarea[id]', $('#screen')).forEach(el => {
      if (draft[el.id] !== undefined) { if (el.type==='radio'||el.type==='checkbox') el.checked=draft[el.id]; else el.value=draft[el.id]; }
      updateCounter(el);
    });
    $$('.timefield').forEach(updateTimeField);
    $$('.quick-check-slider').forEach(slider=>{const selected=$('input[type="hidden"]',slider)?.value==='true';slider.classList.toggle('is-selected',selected);const input=$('input[type="range"]',slider);$$('.quick-check-slider-ticks button',slider).forEach(button=>button.setAttribute('aria-pressed',String(selected&&button.textContent.trim()===input.value)));});
    $$('.journal-inline-title-input', $('#screen')).forEach(input => {input.readOnly=true;input.tabIndex=-1;const label=$('label',input.closest('.field'));if(label)label.textContent=input.value;});
    $$('.journal-toolbar .dropdown-trigger').forEach(button=>{const value=button.querySelector('span')?.textContent||'';button.setAttribute('aria-description',value);button.title=value;});
    if(editIndex!==null&&journalRows()[Number(editIndex)])journalSavedSnapshot=journalSnapshot();
    if(editIndex!==null&&!state.recipients[recipient]?.active){$('[data-quick-checks]').disabled=true;$$('.journal-memo-fields textarea').forEach(field=>field.readOnly=true);$('[data-action="ai-preview"]').disabled=true;$('[data-options="journal-templates"]').disabled=true;}
    const aiButton=$('[data-action="ai-preview"]');if(!mockupActivePlan(state,currentDate())&&state.recipients[recipient]?.active){aiButton.disabled=false;aiButton.setAttribute('aria-description','무료 요금제에서는 사용할 수 없어요. 누르면 요금제 안내가 열려요.');}
    updateJournalSaveState();
  }
  function updateCounter(el) {
    const counter = el.id ? document.getElementById(el.id + '-limit') : null;
    if (counter && el.maxLength > 0) counter.textContent = `${el.value.length.toLocaleString('ko-KR')}/${el.maxLength.toLocaleString('ko-KR')}자`;
    if(el.matches('textarea')&&el.closest('.journal-memo-card')){el.style.height='96px';el.style.height=`${Math.min(320,Math.max(96,el.scrollHeight))}px`;}
  }
  function setJournalAiView(fieldId,view) {
    const item=journalAiComparison?.fields.find(entry=>entry.field.id===fieldId);if(!item)return;
    const {field,original}=item,container=field.parentElement,preview=container.querySelector('.journal-ai-original');
    field.hidden=view==='original';preview.hidden=view!=='original';preview.textContent=original;
    const counter=document.getElementById(`${field.id}-limit`);
    if(view==='original'&&counter&&field.maxLength>0)counter.textContent=`${original.length.toLocaleString('ko-KR')}/${field.maxLength.toLocaleString('ko-KR')}자`;
    else if(view==='result')updateCounter(field);
    $$('[data-ai-view]',container).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.aiView===view)));
  }
  function startJournalAiComparison(fields) {
    journalAiComparison={fields:fields.map(field=>({field,original:field.value}))};
    journalAiComparison.fields.forEach(({field})=>{
      const label=field.parentElement.querySelector(`label[for="${field.id}"]`)?.textContent||'일지 기록';
      field.parentElement.querySelector('.field-heading').insertAdjacentHTML('beforeend',`<div class="journal-ai-controls" role="group" aria-label="${escapeHTML(label)} 문장 비교"><button type="button" data-action="journal-ai-view" data-ai-view="original" aria-pressed="false">원문 보기</button><button type="button" data-action="journal-ai-view" data-ai-view="result" aria-pressed="true">정리본 보기</button></div>`);
      field.insertAdjacentHTML('afterend','<div class="journal-ai-original" hidden></div>');
    });
  }
  function captureDraft(save=true) {
    const values = {}; $$('input[id],textarea[id]', $('#screen')).forEach(el => values[el.id] = (el.type==='radio'||el.type==='checkbox') ? el.checked : el.value);
    if(params.get('entry')!==null)return values;
    state.drafts[recipient] = values; state.draftDates[recipient]=$('[data-action="date"]')?.dataset.value||TODAY;if(save)persist(); return values;
  }
  function journalRows(index=recipient){return allJournalRows(index).filter(row=>!(state.deletedJournalKeys||[]).includes(JSON.stringify([index,row[0],row[2]])));}
  function journalSchemaKey(index,row){return row?JSON.stringify([index,row.sourceKey||JSON.stringify([index,row[0],row[2]])]):'';}
  function preserveJournalSchemas(templateIndex){
    state.recipients.forEach((person,index)=>{if(person.deleted||(person.templateIndex||0)!==templateIndex)return;const schema={quickChecks:copy(getQuickChecks(index)),labels:copy(state.configuration[index]||journalTemplateConfig(index).labels)};journalRows(index).forEach(row=>{const key=journalSchemaKey(index,row);if(!state.journalSchemaSnapshots[key])state.journalSchemaSnapshots[key]=copy(row.schema||schema);});});
  }
  function journalTemplateRecipients(index){return state.recipients.flatMap((r,i)=>!r.deleted&&(r.templateIndex||0)===index?[{r,i,quick:!!state.quickChecks[i],labels:!!state.configuration[i]}]:[]);}
  function reportTemplateRecipients(index){const title=state.reportTemplateConfigs?.[index]?.title||LIVE_SCORING[index]?.title;return state.recipients.flatMap((r,i)=>!r.deleted&&(state.reportTemplates[i]||'누리과정')===title?[{r,i,custom:!!state.scoring[i]}]:[]);}
  function templateRecipientList(items,status){return items.length?`<ul class="template-connected-list">${items.map(item=>`<li><span>${escapeHTML(item.r.name)}</span><span>${escapeHTML(status(item))}${item.r.active?'':' · 비활성화'}</span></li>`).join('')}</ul>`:'<p class="template-connected-empty">연결된 관리대상이 없어요.</p>';}
  // 홈에서 여러 상태를 살펴볼 수 있도록 예시 대상에만 연결된 기록을 제공합니다.
  function homeExampleRows(index) {
    const week=mockupReportWeek(currentDate(),-1), dates=[];
    if(index===0||index===2){for(const offset of [0,2,4]){const day=new Date(`${week.from}T00:00:00Z`);day.setUTCDate(day.getUTCDate()+offset);dates.push(day.toISOString().slice(0,10));}}
    if(index===1)dates.push(currentDate());
    return dates.map(date=>[date,formatShortDate(date),'[목업 예시] 오늘의 돌봄 활동을 기록했어요.']);
  }
  function allJournalRows(index=recipient) {
    if(state.liveAppReplica&&index===0){const baseline = [
      ['2026-10-02','10월 2일 (금)',state.recipients[0].memo],
      ['2026-10-02','10월 2일 (금)','완식'],
      ['2026-10-02','10월 2일 (금)','ㅃㅁ 5ㅅ뮤 ㅔ갱 촏차 ㅐㅜ ㅑㅖㅁㅇ 2026-10-02. ㅜㅐㅅ ㅁ ㄱㄷ미 ㅊㅁㄱㄷ ㄱㄷ책ㅇ. [QA 5tab iPad test 2026-10-02, not a real care record]'],
      ['2026-10-02','10월 2일 (금)','[QA 2026-10-02] 5탭·작성 전환 운영 검증용 기록입니다. 실제 돌봄 기록이 아닙니다. (웹 좁은 화면)'],
      ...homeExampleRows(index),
      ...originalJournalRows
    ];
      const saved=state.savedJournals.filter(x=>x.recipient===index);
      return [...saved.map(x=>Object.assign([x.date,formatShortDate(x.date),x.text],{values:x.values,sourceKey:x.sourceKey,schema:x.schema})),...baseline.filter(row=>!saved.some(x=>x.sourceKey===JSON.stringify([index,row[0],row[2]])||(!x.sourceKey&&x.date===row[0])))].sort((a,b)=>b[0].localeCompare(a[0]));
    }
    if(state.liveAppReplica&&index===1){const texts=[
      '주말에 가족과 그림책을 보며 주인공이 친구를 만나는 장면을 읽었다. 주인공이 기뻐 보인다고 말하고 웃는 표정을 따라 했다.',
      '오전에 산책하며 본 은행나무 잎을 떠올려 노란 그림을 그렸다. 줄기를 그릴 때는 두 번 고쳐 보며 끝까지 이어 갔다.',
      '그림책에서 비가 그친 뒤 무지개가 나오는 장면을 보았다. 무지개를 보고 밝다고 말하며 노란색을 가리켰다.',
      '색종이와 색연필 중 색종이를 골라 바다 그림을 만들었다. 파란 종이를 찢어 붙인 뒤 물결 모양을 손으로 따라 그렸다.',
      "오전에 동물 그림책을 보며 토끼가 나온 장면을 오래 살펴보았다. 흰 토끼를 보고 '토끼'라고 짧게 말했다.",
      '그림책에서 버스가 나오는 장면을 보고 파란 버스를 손가락으로 가리켰다. 읽어 달라는 뜻으로 책을 앞으로 내밀었다.',
      '색연필로 창문과 나무가 있는 그림을 그렸다. 초록색을 먼저 고른 뒤 다른 색은 제안받아 사용했다.'
    ];const rows=[...homeExampleRows(index).map(row=>[row[0],row[2]]),['2026-10-21','awdaw'],...['2026-10-20','2026-10-18','2026-10-16','2026-10-15','2026-10-13','2026-10-11','2026-10-09'].map((date,i)=>[date,texts[i]]),
      ['2026-10-08','목요일. 7시 40분에 일어남. 맑고 바람이 시원함. 아침은 빵 한 조각과 우유, 방울토마토 세 개를 먹음. 토마토는 빨강이라고 먼저 말함. 9시 반에 곰 그림책을 또 꺼내 옴. 이번엔 내가 읽기 전에 스스로 표지부터 넘기며 곰이 잠자러 가는 거라고 이야기함. 마지막 쪽에서 안녕, 곰 하고 인사함. 10시부터 그림 그리기. 빨강, 파랑, 노랑, 초록, 주황'],
      ['2026-10-06','화요일. 8시에 일어남. 흐리고 선선한 날씨. 아침은 죽 한 그릇과 바나나 반 개를 먹음. 양치는 어른이 옆에서 거울을 보며 같이 함. 9시 반쯤 곰 그림책을 다시 꺼내 옴. 이번엔 먼저 표지를 보더니 곰이 낙엽 밟는 거라고 말함. 읽어 주는 동안 다음 장면을 미리 말하려 함. 10시부터 크레파스로 그림 그리기. 내가 빨강, 노랑, 초록 중에 고르라고 하니'],
      ['2026-10-04','일요일. 아침 8시 반쯤 일어남. 가을이라 아침 공기가 쌀쌀해서 얇은 겉옷을 입혀 줌. 아침은 밥 반 공기와 계란말이, 김을 먹음. 계란말이를 두 조각 더 달라고 해서 줌. 9시 반부터 거실 바닥에 앉아 좋아하는 곰 그림책을 꺼내 옴. 혼자 한 장씩 넘기며 그림을 한참 봄. 내가 읽어 주니 곰이 나오는 쪽에서 곰, 곰 하며 손가락으로 가리킴. 10시 넘어 '],
      ['2026-10-02','[QA 2026-10-02] 퀵체크 입력 방식 운영 검증용 기록입니다. 실제 돌봄 기록이 아닙니다. (단위 변경 후 메모만 수정)'],
      ['2026-09-22','[합성 QA 2026-09-22 상태 안내] 서버 버퍼 저장 완료 안내 검증입니다. 실제 돌봄 기록이 아닙니다.'],
      ...['2026-09-06','2026-09-04','2026-09-02','2026-08-31','2026-08-30','2026-08-28','2026-08-25'].map((date,i)=>[date,texts[i]])
    ].map(([date,text])=>[date,formatShortDate(date),text]);const saved=state.savedJournals.filter(x=>x.recipient===index);return [...saved.map(x=>Object.assign([x.date,formatShortDate(x.date),x.text],{values:x.values,sourceKey:x.sourceKey,schema:x.schema})),...rows.filter(row=>!saved.some(x=>x.sourceKey===JSON.stringify([index,row[0],row[2]])||(!x.sourceKey&&x.date===row[0])))].sort((a,b)=>b[0].localeCompare(a[0]));}
    if(state.liveAppReplica&&index===2){const rows=[
      ...homeExampleRows(index).map(row=>[row[0],row[2]]),
      ['2026-10-05','Android app full test 1005. Synthetic record, not a real care note. 점심을 잘 드셨고 20분 동안 걸으셨다.'],
      ['2026-10-04','ABC iPhone app test 1005. Synthetic record. Read two picture books and napped one hour.'],
      ['2026-10-01','[전수테스트 합성 기록] 아침에 크레파스로 집을 그렸다. 간식으로 바나나를 반 개 먹었다.'],
      ['2026-09-30','[전수테스트 합성기록] 오늘 식사를 잘 하셨고 산책을 30분 했다. 기분이 좋아 보이셨고 낮잠은 1시간 주무셨다.'],
      ['2026-09-29','[전수테스트 합성 기록] 오전에 종이접기를 했다. 간식으로 사과를 먹었다.'],
      ['2026-09-28','[전수테스트 합성 기록 · 실제 돌봄 기록 아님] 아침에 블록 놀이를 20분 했다. 점심은 절반 정도 먹었다. 오후에는 그림책을 두 권 읽었다.'],
      ['2026-09-27','[전수테스트 합성 기록] 같은 날짜 한도 확인용 한 줄.']
    ].map(([date,text])=>[date,formatShortDate(date),text]);const saved=state.savedJournals.filter(x=>x.recipient===index);return [...saved.map(x=>Object.assign([x.date,formatShortDate(x.date),x.text],{values:x.values,sourceKey:x.sourceKey,schema:x.schema})),...rows.filter(row=>!saved.some(x=>x.sourceKey===JSON.stringify([index,row[0],row[2]])||(!x.sourceKey&&x.date===row[0])))].sort((a,b)=>b[0].localeCompare(a[0]));}
    if(state.liveAppReplica&&index===3){const rows=[['2026-10-30','기분: 13:16 · 아침 식사: ㅇㅇ'],['2026-10-25','작성한 내용이 없어요']].map(([date,text])=>[date,formatShortDate(date),text]);const saved=state.savedJournals.filter(x=>x.recipient===index);return [...saved.map(x=>Object.assign([x.date,formatShortDate(x.date),x.text],{values:x.values,sourceKey:x.sourceKey,schema:x.schema})),...rows.filter(row=>!saved.some(x=>x.sourceKey===JSON.stringify([index,row[0],row[2]])||(!x.sourceKey&&x.date===row[0])))].sort((a,b)=>b[0].localeCompare(a[0]));}
    let original = index===0 ? originalJournalRows : index===1 ? [['2026-09-22','9월 22일 (화)','[합성 QA 2026-09-22 상태 안내] 서버 버퍼 저장 완료 안내 검증입니다. 실제 돌봄 기록이 아닙니다.']] : index===2 ? [['2026-09-14','9월 14일 (월)',state.recipients[index].memo||'']] : [];
    if(index===0){
      const today=currentDate(),from=mockupReportWeek(today,-4).from,to=mockupReportWeek(today,-1).to;
      original=[...mockupReportSampleJournals(today).map(x=>[x.date,formatShortDate(x.date),x.text]),...original.filter(row=>row[0]<from||row[0]>to)];
    }
    const saved=state.savedJournals.filter(x=>x.recipient===index);
    return [...saved.map(x=>Object.assign([x.date,formatShortDate(x.date),x.text],{values:x.values,sourceKey:x.sourceKey,schema:x.schema})),...original.filter(row=>!saved.some(x=>x.sourceKey===JSON.stringify([index,row[0],row[2]])||(!x.sourceKey&&x.date===row[0])))].sort((a,b)=>b[0].localeCompare(a[0]));
  }
  function reportRecords(index){
    const baseline=[
      [{id:'sample-v2',from:'2026-08-28',to:'2026-09-03',generated:'2026-10-02',version:2},{id:'sample',from:'2026-08-28',to:'2026-09-03',generated:'2026-09-20',version:1}],
      [{id:'picture-book',from:'2026-10-09',to:'2026-10-15',generated:'2026-10-21',version:1}],
      [{id:'test-v2',from:'2026-09-25',to:'2026-10-01',generated:'2026-10-04',version:2},{id:'test',from:'2026-09-25',to:'2026-10-01',generated:'2026-10-04',version:1}],[]
    ];
    const week=mockupReportWeek(currentDate(),-1);
    const example=index===2?{id:`home-example-${week.from}`,from:week.from,to:week.to,generated:currentDate(),version:1,days:3,mock:true,scoring:currentScoring(index)}:null;
    return [...(state.generatedReports||[]).filter(item=>item.recipient===index),...(example?[example]:[]),...(baseline[index]||[])].filter(item=>!(state.hiddenReportIds||[]).includes(`${index}:${item.id}`)&&!(state.reportRemoved?.[index]&&item.id==='sample'));
  }
  function renderRecords() {
    const list = $('[data-record-list]');
    recordPage=1;
    $('[data-record-pagination]')?.remove();
    const all=params.get('recipient')==='all';
    const recipients=all?state.recipients.flatMap((person,i)=>person.deleted?[]:[i]):[recipient];
    const target=all?state.recipients.findIndex(person=>person.active&&!person.deleted):recipient;
    const emptyState=(filtered=false)=>{
      const title=filtered?'선택한 기간에 기록이 없어요':recordTab==='journals'?'아직 작성한 일지가 없어요':recordTab==='reports'?'아직 생성된 리포트가 없어요':'휴지통이 비어 있어요';
      const description=filtered?'다른 기간을 선택해 주세요.':recordTab==='journals'?'일지를 작성하면 이곳에서 볼 수 있어요.':recordTab==='reports'?'리포트를 생성하면 이곳에서 볼 수 있어요.':'삭제한 일지와 리포트는 이곳에서 확인할 수 있어요.';
      const action=recordTab==='trash'?'':target<0?'<a class="button primary record-empty-primary" href="#/recipients">관리대상 추가</a>':recordTab==='journals'?`<a class="button primary record-empty-primary" href="#/journals/new?recipient=${target}">일지 작성</a>`:`<a class="button primary record-empty-primary" href="#/reports?recipient=${target}">리포트 생성</a>`;
      const needsReset=recordTab!=='trash'&&(filtered||!all),mobileTitle=filtered?'선택한 기간에 기록이 없어요':'선택한 관리대상의 기록이 없어요';
      const heading=needsReset?`<span class="record-mobile-empty-title">${mobileTitle}</span><span class="record-desktop-empty-title">${title}</span>`:title;
      const detail=needsReset?`<span class="record-mobile-empty-title">필터를 바꾸거나 초기화해 주세요.</span><span class="record-desktop-empty-title">${description}</span>`:description;
      return `<section class="empty-state"${filtered?' data-filter-empty hidden':''}><h2>${heading}</h2><p>${detail}</p>${action}${needsReset?'<button class="button secondary record-mobile-reset" type="button" data-action="reset-record-filters">필터 초기화</button>':''}</section>`;
    };
    const recordDate=date=>`${date.slice(0,4)!==currentDate().slice(0,4)?date.slice(0,4)+'년 ':''}${formatShortDate(date)}`;
    const renderList=(entries)=>entries.length?`<div class="record-list-heading${recordTab==='trash'?' is-trash':''}" aria-hidden="true"><span>관리대상</span><span>${recordTab==='journals'?'일지 내용':recordTab==='reports'?'리포트 기간':'삭제한 기록'}</span><span>${recordTab==='journals'?'작성 날짜':recordTab==='reports'?'생성 날짜':'삭제 날짜'}</span>${recordTab==='trash'?'<span></span>':''}</div>${entries.sort((a,b)=>b.date.localeCompare(a.date)).map(item=>item.html).join('')}`:emptyState();
    $('[data-options="record-types"] span').textContent=recordTab==='reports'?'리포트':recordTab==='trash'?'휴지통':'일지';
    if (recordTab==='journals') {
      const rows=recipients.flatMap(index=>journalRows(index).map((row,i)=>({row,i,index})));
      if(all)rows.sort((a,b)=>b.row[0].localeCompare(a.row[0]));
      const drafts=recipients.flatMap(index=>{
        const date=state.draftDates?.[index],values=state.drafts?.[index];
        if(!date||!values||!mockupHomeJournalStatus(state,index,currentDate(),getQuickChecks(index)).draft)return [];
        const preview=Object.entries(values).find(([id,value])=>(id==='journal-raw'||id.startsWith('journal-final'))&&typeof value==='string'&&value.trim())?.[1]||'퀵체크 작성 중';
        return [{date,html:`<a class="record-row journal-row" data-date="${escapeHTML(date)}" href="#/journals/new?recipient=${index}"><strong class="record-name" title="${escapeHTML(state.recipients[index].name)}">${escapeHTML(state.recipients[index].name)}</strong><div class="record-draft-preview"><span class="record-draft-badge">임시저장</span><span class="record-preview">${escapeHTML(preview)}</span></div><time datetime="${escapeHTML(date)}">${recordDate(date)}</time></a>`}];
      });
      list.innerHTML=renderList([...drafts,...rows.map(({row,i,index})=>({date:row[0],html:`<a class="record-row journal-row" data-date="${row[0]}" href="#/journals/new?recipient=${index}&entry=${i}"><strong class="record-name" title="${escapeHTML(state.recipients[index].name)}">${escapeHTML(state.recipients[index].name)}</strong><p class="record-preview">${escapeHTML(row[2])}</p><time datetime="${row[0]}">${recordDate(row[0])}</time></a>`}))]);
    } else if (recordTab==='reports') {
      const reports=recipients.flatMap(index=>reportRecords(index).map(report=>({report,index})));
      if(all)reports.sort((a,b)=>b.report.generated.localeCompare(a.report.generated));
      list.innerHTML=renderList(reports.map(({report,index})=>({date:report.generated,html:`<a class="record-row journal-row" data-date="${report.generated}" href="#/reports?recipient=${index}&amp;report=${encodeURIComponent(report.id)}"><strong class="record-name" title="${escapeHTML(state.recipients[index].name)}">${escapeHTML(state.recipients[index].name)}</strong><p class="record-preview">${recordDate(report.from)} ~ ${recordDate(report.to)}${report.version>1?` · 버전 ${report.version}`:''}</p><time datetime="${report.generated}"><span class="record-report-date-label">생성 </span>${recordDate(report.generated)}</time></a>`})));
    } else {
      list.innerHTML=renderList(state.trash.flatMap((item,i)=>all||item.recipient===recipient?[{date:item.date,html:`<article class="record-row record-trash-row" data-date="${escapeHTML(item.date)}"><strong class="record-name" title="${escapeHTML(state.recipients[item.recipient]?.name||'관리대상')}">${escapeHTML(state.recipients[item.recipient]?.name||'관리대상')}</strong><p class="record-preview"><span class="record-mobile-type">${item.type==='report'?'리포트':'일지'} · </span>${escapeHTML(item.title)} · 삭제 후 30일 동안 복원 가능</p><time datetime="${escapeHTML(item.date)}">${recordDate(item.date)}</time><div class="mockup-trash-actions"><button type="button" class="button secondary" data-action="restore-trash" data-index="${i}">복원</button><button type="button" class="button danger-soft" data-action="delete-trash" data-index="${i}">완전삭제</button></div></article>`}]:[]));
    }
    list.setAttribute('aria-label',recordTab==='reports'?'리포트 목록':recordTab==='trash'?'휴지통 목록':'일지 목록');
    if($('[data-date]',list))list.insertAdjacentHTML('afterbegin',emptyState(true));
    list.insertAdjacentHTML('afterend','<nav class="pagination records-pagination" aria-label="기록 페이지" data-record-pagination hidden></nav>');
    filterRecords();
    registerEdits();
  }
  function updateRecordFilters() {
    const button=$('.records-date-filter [data-date-range]');
    button.querySelector('span').textContent=recordRange.from?`${recordRange.from.replaceAll('-','.')} ~ ${recordRange.to.replaceAll('-','.')}`:'날짜 선택';
    button.setAttribute('aria-description',recordRange.from?`${formatDate(recordRange.from)}부터 ${formatDate(recordRange.to)}까지`:'시작 날짜와 종료 날짜를 차례로 선택하세요.');
    const reset=$('[data-action="reset-record-dates"]'),hasRange=!!recordRange.from||!!recordRange.to;
    reset.disabled=!hasRange;reset.hidden=!hasRange;
  }
  function filterRecords(resetPage=true) {
    const {from,to}=recordRange, rows=$$('[data-record-list] [data-date]');
    const matching=rows.filter(el=>!((from&&el.dataset.date<from)||(to&&el.dataset.date>to)));
    if(resetPage)recordPage=1;
    const pages=Math.ceil(matching.length/10);recordPage=Math.min(recordPage,Math.max(pages,1));
    const visible=new Set(matching.slice((recordPage-1)*10,recordPage*10));
    rows.forEach(el=>el.hidden=!visible.has(el));
    const heading=$('.record-list-heading');if(heading)heading.hidden=!matching.length;
    const empty=$('[data-filter-empty]');if(empty)empty.hidden=!!matching.length;
    const nav=$('[data-record-pagination]');if(!nav)return;
    nav.hidden=pages<=1;if(nav.hidden){nav.innerHTML='';return;}
    const start=Math.max(1,Math.min(recordPage-2,pages-4)),end=Math.min(pages,start+4);
    nav.innerHTML=`<button class="pagination-number pagination-arrow" type="button" data-action="record-page" data-page="${recordPage-1}" aria-label="이전 페이지" ${recordPage===1?'disabled':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><span class="records-mobile-page" aria-label="${pages}페이지 중 ${recordPage}페이지">${recordPage} / ${pages}</span>${Array.from({length:end-start+1},(_,i)=>{const page=start+i;return `<button class="pagination-number" type="button" data-action="record-page" data-page="${page}" aria-label="${page}페이지" ${page===recordPage?'aria-current="page"':''}>${page}</button>`;}).join('')}<button class="pagination-number pagination-arrow" type="button" data-action="record-page" data-page="${recordPage+1}" aria-label="다음 페이지" ${recordPage===pages?'disabled':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>`;
  }
  function reportDays(range=reportRange) {
    return mockupReportDays(range,journalRows());
  }
  function isSampleReportPeriod() { return reportRange.from==='2026-08-28'&&reportRange.to==='2026-09-03'; }
  function addReportJournalLink() {
    const empty=$('.reports-layout .empty-state');if(!empty)return;
    const link=document.createElement('a');link.className='button secondary report-mobile-journal-link';link.href=`#/journals/new?recipient=${recipient}`;link.textContent='일지 작성하기';empty.append(link);
  }
  function updateReportPeriod() {
    const {from,to}=reportRange,days=reportDays(),button=$('[data-date-range="report"]');
    const chosen=reportRecords(recipient).find(item=>item.id===params.get('report'));
    const eligibility=mockupReportEligibility(reportRange,currentDate(),days),domains=currentScoring().domains,validTemplate=domains.length>=3&&domains.length<=5&&domains.every(domain=>domain.questions.length>=5);
    const periodField=button.closest('.report-generation-field'),periodHeading=periodField.querySelector('.report-period-heading');
    let mobileStatus=periodField.querySelector('.report-mobile-period-status');
    if(!mobileStatus){mobileStatus=document.createElement('p');mobileStatus.className='report-mobile-period-status';mobileStatus.setAttribute('role','status');periodField.append(mobileStatus);}
    mobileStatus.textContent=chosen?'리포트 생성 완료':!from?'':!validTemplate?'리포트 채점 기준을 확인해 주세요':eligibility.reason==='insufficient'?`일지 ${days}일 · 3일 이상 필요`:eligibility.allowed?`일지 ${days}일 · 생성 가능`:eligibility.reason==='expired'?'리포트 생성 기한이 지났어요':'주간 종료 후 생성할 수 있어요';
    mobileStatus.hidden=!mobileStatus.textContent;
    const reportPage=button.closest('.reports-page');
    reportPage.classList.toggle('report-needs-journals',!chosen&&eligibility.reason==='insufficient');
    let status=periodHeading.querySelector('.report-generation-status');
    if(chosen||(eligibility.allowed&&validTemplate)){
      if(!status){status=document.createElement('p');status.className='report-generation-status';status.setAttribute('role','status');periodHeading.append(status);}
      status.textContent=chosen?`생성 완료 · 기록 ${chosen.days??reportDays(chosen)}일`:`생성 가능 · 기록 ${days}일 / 기준 3일`;
    }else status?.remove();
    const hasAvailableWeek=Array.from({length:6},(_,i)=>mockupReportWeek(currentDate(),-1-i)).some(week=>mockupReportEligibility(week,currentDate(),reportDays(week)).allowed);
    reportPage.classList.toggle('report-no-period',!!state.liveAppReplica&&!hasAvailableWeek&&!chosen);
    if(state.liveAppReplica&&!hasAvailableWeek){
      button.querySelector('span').textContent='선택 가능한 기간이 없어요';
      button.disabled=true;
      button.setAttribute('aria-description','현재 선택한 관리대상에는 리포트를 생성할 수 있는 기간이 없어요.');
      $('.report-recipient-change button').disabled=true;
      if(chosen)showStoredReport(chosen);
      else {$('.reports-layout').innerHTML='<section class="empty-state"><h2>선택할 수 있는 리포트 기간이 없어요</h2><p>주간 일지가 3일 이상이면 종료 후 한 달 이내에 생성할 수 있어요.</p></section>';mobileStatus.hidden=true;addReportJournalLink();}
      return;
    }
    $('.report-recipient-change').hidden=!!chosen;
    button.querySelector('span').textContent=from?`${from.replaceAll('-','.')} ~ ${to.replaceAll('-','.')}`:'날짜 선택';
    button.setAttribute('aria-description',from?`${formatDate(from)}부터 ${formatDate(to)}까지, 금요일부터 목요일까지 7일`:'날짜 하나를 선택하면 금요일부터 목요일까지 7일이 선택됩니다.');
    $('.report-recipient-change button').disabled=!eligibility.allowed||!validTemplate;
    if(chosen)showStoredReport(chosen);
    else if(isSampleReportPeriod()&&!state.reportRemoved?.[recipient])showStoredReport();
    else $('.reports-layout').innerHTML='<section class="empty-state"><h2>선택한 기간의 리포트가 없어요</h2><p>다른 기간을 선택하거나 새 리포트를 생성해 주세요.</p></section>';
    if(!chosen&&eligibility.reason==='insufficient')addReportJournalLink();
    requestAnimationFrame(scaleReports);
  }
  const recentVisitsKey=STORAGE+'-recent-visits';
  let recentVisits=[],hasRecentHistory=false;
  try {const raw=localStorage.getItem(recentVisitsKey);hasRecentHistory=raw!==null;const stored=JSON.parse(raw||'[]');if(Array.isArray(stored))recentVisits=stored;} catch {}
  async function deleteRecipientPermanently(index){
    if(!state.recipients[index]||state.recipients[index].deleted)return false;
    const previous=copy(state);mockupDeleteRecipientData(state,index);
    if(!await persist()){Object.keys(state).forEach(key=>delete state[key]);Object.assign(state,previous);return false;}
    recentVisits=recentVisits.filter(item=>item.recipient!==index&&(!item.hash||new URLSearchParams(item.hash.split('?')[1]||'').get('recipient')!==String(index)));
    try {localStorage.setItem(recentVisitsKey,JSON.stringify(recentVisits));} catch {}
    return true;
  }
  if(!hasRecentHistory){
    const now=Date.now(),date=state.draftDates[4],report=reportRecords(2).find(item=>item.id.startsWith('home-example-')),row=journalRows(1).find(item=>item[0]===currentDate());
    if(state.recipients[4]?.name==='음악 샘플'&&date&&state.drafts[4])recentVisits.push({type:'journal-draft',recipient:4,date,signature:'',key:`journal:4:${date}:`,at:now,demo:true});
    if(report)recentVisits.push({type:'report',recipient:2,reportId:report.id,from:report.from,key:`report:2:${report.id}`,at:now-300000,demo:true});
    if(row){const signature=mockupRecentJournalHash(row[2]);recentVisits.push({type:'journal-saved',recipient:1,date:row[0],signature,key:`journal:1:${row[0]}:${signature}`,at:now-1800000,demo:true});}
    if(recentVisits.length)try {localStorage.setItem(recentVisitsKey,JSON.stringify(recentVisits));} catch {}
  }
  function recordRecentVisit() {
    const now=Date.now(); let item;
    if(route==='/journals/new'){
      const row=params.has('entry')?journalRows()[Number(params.get('entry'))]:null;
      if(params.has('entry')&&!row)return;
      const date=row?.[0]||$('[data-action="date"]')?.dataset.value||currentDate();
      const signature=row?mockupRecentJournalHash(row[2]):'';
      item={type:row?'journal-saved':'journal-draft',recipient,date,signature,key:`journal:${recipient}:${date}:${signature}`,at:now};
    } else if(route==='/reports'){
      const report=reportRecords(recipient).find(entry=>entry.id===params.get('report'));
      if(params.has('report')&&!report)return;
      const from=report?.from||reportRange.from;
      item={type:'report',recipient,reportId:report?.id||'',from,key:`report:${recipient}:${report?.id||from}`,at:now};
    } else if(route==='/iep'){
      item={type:'iep',recipient,key:`iep:${recipient}`,at:now};
    } else {
      const pages={'/records':'기록','/recipients':'대상·템플릿','/settings/configuration':'일지 편집','/settings':'설정','/plans':'요금제','/guide':'이용 방법','/notifications':'알림','/notices':'공지사항','/coupons':'쿠폰함'};
      if(!pages[route])return;
      const query=new URLSearchParams();
      if(route==='/records'){query.set('recipient',params.get('recipient')==='all'?'all':String(recipient));query.set('tab',recordTab);}
      if(route==='/settings/configuration'){if(params.has('template'))query.set('template',params.get('template'));if(params.has('recipient'))query.set('recipient',String(recipient));}
      const hash='#'+route+(query.size?'?'+query:'');
      item={type:'page',title:pages[route],hash,key:`page:${hash}`,at:now};
    }
    recentVisits=mockupRecentVisitUpsert(recentVisits,item);
    try {localStorage.setItem(recentVisitsKey,JSON.stringify(recentVisits));} catch {}
  }
  function recentVisitDisplay(item) {
    if(!item||!Number.isFinite(item.at))return null;
    const person=state.recipients[item.recipient];
    const personName=person&&!person.deleted?person.name:'';
    let title='',detail='',href='';
    if(item.type==='journal-saved'||item.type==='journal-draft'){
      if(!personName||!mockupReportWeek(item.date))return null;
      const rows=journalRows(item.recipient);
      const index=item.type==='journal-saved'?rows.findIndex(row=>row[0]===item.date&&mockupRecentJournalHash(row[2])===item.signature):rows.findIndex(row=>row[0]===item.date);
      if(item.type==='journal-saved'&&index<0)return null;
      const hasDraft=item.type==='journal-draft'&&state.draftDates[item.recipient]===item.date&&mockupHomeJournalStatus(state,item.recipient,currentDate(),getQuickChecks(item.recipient)).draft;
      title=`${personName} · ${index>=0&&!hasDraft?'저장한 일지':'일지 작성'}`;
      detail=`${formatShortDate(item.date)} 기록${hasDraft?' · 임시저장':''}`;
      href=index>=0&&!hasDraft?`#/journals/new?recipient=${item.recipient}&entry=${index}`:`#/journals/new?recipient=${item.recipient}&date=${item.date}`;
    } else if(item.type==='report'){
      if(!personName)return null;
      const report=item.reportId&&reportRecords(item.recipient).find(entry=>entry.id===item.reportId);
      if(item.reportId&&!report)return null;
      const week=report?{from:report.from,to:report.to}:mockupReportWeek(item.from);
      if(!week||week.from!==item.from)return null;
      title=`${personName} · 주간 리포트`;detail=`${formatShortDate(week.from)} ~ ${formatShortDate(week.to)}${report?.version>1?` · 버전 ${report.version}`:''}`;
      href=report?`#/reports?recipient=${item.recipient}&report=${encodeURIComponent(report.id)}`:`#/reports?recipient=${item.recipient}&from=${week.from}`;
    } else if(item.type==='iep'){
      if(!personName)return null; title=`${personName} · IEP`;detail='월간 실행 계획';href=`#/iep?recipient=${item.recipient}`;
    } else if(item.type==='page'){
      if(!/^#\/(records|recipients|settings(?:\/configuration)?|plans|guide|notifications|notices|coupons)(?:\?|$)/.test(item.hash||''))return null;
      title=item.title;href=item.hash;
    } else return null;
    if(item.demo)detail=detail?`${detail} · 예시`:'예시';
    const elapsed=Math.max(0,Date.now()-item.at),minutes=Math.floor(elapsed/60000);
    const time=minutes<1?'방금':minutes<60?`${minutes}분 전`:elapsed<86400000?`${Math.floor(minutes/60)}시간 전`:new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'}).format(new Date(item.at));
    return {title,detail,href,time};
  }
  function renderRecentVisits(recipientFilter=null) {
    const items=recentVisits.filter(item=>recipientFilter===null||item.recipient===undefined||item.recipient===recipientFilter).map(recentVisitDisplay).filter(Boolean).slice(0,5);
    $('[data-home-reports]').innerHTML=items.map(item=>`<a class="home-report-row" href="${escapeHTML(item.href)}"><span class="home-report-copy"><strong>${escapeHTML(item.title)}</strong>${item.detail?`<small>${escapeHTML(item.detail)}</small>`:''}</span><span class="home-recent-time">${escapeHTML(item.time)}</span></a>`).join('')||'<p class="home-widget-empty">최근 방문한 화면이 없어요.</p>';
  }
  function renderHome() {
    const activePeople=state.recipients.filter(person=>person.active&&!person.deleted);
    const singlePreview=params.get('preview')==='one';
    const people=singlePreview?activePeople.filter(person=>person.name==='그림책 샘플').concat(activePeople.filter(person=>person.name!=='그림책 샘플')).slice(0,1):activePeople;
    const today=currentDate();
    const week=mockupReportWeek(today,-1);
    const statuses=people.map(person=>{const index=state.recipients.indexOf(person),rows=journalRows(index);return {...mockupHomeJournalStatus(state,index,today,getQuickChecks(index)),rows};});
    const completedCount=statuses.filter(status=>status.done||status.rows.some(row=>row[0]===today)).length;
    const dateText=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());
    $('.home-header .page-kicker').textContent=dateText;
    $('.home-header h1').textContent=`안녕하세요, ${state.profile.name}님`;
    const single=people.length===1;
    $('.home-workspace-grid').classList.toggle('is-single',single);
    $('#home-today-title').textContent=single?'오늘의 기록':'관리대상별 기록';
    if(single){
      const person=people[0],index=state.recipients.indexOf(person),{done,draft,draftDate,rows}=statuses[0];
      const todayIndex=rows.findIndex(row=>row[0]===today),completed=done||todayIndex>=0;
      const journalStatus=completed?'작성 완료':draft?'임시저장':'작성 전';
      const journalAction=completed?'저장한 일지 보기':draft?'이어서 작성':'일지 작성하기';
      const journalHref=completed&&todayIndex>=0?`#/journals/new?recipient=${index}&entry=${todayIndex}`:`#/journals/new?recipient=${index}`;
      const priorIndex=rows.findIndex(row=>row[0]<today),previousIndex=priorIndex>=0?priorIndex:(rows.length?0:-1),previous=previousIndex>=0?rows[previousIndex]:null;
      const free=singlePreview||!state.subscription||mockupSubscriptionPeriod(state.subscription,today).ended;
      const days=mockupReportDays(week,rows),existing=reportRecords(index).find(report=>report.from===week.from&&report.to===week.to);
      const eligibility=mockupReportEligibility(week,today,days),domains=currentScoring(index).domains,validTemplate=domains.length>=3&&domains.length<=5&&domains.every(domain=>domain.questions.length>=5);
      const reportStatus=free?'플러스 기능':existing?'생성 완료':eligibility.allowed?(validTemplate?'생성 가능':'템플릿 확인'):`일지 ${days}일 · 3일 필요`;
      const reportHref=free?'#/plans':existing?`#/reports?recipient=${index}&report=${encodeURIComponent(existing.id)}`:`#/reports?recipient=${index}&week=latest`;
      $('[data-home-today-summary]').textContent=singlePreview?'무료 · 1명 미리보기':'';
      $('[data-home-today-list]').innerHTML=`<div class="home-single-person"><strong>${escapeHTML(person.name)}</strong><span>관리대상</span></div><div class="home-single-rows"><div class="home-single-row home-single-today"><div><span>오늘 일지</span><strong>${journalStatus}</strong></div><a class="button primary" href="${journalHref}">${journalAction}</a></div><div class="home-single-row"><div><span>최근 일지</span><strong>${previous?escapeHTML(formatShortDate(previous[0])):'아직 저장된 일지가 없어요'}</strong></div>${previous?`<a class="home-single-link" href="#/journals/new?recipient=${index}&entry=${previousIndex}">보기</a>`:''}</div><div class="home-single-row"><div><span>주간 리포트</span><strong>${reportStatus}</strong></div><a class="home-single-link" href="${reportHref}">${free?'요금제 보기':'확인하기'}</a></div></div>`;
      renderRecentVisits(singlePreview?index:null);
      registerEdits();return;
    }
    $('[data-home-today-summary]').textContent=people.length?`오늘 일지 ${completedCount}/${people.length}명 완료`:'관리대상을 추가하고 기록을 시작해요';
    const homeRows=people.map((person,position)=>{
      const index=state.recipients.indexOf(person),{done,draft,draftDate,rows}=statuses[position];
      const todayIndex=rows.findIndex(row=>row[0]===today),completed=done||todayIndex>=0;
      const journalStatus=completed?'작성 완료':draft?'임시저장':'작성 전';
      const journalAction=completed?'보기':draft?'이어서 작성':'작성하기';
      const journalHref=completed&&todayIndex>=0?`#/journals/new?recipient=${index}&entry=${todayIndex}`:`#/journals/new?recipient=${index}`;
      const days=mockupReportDays(week,rows),existing=reportRecords(index).find(report=>report.from===week.from&&report.to===week.to);
      const eligibility=mockupReportEligibility(week,today,days),domains=currentScoring(index).domains,validTemplate=domains.length>=3&&domains.length<=5&&domains.every(domain=>domain.questions.length>=5);
      const reportStatus=existing?'생성 완료':eligibility.allowed?(validTemplate?'생성 가능':'템플릿 확인'):`일지 ${days}일 · 3일 필요`;
      const reportAction=existing?'보기':eligibility.allowed?(validTemplate?'만들기':'확인하기'):'확인하기';
      const reportHref=existing?`#/reports?recipient=${index}&report=${encodeURIComponent(existing.id)}`:`#/reports?recipient=${index}&week=latest`;
      return `<tr><th scope="row" class="home-today-name">${escapeHTML(person.name)}</th><td><a class="home-status-link" href="${journalHref}" aria-label="${escapeHTML(person.name)} 오늘 일지 ${journalStatus}, ${journalAction}"><span class="home-status-label">일지</span><span class="home-status-value${completed?' is-complete':draft?' is-ready':' is-action'}">${journalStatus}</span></a></td><td><a class="home-status-link" href="${reportHref}" aria-label="${escapeHTML(person.name)} 주간 리포트 ${reportStatus}, ${reportAction}"><span class="home-status-label">리포트</span><span class="home-status-value${existing?' is-complete':eligibility.allowed&&validTemplate?' is-ready':''}">${reportStatus}</span></a></td></tr>`;
    }).join('');
    $('[data-home-today-list]').innerHTML=homeRows?`<table class="home-status-table"><thead><tr><th scope="col">관리대상</th><th scope="col">오늘 일지</th><th scope="col">주간 리포트</th></tr></thead><tbody>${homeRows}</tbody></table>`:'<p class="home-widget-empty">아직 관리대상이 없어요. <a href="#/recipients">관리대상 추가하기</a></p>';
    renderRecentVisits();
    registerEdits();
  }
  function renderRecipients() {
    const content=$('[data-recipient-content]');
    const active=state.recipients.filter(r=>r.active&&!r.deleted).length,limit=mockupRecipientCapacity(state,currentDate());
    $$('[data-recipient-tab]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab.dataset.recipientTab===recipientTab)));
    if(recipientTab==='recipients'){
      content.innerHTML=`<div class="recipient-list-heading"><h2>관리대상 <span>${active}/${limit}명 활성</span></h2><button class="button primary add-recipient-button" type="button" data-action="add-recipient" ${active>=limit?'disabled title="현재 요금제의 관리대상 한도에 도달했어요"':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>관리대상 추가</button></div>${active>limit?`<div class="recipient-limit-notice"><div class="recipient-limit-copy"><strong>계속 이용할 관리대상을 선택해 주세요</strong><p>현재 요금제에서는 ${limit}명까지 이용할 수 있어요. 선택하지 않은 대상의 기록은 보관돼요.</p></div><button class="button secondary" type="button" data-action="choose-active-recipients">관리대상 선택</button></div>`:''}<div class="recipient-grid recipient-memo-grid">${state.recipients.map((r,i)=>{const templateName=state.journalTemplates[r.templateIndex||0]?.name||'일지 템플릿 1',reportName=state.reportTemplates[i]||'누리과정';return r.deleted?'':`<article class="card recipient-memo-card${r.active?'':' is-inactive'}"><header class="recipient-memo-card-heading"><h2 title="${escapeHTML(r.name)}">${escapeHTML(r.name)}</h2>${r.active?'':'<span class="recipient-card-status">비활성화</span>'}<button class="button secondary" type="button" data-action="edit-recipient-card" data-index="${i}" aria-label="${escapeHTML(r.name)} 편집">편집</button></header><dl class="recipient-memo-card-info"><div><dt>일지 템플릿</dt><dd title="${escapeHTML(templateName)}">${escapeHTML(templateName)}</dd></div><div><dt>리포트 템플릿</dt><dd title="${escapeHTML(reportName)}">${escapeHTML(reportName)}</dd></div></dl></article>`}).join('')}</div>`;
    }else if(recipientTab==='journal'){
      content.innerHTML=`<section class="template-library" aria-labelledby="journal-templates-title"><h2 id="journal-templates-title">일지 템플릿</h2><div class="template-library-grid">${state.journalTemplates.map((template,index)=>{const users=state.recipients.filter(r=>!r.deleted&&(r.templateIndex||0)===index).length;return `<article class="card template-library-card"><div class="template-library-content"><h3 title="${escapeHTML(template.name)}">${escapeHTML(template.name)}</h3><p>퀵체크 항목 ${template.quickChecks}개</p><p>관리대상 ${users}명 연결됨</p></div><button class="button secondary" type="button" data-action="journal-template-edit" data-index="${index}" aria-label="${escapeHTML(template.name)} 편집">편집</button></article>`;}).join('')}</div></section>`;
    }else{
      const templates=LIVE_SCORING.map((template,index)=>state.reportTemplateConfigs?.[index]||template);
      content.innerHTML=`<section class="template-library" aria-labelledby="report-templates-title"><h2 id="report-templates-title">리포트 템플릿</h2><div class="template-library-grid">${templates.map((template,index)=>{const count=template.domains.reduce((n,d)=>n+d.questions.length,0),invalid=template.domains.length<3||template.domains.length>5||template.domains.some(d=>d.questions.length<5),users=state.recipients.filter((r,i)=>!r.deleted&&(state.reportTemplates[i]||'누리과정')===template.title).length;return `<article class="card template-library-card"><div class="template-library-content"><h3 title="${escapeHTML(template.title)}">${escapeHTML(template.title)}</h3><p>영역 ${template.domains.length}개 · 문항 ${count}개 ${invalid?'<span class="template-invalid">기준 미충족</span>':''}</p><p>관리대상 ${users}명 연결됨</p></div><button class="button secondary" type="button" data-action="report-template-edit" data-index="${index}" aria-label="${escapeHTML(template.title)} 편집">편집</button></article>`;}).join('')}</div></section>`;
    }
    registerEdits();
  }
  function recipientHasCapacity(){return state.recipients.filter(r=>r.active&&!r.deleted).length<mockupRecipientCapacity(state,currentDate());}
  function prepareCoupons(){
    if(!state.couponDemoIssuedOn){state.couponDemoIssuedOn=currentDate();persist();}
    const expires=mockupBillingDate(state.couponDemoIssuedOn,3).replaceAll('.','-');
    const history=$('[data-coupon-panel="history"] .coupon-grid');
    $$('[data-coupon-panel="available"] .coupon-card').forEach((card,index)=>{
      const used=state.couponUsed?.[index],reserved=used&&used.start>currentDate(),expired=!used&&currentDate()>expires;
      const button=$('[data-action="coupon-preview"]',card);button.dataset.index=String(index);
      $('.coupon-card-meta span',card).textContent=`사용 기한: ${expires.replaceAll('-','.')}까지`;
      if(reserved){
        $('.coupon-card-meta span',card).textContent=`적용 예정: ${used.start.replaceAll('-','.')}부터`;
        button.textContent='등록 완료';button.disabled=true;
      }else if(used){
        button.textContent='사용 완료';button.disabled=true;
      }else if(expired){
        const item=card.cloneNode(true);item.classList.add('coupon-card--past');
        $('.coupon-card-main',item).insertAdjacentHTML('afterbegin','<span class="coupon-status">기간 만료</span>');
        $('[data-action="coupon-preview"]',item).remove();history.prepend(item);card.remove();
      }
    });
    if(!$('[data-coupon-panel="available"] .coupon-card'))$('[data-coupon-panel="available"] .coupon-grid').innerHTML='<p>사용 가능한 쿠폰이 없어요.</p>';
  }
  function useCoupon(index){
    const today=currentDate(),expires=mockupBillingDate(state.couponDemoIssuedOn,3).replaceAll('.','-');
    if(!Number.isInteger(index)||index<0||index>3||state.couponUsed?.[index]||today>expires){toast('사용할 수 없는 쿠폰이에요.');return;}
    const days=index===2?14:7,period=mockupCouponPeriod(state,today,days);
    if(!period){dialog('플러스 요금제 전용 쿠폰이에요','<p>팀 요금제에는 적용할 수 없어요. 쿠폰은 사용 기한까지 보관돼요.</p>');return;}
    const date=value=>value.replaceAll('-','.');
    const reserved=period.start>today;
    const renewing=reserved&&state.subscription?.autoRenew===true;
    const renewalNotice=renewing?`다음 결제일은 ${date(mockupAddDays(period.end,1))}로 미뤄지고, 이후 정기결제돼요.`:'자동 결제는 시작되지 않아요.';
    dialog(reserved?'쿠폰을 등록할까요?':'쿠폰을 사용할까요?',`<p>${index<3?`케어릿 초대 이벤트 ${index+1}차 쿠폰 · `:''}플러스를 ${days}일 이용할 수 있어요.</p><p>${date(period.start)}부터 ${date(period.end)}까지 ${reserved?'자동으로 적용돼요':'이용해요'}. ${renewalNotice}</p>`,reserved?'쿠폰 등록':'쿠폰 사용',async()=>{
      const now=currentDate(),next=mockupCouponPeriod(state,now,days);
      if(!next||next.start!==period.start||next.end!==period.end||state.couponUsed?.[index]||now>expires){toast('이용 상태가 변경됐어요. 다시 확인해 주세요.');return;}
      const previous={from:state.couponPlusFrom,until:state.couponPlusUntil,used:copy(state.couponUsed||{}),recipients:copy(state.recipients),subscription:state.subscription?copy(state.subscription):null};
      if(!state.couponPlusUntil||state.couponPlusUntil<now)state.couponPlusFrom=period.start;
      state.couponPlusUntil=period.end;(state.couponUsed||={})[index]={usedOn:now,...period};
      if(renewing)state.subscription.nextBillingOn=mockupAddDays(period.end,1).replaceAll('-','.');
      if(period.start<=now)mockupRestorePlanRecipients(state,now);
      if(!await persist()){state.couponPlusFrom=previous.from;state.couponPlusUntil=previous.until;state.couponUsed=previous.used;state.recipients=previous.recipients;state.subscription=previous.subscription;return;}
      render();toast(reserved?'쿠폰이 등록됐어요.':'쿠폰을 사용했어요.');
    });
  }
  function showRecipientLimit(){
    const limit=mockupRecipientCapacity(state,currentDate());
    dialog('관리대상 한도에 도달했어요',`<p>현재 요금제에서 관리대상은 ${limit}명까지 이용할 수 있어요.</p>`,limit===1?'요금제 보기':'관리대상 관리',()=>routeTo(limit===1?'#/plans':'#/recipients'));
  }
  function chooseActiveRecipients(){
    const limit=mockupRecipientCapacity(state,currentDate());
    const options=state.recipients.map((r,i)=>r.active&&!r.deleted?`<label><input type="checkbox" value="${i}"><span>${escapeHTML(r.name)}</span></label>`:'').join('');
    const modal=editorDialog('recipient-choose-dialog','confirm-dialog recipient-choose-dialog','계속 이용할 관리대상 선택',`<div class="recipient-choose-body"><p class="recipient-choose-description" id="recipient-choose-description">${limit}명을 선택해 주세요. 선택하지 않은 대상은 비활성화되며 기록은 보관돼요.</p><fieldset class="recipient-choose-list"><legend class="sr-only">활성 상태로 유지할 관리대상</legend>${options}</fieldset><div class="recipient-choose-footer"><p class="recipient-choose-count" role="status">0/${limit}명 선택</p><div class="dialog-actions"><button class="button secondary" type="button" data-action="close-modal" data-modal="recipient-choose-dialog">취소</button><button class="button primary" type="button" data-action="save-active-recipients" disabled>선택 완료</button></div></div></div>`);
    modal.setAttribute('aria-describedby','recipient-choose-description');
    modal.onchange=()=>{const selected=$$('input:checked',modal).length;$('.recipient-choose-count',modal).textContent=`${selected}/${limit}명 선택`;$('[data-action="save-active-recipients"]',modal).disabled=selected!==limit;};
  }
  function openRecipientForm(index=null) {
    editingRecipient=index;
    recipientFormReplaceConfirmed=false;
    const r=index===null?{}:state.recipients[index];
    $('#recipient-form').reset();
    $('#recipient-form-title').textContent=index===null?'관리대상 추가하기':'관리대상 수정';
    $('#recipient-form button[type=submit]').textContent=index===null?'추가하기':'저장하기';
    $('#recipient-name').value=r.name||'';
    $('#recipient-name-limit').textContent=`${(r.name||'').length}/20자`;
    const journalButton=$('#recipient-journal-template'),reportButton=$('#recipient-report-template');
    journalButton.dataset.value=String(r.templateIndex||0);$('span',journalButton).textContent=state.journalTemplates[r.templateIndex||0]?.name||'일지 템플릿 1';
    reportButton.dataset.value=state.reportTemplates[index]||'누리과정';$('span',reportButton).textContent=reportButton.dataset.value;
    journalButton.setAttribute('aria-label',index===null?'새 대상 일지 템플릿':'일지 템플릿');reportButton.setAttribute('aria-label',index===null?'새 대상 리포트 템플릿':'리포트 템플릿');
    $('[data-recipient-cancel]').hidden=index!==null;$('[data-action="delete-recipient"]').hidden=index===null;
    const toggle=$('[data-action="form-toggle-recipient"]');toggle.hidden=index===null||r.active;toggle.textContent='활성화';
    recipientFormSnapshot=recipientFormValues();updateRecipientFormSave();
    const modal=$('.recipient-form-dialog');modal.oncancel=e=>{e.preventDefault();closeRecipientForm();};modal.showModal();$('#recipient-name').focus();
  }
  function recipientFormValues(){return JSON.stringify([$('#recipient-name').value,$('#recipient-journal-template').dataset.value,$('#recipient-report-template').dataset.value]);}
  function closeRecipientForm(){const modal=$('.recipient-form-dialog');if(recipientFormValues()!==recipientFormSnapshot)confirmClose(()=>$('#recipient-form').requestSubmit(),()=>modal.close());else modal.close();}
  function updateRecipientFormSave(){const button=$('#recipient-form button[type=submit]');if(button)button.disabled=editingRecipient!==null&&recipientFormValues()===recipientFormSnapshot;}
  function showRecipient(index) {
    detailRecipient = index; const r = state.recipients[index];
    $('#recipient-detail-title').textContent = r.name+' 상세'; $('[data-detail-count]').textContent = r.count+'건';
    $$('.recipient-detail-overview-stats dd')[1].textContent=getQuickChecks(index).filter(q=>q.active).length+'개';
    $('[data-detail-active]').textContent = r.active?'활성화':'비활성화';
    $('[data-detail-age]').textContent = r.ageBand || '미설정';
    $('[data-action="toggle-recipient"]').textContent = '활성화';
    $('.recipient-detail-activity').hidden = r.active;
    $('#recipient-dialog a').href = '#/settings/configuration?recipient='+index;
    $('#recipient-dialog').showModal(); registerEdits();
  }
  function formatDate(value) { const [y,m,d] = value.split('-'); return `${y}년 ${Number(m)}월 ${Number(d)}일`; }
  function formatShortDate(value) { const [y,m,d] = value.split('-'); return `${Number(m)}월 ${Number(d)}일 (${'일월화수목금토'[new Date(Number(y),Number(m)-1,Number(d)).getDay()]})`; }
  let popupPanel=null, popupReposition=null;
  const iconCheck='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
  const iconPrev='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const iconNext='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const reportTemplates=LIVE_SCORING.map(t=>t.title);
  const quickTypes=['선택형','텍스트','시각','시간 길이','숫자','척도'];
  function closePopups(restoreFocus=false) {
    const trigger=activePopupTrigger;
    popupPanel?.remove(); popupPanel=null; popupReposition=null;
    if(trigger){trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-controls');}
    activePopupTrigger=null;
    if(restoreFocus&&trigger?.isConnected)trigger.focus();
  }
  function attachPopup(button,panel,maxHeight=Infinity) {
    panel.id='active-popup'; panel.classList.add('mockup-popup');
    // Popover top layer escapes card overflow and native modal stacking contexts.
    panel.setAttribute('popover','manual');
    (button.closest('dialog')||document.body).append(panel);
    panel.showPopover(); popupPanel=panel; activePopupTrigger=button;
    button.setAttribute('aria-controls',panel.id); button.setAttribute('aria-expanded','true');
    popupReposition=()=>{
      const r=button.getBoundingClientRect(), margin=8, vw=document.documentElement.clientWidth, vh=window.innerHeight;
      if(r.bottom<0||r.top>vh){closePopups();return;}
      panel.style.maxHeight=`${Math.min(maxHeight,vh-2*margin)}px`;
      const w=panel.offsetWidth,h=panel.offsetHeight;
      const below=vh-r.bottom-margin-6,above=r.top-margin-6;
      if(panel.classList.contains('datefield-panel')&&vw<768){
        panel.style.left=`${Math.max(margin,(vw-w)/2)}px`;panel.style.top=`${Math.max(margin,vh-h-16)}px`;
      }else if(panel.classList.contains('mockup-report-weeks')&&h>Math.max(above,below)){
        panel.style.left=`${Math.max(margin,Math.min(r.left,vw-w-margin))}px`;
        panel.style.top=`${Math.max(margin,Math.min(r.bottom+6,vh-h-margin))}px`;
      }else{
        const useAbove=below<h&&above>below;
        panel.style.maxHeight=`${Math.min(maxHeight,Math.max(100,useAbove?above:below))}px`;
        panel.style.left=`${Math.max(margin,Math.min(r.left,vw-w-margin))}px`;
        panel.style.top=`${Math.max(margin,useAbove?r.top-panel.offsetHeight-6:r.bottom+6)}px`;
      }
    };
    popupReposition();
  }
  document.addEventListener('scroll',e=>{if(popupPanel&&!popupPanel.contains(e.target))popupReposition?.();},true);
  window.addEventListener('resize',()=>popupReposition?.());
  function dropdown(button) {
    const wasOpen=button.getAttribute('aria-expanded')==='true';closePopups();if(wasOpen)return;
    const kind=button.dataset.options;
    if(kind==='quick-type'){openQuickTypePicker();return;}
    let choices=[];
    if(kind==='recipients'){choices=state.recipients.flatMap((r,i)=>r.active&&!r.deleted?[{label:r.name,value:i}]:[]);if(route==='/records')choices.unshift({label:'전체',value:'all'});}
    else if(kind==='record-types')choices=[{label:'일지',value:'journals'},{label:'리포트',value:'reports'},{label:'휴지통',value:'trash'}];
    else if(kind==='recipient-age-band')choices=ageBands.map(label=>({label,value:label}));
    else if(kind==='time-period')choices=['오전','오후'].map(label=>({label,value:label}));
    else if(kind==='journal-templates'||kind==='configuration-templates')choices=state.journalTemplates.map((template,value)=>({label:template.name,value}));
    else if(kind==='recipient-form-journal')choices=state.journalTemplates.map((template,value)=>({label:template.name,value}));
    else if(kind==='recipient-form-report')choices=LIVE_SCORING.map((template,i)=>state.reportTemplateConfigs?.[i]?.title||template.title).map(label=>({label,value:label}));
    else if(kind==='score-domains')choices=scoreDraft.domains.map((domain,value)=>({label:domain.name||'이름 없는 영역',value}));
    else if(kind==='report-templates'||kind==='score-templates')choices=LIVE_SCORING.map((template,value)=>({label:state.reportTemplateConfigs?.[value]?.title||template.title,value}));
    else if(kind==='quick-type')choices=quickTypes.map((label,value)=>({label,value}));
    else if(kind==='saved-journals')choices=journalRows().map((x,i)=>({label:x[1],description:'저장됨',value:i}));
    const menu=document.createElement('div');menu.className='mockup-listbox';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',button.getAttribute('aria-label')||'항목 선택');
    menu.style.minWidth=`${Math.min(Math.max(button.getBoundingClientRect().width,240),window.innerWidth-16)}px`;
    if(kind==='time-period')menu.style.minWidth=`${Math.min(Math.max(button.getBoundingClientRect().width,140),window.innerWidth-16)}px`;
    if(route==='/journals/new'&&['recipients','journal-templates'].includes(kind)){
      menu.classList.add('is-journal-select');
      menu.style.width=menu.style.minWidth;
    }
    choices.forEach((choice,i)=>{
      const selected=kind==='recipients'?(route==='/records'&&params.get('recipient')==='all'?choice.value==='all':choice.value===recipient):kind==='record-types'?choice.value===recordTab:kind==='journal-templates'?choice.value===(state.recipients[recipient].templateIndex||0):kind==='saved-journals'?String(choice.value)===params.get('entry'):kind==='recipient-form-journal'||kind==='recipient-form-report'?String(choice.value)===button.dataset.value:choice.label===button.textContent.trim();
      const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.setAttribute('aria-selected',selected);option.tabIndex=selected?0:-1;
      option.innerHTML=`<span class="mockup-option-copy"><span>${escapeHTML(choice.label)}</span>${choice.description?`<small>${escapeHTML(choice.description)}</small>`:''}</span>${selected?iconCheck:'<span class="mockup-check-space"></span>'}`;
      option.addEventListener('click',async()=>{
        closePopups(true);
        if(kind==='recipients') {
          const change=()=>{params.set('recipient',choice.value);params.delete('entry');params.delete('report');routeTo('#'+route+'?'+params);};
          if(route==='/journals/new'&&choice.value!==recipient&&journalDirty())confirmJournalNavigation(change);else if(configurationDirty())confirmConfigurationNavigation(change);else change();
        }else if(kind==='record-types'){
          recordTab=choice.value;params.set('recipient',params.get('recipient')==='all'?'all':String(recipient));params.set('tab',recordTab);routeTo('#/records?'+params);
        }else if(kind==='recipient-form-journal'||kind==='recipient-form-report'){
          button.dataset.value=String(choice.value);$('span',button).textContent=choice.label;updateRecipientFormSave();
        }else if(kind==='time-period'){
          const time=button.closest('.timefield');button.dataset.value=choice.value;$('span',button).textContent=choice.label;syncTimeInput(time);$('input[id$="-period"]',time).dispatchEvent(new Event('change',{bubbles:true}));
        }else if(kind==='recipient-age-band'){
          button.dataset.value=choice.value;$('span',button).textContent=choice.label;button.removeAttribute('aria-invalid');
          if(button.hasAttribute('data-iep-age'))iep.setAgeBand(choice.value);
          else $('#recipient-age-error').hidden=true;
        }else if(kind==='configuration-templates'){
          const change=()=>routeTo(`#/settings/configuration?recipient=${recipient}&template=${choice.value+1}`);
          if(configurationDirty())confirmConfigurationNavigation(change);else change();
        }else if(kind==='journal-templates'){
          const changed=(state.recipients[recipient].templateIndex||0)!==choice.value;
          const apply=async()=>{if(changed){preserveJournalSchemas(state.recipients[recipient].templateIndex||0);delete state.quickChecks[recipient];delete state.configuration[recipient];}state.recipients[recipient].templateIndex=choice.value;if(!await persist())return;prepareJournal();toast(`「${choice.label}」을 선택했어요.`);};
          const change=()=>{if(changed&&(state.quickChecks[recipient]||state.configuration[recipient]))dialog('일지 템플릿을 변경할까요?','<p>이 대상의 개별 설정이 선택한 공통 템플릿으로 바뀌어요. 기존에 저장한 일지는 보관돼요.</p>','변경',apply);else apply();};
          if(changed&&journalDirty())confirmJournalNavigation(change);else change();
        }else if(kind==='saved-journals'){const change=()=>routeTo(`#/journals/new?recipient=${recipient}&entry=${choice.value}`);if(journalDirty())confirmJournalNavigation(change);else change();}
        else if(kind==='report-templates')dialog('관찰 기준을 바꿀까요?',`<p>선택한 공통 템플릿을 새 리포트에 적용해요. 기존 리포트는 바뀌지 않아요.${state.scoring[recipient]?' 현재 대상의 개별 기준은 선택한 공통 기준으로 바뀌어요.':''}</p>`,'저장하고 적용',async()=>{const previous=state.scoring[recipient],oldTitle=state.reportTemplates[recipient];delete state.scoring[recipient];state.reportTemplates[recipient]=choice.label;if(!await persist()){if(previous)state.scoring[recipient]=previous;state.reportTemplates[recipient]=oldTitle;return;}button.querySelector('span').textContent=choice.label;const summary=$('.report-template-summary');if(summary)summary.textContent=`영역 ${currentScoring().domains.length}개 · 문항 ${currentScoring().domains.reduce((total,domain)=>total+domain.questions.length,0)}개`;updateReportPeriod();});
        else if(kind==='quick-type'){readQuickDraft();quickDraft.type=choice.label;drawQuickEditor();}
        else if(kind==='score-domains'){readScoreDraft();scoreCurrentDomain=Number(choice.value);drawScoring();$('.score-area-mobile-select .dropdown-trigger')?.focus();}
        else if(kind==='score-templates'){readScoreDraft();const change=()=>{editingReportTemplateIndex=choice.value;scoreDraft=copy(state.reportTemplateConfigs?.[choice.value]||scoreSeed(choice.value));scoreSnapshot=JSON.stringify(scoreDraft);scoreCurrentDomain=0;if(route==='/recipients/scoring'){params.set('template',String(choice.value));history.replaceState(null,'','#'+route+'?'+params);}drawScoring();};if(JSON.stringify(scoreDraft)!==scoreSnapshot)confirmScoreNavigation(change);else change();}
      });menu.append(option);
    });
    if(!choices.length)menu.innerHTML='<p class="mockup-popup-empty">선택할 기록이 없어요.</p>';
    attachPopup(button,menu,kind==='saved-journals'?350:Infinity);
    const options=$$('button:not(:disabled)',menu);let index=Math.max(0,options.findIndex(x=>x.getAttribute('aria-selected')==='true'));
    const focusOption=i=>{index=(i+options.length)%options.length;options.forEach((x,j)=>x.tabIndex=j===index?0:-1);options[index]?.focus();};
    if(options.length)focusOption(index);
    menu.addEventListener('keydown',e=>{
      if(!options.length)return;
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();focusOption(e.key==='Home'?0:e.key==='End'?options.length-1:index+(e.key==='ArrowDown'?1:-1));}
      else if(e.key==='Tab')closePopups(true);
      else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey){const match=options.findIndex((c,i)=>i!==index&&c.textContent.startsWith(e.key));if(match>=0)focusOption(match);}
    });
  }
  function datePicker(button) {
    const wasOpen=button.getAttribute('aria-expanded')==='true';closePopups();if(wasOpen)return;
    const isRange=button.hasAttribute('data-date-range');
    const isReportRange=button.dataset.dateRange==='report';
    const isJournalDate=route==='/journals/new'&&!isRange&&params.get('entry')===null;
    const iepRange=button.dataset.dateRange?.startsWith('iep-')?button.dataset.dateRange.slice(4):null;
    const activeRange=iepRange?iep.getRange(iepRange):isReportRange?reportRange:recordRange;
    const commitRange=(from,to)=>{
      Object.assign(activeRange,{from,to});
      closePopups(true);
      if(iepRange){iep.commitRange(iepRange);}
      else if(isReportRange){
        const existing=reportRecords(recipient).find(item=>item.from===from&&item.to===to);if(existing)params.set('report',existing.id);else params.delete('report');
        history.replaceState(null,'','#'+route+(params.size?'?'+params:''));
        updateReportPeriod();recordRecentVisit();registerEdits();
      }else {updateRecordFilters();filterRecords();}
    };
    const value=button.dataset.value||'';
    let rangeFrom=activeRange.from,rangeTo=activeRange.to,selectingEnd=false;
    if(iepRange){rangeFrom=iep.validDate(rangeFrom)?rangeFrom:'';rangeTo=iep.validDate(rangeTo)?rangeTo:'';}
    const today=isReportRange||isJournalDate?currentDate():TODAY;
    const latestWeek=isReportRange?mockupReportWeek(today,-1):null;
    let firstWeek=latestWeek;
    if(isReportRange){
      while(mockupReportEligibility(mockupReportWeek(firstWeek.from,-1),today).allowed)firstWeek=mockupReportWeek(firstWeek.from,-1);
    }
    const min=isJournalDate?mockupJournalStartDate(today):(firstWeek?.from||''),max=iepRange?'2100-12-31':latestWeek?.to||today;
    let initialDate=(isRange?rangeFrom:value)||latestWeek?.from||TODAY;
    if(isReportRange&&!mockupReportEligibility(mockupReportWeek(initialDate),today).allowed)initialDate=latestWeek.from;
    if(initialDate>max)initialDate=max;
    if(isJournalDate&&initialDate<min)initialDate=min;
    let [year,month]=initialDate.split('-').map(Number);month--;
    const popup=document.createElement('div');popup.className='datefield-panel mockup-date-popup'+(isRange?' mockup-date-range':'')+(isReportRange?' mockup-report-weeks':'');popup.setAttribute('role','dialog');popup.setAttribute('aria-label',isReportRange?'리포트 주간 선택':isRange?'날짜 기간 선택':`${button.getAttribute('aria-label')||'날짜'} 선택`);
    const dateKey=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const allowed=date=>{
      if(isJournalDate)return mockupJournalDateAllowed(date,today);
      if(!isReportRange)return date<=max;
      const week=mockupReportWeek(date);
      return mockupReportEligibility(week,currentDate(),reportDays(week)).allowed||(mockupReportEligibility(week,currentDate()).allowed&&reportRecords(recipient).some(item=>item.from===week.from&&item.to===week.to));
    };
    const canInspect=date=>isReportRange&&matchMedia('(max-width:767px)').matches&&!allowed(date)&&mockupReportEligibility(mockupReportWeek(date),currentDate(),reportDays(mockupReportWeek(date))).reason==='insufficient';
    const paintRange=(preview='')=>{
      if(!isRange)return;
      let from=rangeFrom,end=selectingEnd?(preview>=rangeFrom?preview:rangeFrom):rangeTo;
      let unavailable=false;
      if(isReportRange){
        const week=mockupReportWeek(preview);
        const days=reportDays(week),status=mockupReportEligibility(week,currentDate(),days);
        const existing=week&&mockupReportEligibility(week,currentDate()).allowed&&reportRecords(recipient).some(item=>item.from===week.from&&item.to===week.to);
        unavailable=status.reason==='insufficient'&&!existing;
        from=status.allowed||unavailable||existing?week.from:'';end=status.allowed||unavailable||existing?week.to:'';
        $('[data-report-week-summary]',popup).textContent=week?`${formatShortDate(week.from)} ~ ${formatShortDate(week.to)}`:'금~목 7일 · 종료 후 1개월 이내';
        const notice=$('[data-report-week-notice]',popup);
        notice.textContent=existing?'이미 만든 리포트가 있어요\n날짜를 눌러 리포트를 볼 수 있어요':status.reason==='empty'&&matchMedia('(max-width:767px)').matches?'날짜를 눌러 생성 가능 여부를 확인해 주세요.':mockupReportNotice(status,days);
        notice.classList.toggle('is-available',status.allowed||!!existing);
      }
      $$('[data-date]',popup).forEach(day=>{
        const date=day.dataset.date,inRange=!!from&&date>=from&&date<=(end||from);
        day.classList.toggle('is-in-range',inRange&&!unavailable);
        day.classList.toggle('is-range-start',date===from&&!unavailable);
        day.classList.toggle('is-range-end',!!from&&date===(end||from)&&!unavailable);
        if(isReportRange){
          day.classList.toggle('is-unavailable-week',inRange&&unavailable);
          day.classList.toggle('is-unavailable-start',date===from&&unavailable);
          day.classList.toggle('is-unavailable-end',!!from&&date===end&&unavailable);
        }
        day.setAttribute('aria-pressed',String(isReportRange?!day.disabled&&!!rangeFrom&&date>=rangeFrom&&date<=rangeTo:inRange));
      });
    };
    const pick=date=>{
      if(!allowed(date)){if(canInspect(date))paintRange(date);return;}
      if(isReportRange){const week=mockupReportWeek(date);commitRange(week.from,week.to);return;}
      if(isRange){
        if(!selectingEnd||date<rangeFrom){rangeFrom=date;rangeTo='';selectingEnd=true;draw(date);return;}
        commitRange(rangeFrom,date);return;
      }
      else {button.dataset.value=date;button.querySelector('span').textContent=formatDate(date);}
      closePopups(true);filterRecords();
      if(route==='/journals/new'){$('[data-journal-date-warning]')?.remove();captureDraft();recordRecentVisit();setDraftStatus('작성 내용은 이 브라우저에 자동 보관돼요.');updateJournalSaveState();}
    };
    const draw=(focusDate)=>{
      const days=new Date(year,month+1,0).getDate(),offset=isReportRange?0:new Date(year,month,1).getDay();
      const dates=isReportRange?mockupReportCalendarDates(year,month):Array.from({length:days},(_,i)=>dateKey(year,month,i+1));
      const nextFirst=dateKey(new Date(year,month+1,1).getFullYear(),new Date(year,month+1,1).getMonth(),1);
      const rangeHeader=isReportRange?'<button type="button" class="mobile-report-calendar-close" aria-label="닫기">×</button><p class="date-range-prompt" role="status">리포트 주간을 선택해 주세요.</p><p class="date-range-summary" data-report-week-summary></p>':isRange?`<p class="date-range-prompt" role="status">${selectingEnd?'종료 날짜를 선택해 주세요.':'시작 날짜를 선택해 주세요.'}</p><p class="date-range-summary">${rangeFrom?`${formatDate(rangeFrom)} → ${rangeTo?formatDate(rangeTo):'종료일 선택'}`:'시작일 → 종료일 순서로 선택해 주세요.'}</p>`:isJournalDate?'<p class="date-range-summary">오늘부터 3일 전까지 작성할 수 있어요</p>':'';
      popup.innerHTML=`${rangeHeader}<div class="datefield-head"><button type="button" aria-label="이전 달" ${min&&dateKey(year,month,1)<=min?'disabled':''}>${iconPrev}</button><strong aria-live="polite">${year}년 ${month+1}월</strong><button type="button" aria-label="다음 달" ${nextFirst>max?'disabled':''}>${iconNext}</button></div><div class="datefield-grid" role="group" aria-label="${year}년 ${month+1}월">${[...'일월화수목금토'].map(x=>`<span class="datefield-weekday" aria-hidden="true">${x}</span>`).join('')}${'<span aria-hidden="true"></span>'.repeat(offset)}${dates.map(date=>{
        const [,dateMonth,dateDay]=date.split('-').map(Number),adjacent=dateMonth!==month+1;
        const week=isReportRange?mockupReportWeek(date):null;
        const count=isReportRange?reportDays(week):0;
        const withinPeriod=isReportRange&&mockupReportEligibility(week,currentDate()).allowed;
        const reason=isReportRange?mockupReportNotice(mockupReportEligibility(week,currentDate(),count),count).replace('\n',' '):'';
        return `<button type="button" class="datefield-day${date===value?' is-picked':''}${date===today?' is-today':''}${adjacent?' is-adjacent-month':''}${isReportRange&&dateDay===1&&date!==dates[0]?' is-month-boundary':''}${withinPeriod?' is-report-period':''}" data-date="${date}" aria-label="${formatDate(date)}" ${reason?`aria-description="${reason}"`:''} aria-pressed="${date===value}" ${date===today?'aria-current="date"':''} ${canInspect(date)?'aria-disabled="true"':allowed(date)?'':'disabled'} tabindex="-1">${dateDay}</button>`;
      }).join('')}</div>${isReportRange?'<p class="report-week-notice" data-report-week-notice role="status" aria-live="polite" aria-atomic="true"></p>':isRange?'<button type="button" class="button tertiary" data-clear-date>날짜 초기화</button>':'<button type="button" class="datefield-today">날짜 초기화</button>'}`;
      $('.datefield-head [aria-label="이전 달"]',popup).onclick=()=>{month--;if(month<0){month=11;year--;}draw();};
      $('.datefield-head [aria-label="다음 달"]',popup).onclick=()=>{month++;if(month>11){month=0;year++;}draw();};
      $$('[data-date]',popup).forEach(b=>b.onclick=()=>pick(b.dataset.date));
      $('.mobile-report-calendar-close',popup)?.addEventListener('click',()=>closePopups(true));
      $('.datefield-today',popup)?.addEventListener('click',()=>pick(today));
      $('[data-clear-date]',popup)?.addEventListener('click',()=>commitRange('',''));
      paintRange(focusDate||(isReportRange?rangeFrom:''));
      const focus=$(`[data-date="${focusDate||initialDate}"]:not(:disabled)`,popup)||$('[data-date]:not(:disabled)',popup);
      if(focus){focus.tabIndex=0;if(popup.isConnected)focus.focus();}
      popupReposition?.();
    };
    draw();attachPopup(button,popup);($('[data-date][tabindex="0"]',popup)||$('button:not(:disabled)',popup))?.focus();
    popup.addEventListener(isReportRange?'pointermove':'pointerover',e=>{const day=e.target.closest('.datefield-day');if(isReportRange){if(day)paintRange(day.dataset.date);}else if(selectingEnd&&day&&!day.disabled)paintRange(day.dataset.date);});
    if(isReportRange)popup.addEventListener('pointerdown',e=>{const day=e.target.closest('.datefield-day');if(day)paintRange(day.dataset.date);});
    popup.addEventListener('pointerleave',()=>{if(selectingEnd||isReportRange)paintRange(isReportRange?rangeFrom:'');});
    popup.addEventListener('keydown',e=>{
      const current=e.target.dataset.date;
      if(current&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)){
        e.preventDefault();const [y,m,d]=current.split('-').map(Number);const next=new Date(y,m-1,d);
        if(e.key==='PageUp'||e.key==='PageDown'){const step=e.key==='PageUp'?-1:1;next.setDate(1);next.setMonth(next.getMonth()+step);next.setDate(Math.min(d,new Date(next.getFullYear(),next.getMonth()+1,0).getDate()));}
        else next.setDate(d+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-next.getDay(),End:6-next.getDay()})[e.key]);
        let key=dateKey(next.getFullYear(),next.getMonth(),next.getDate());
        if(isReportRange&&(e.key==='PageUp'||e.key==='PageDown'))key=key<min?min:key>max?max:key;
        if(isReportRange){
          const step=['ArrowLeft','ArrowUp','Home','PageUp'].includes(e.key)?-1:1;
          while(key>=min&&key<=max&&!allowed(key)&&!canInspect(key)){
            next.setTime(new Date(`${key}T00:00:00`).getTime());next.setDate(next.getDate()+step);
            key=dateKey(next.getFullYear(),next.getMonth(),next.getDate());
          }
        }
        if(!allowed(key)&&!canInspect(key))return;
        if(!$(`[data-date="${key}"]`,popup)){const target=new Date(`${key}T00:00:00Z`);year=target.getUTCFullYear();month=target.getUTCMonth();}
        draw(key);
      }
      if(e.key==='Tab'){const nodes=$$('button:not(:disabled)',popup).filter(b=>b.tabIndex>=0);const i=nodes.indexOf(document.activeElement);if((e.shiftKey&&i===0)||(!e.shiftKey&&i===nodes.length-1)){e.preventDefault();closePopups(true);}}
    });
  }
  async function saveJournal() {
    if(journalSaving)return;
    if(!state.recipients[recipient]?.active||state.recipients[recipient]?.deleted){toast('활성 관리대상만 일지를 저장할 수 있어요.');return;}
    const date=$('[data-action="date"]').dataset.value||currentDate();
    if(params.get('entry')===null&&!mockupJournalDateAllowed(date,currentDate())){toast('오늘부터 3일 전까지 날짜를 선택해 주세요.');$('[data-action="date"]').focus();return;}
    const invalidTime=$$('.timefield',$('[data-quick-checks]')).find(time=>{const parts=$$('input[type="number"]',time);return parts.some(part=>part.value!=='')&&(!$('input[type="hidden"]',time).value);});
    if(invalidTime){const error=$('.timefield-error',invalidTime);error.hidden=false;const invalid=$$('input[type="number"]',invalidTime).find(part=>!part.value||!part.checkValidity());invalid?.setAttribute('aria-invalid','true');invalid?.focus();return;}
    const invalidDuration=$$('.quick-check-duration input[type="number"]',$('[data-quick-checks]')).find(input=>input.value!==''&&!input.checkValidity());
    if(invalidDuration){invalidDuration.setAttribute('aria-invalid','true');$('.quick-check-duration-error',invalidDuration.closest('.quick-check-duration')).hidden=false;invalidDuration.focus();return;}
    const row=params.get('entry')===null?null:journalRows()[Number(params.get('entry'))],schema=row?.schema||state.journalSchemaSnapshots[journalSchemaKey(recipient,row)]||{quickChecks:copy(getQuickChecks()),labels:copy(state.configuration[recipient]||journalTemplateConfig(recipient).labels)};
    const values=captureDraft(false); let text=Object.entries(values).filter(([id,v])=>id.startsWith('journal-')&&!id.includes('field-label')&&typeof v==='string'&&v.trim()).map(([,v])=>v).join('\n');
    if(!text.trim())text=schema.quickChecks.flatMap((q,i)=>{if(!q.active)return [];const field=$$('.quick-check-field',$('[data-quick-checks]')).find(x=>$('legend span',x)?.textContent===q.name);if(!field)return [];const checked=$$('input:checked',field).map(x=>x.value);let value=checked.join(', ');if(!value&&q.type==='시각')value=$('input[type="hidden"]',field)?.value||'';if(!value&&q.type==='시간 길이')value=$$('input[type="number"]',field).map((x,j)=>x.value?`${x.value}${['시간','분','초'][j]}`:'').filter(Boolean).join(' ');if(!value&&q.type==='척도'&&$('.quick-check-slider',field)?.classList.contains('is-selected'))value=$('input[type="range"]',field).value;if(!value&&q.type!=='척도')value=$('textarea,input[type="number"]',field)?.value||'';return value?[`${q.name}: ${value}`]:[];}).join(' · ');
    if(!text.trim()){toast('작성한 내용을 입력해 주세요.');$('#journal-raw').focus();return;}
    const sourceKey=row?(row.sourceKey||JSON.stringify([recipient,row[0],row[2]])):null;
    let existing=(journalSavedRecord?.recipient===recipient&&journalSavedRecord.date===date?journalSavedRecord:null)||state.savedJournals.find(x=>x.recipient===recipient&&(row?(row.sourceKey?x.sourceKey===row.sourceKey:x.date===row[0]&&x.text===row[2]):x.date===date&&!x.sourceKey));
    const previousRecord=existing?{...existing}:null,previousCount=state.recipients[recipient].count;
    if(existing)Object.assign(existing,{text,values,schema});else{existing={recipient,date,text,values,schema,...(sourceKey?{sourceKey}:{})};state.savedJournals.unshift(existing);if(!row)state.recipients[recipient].count++;}
    const previousDraft=state.drafts[recipient],previousDraftDate=state.draftDates[recipient];if(!row){delete state.drafts[recipient];delete state.draftDates[recipient];}
    const savedSnapshot=journalSnapshot();journalSaving=true;updateJournalSaveState();
    if(!await persist()){if(previousRecord)Object.assign(existing,previousRecord);else state.savedJournals=state.savedJournals.filter(item=>item!==existing);state.recipients[recipient].count=previousCount;if(!row&&!state.drafts[recipient]){state.drafts[recipient]=previousDraft;state.draftDates[recipient]=previousDraftDate;}journalSaving=false;setDraftStatus('저장하지 못했어요. 다시 시도해 주세요.');updateJournalSaveState();return;}
    journalSavedRecord=existing;journalSavedSnapshot=savedSnapshot;journalSaving=false;updateJournalSaveState();toast('일지를 저장했어요.');return true;
  }
  async function exportHTML({save=true}={}) {
    if(document.querySelector('script[src]')){
      if(save){toast('careit-mockup.html 단일 파일을 열면 수정본을 한 파일로 저장할 수 있어요.');return;}
      const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');
      a.href=url;a.download='careit-mockup-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('현재 내용 JSON 내려받기를 요청했어요.',true);return;
    }
    state.css=$('#mockup-css').value;applyDesign();if(save&&!await persist())return;
    const clone=document.documentElement.cloneNode(true);
    clone.querySelector('#saved-design').textContent=JSON.stringify({...state,exportId:Date.now().toString(36)}).replace(/</g,'\\u003c');
    clone.querySelector('#screen').innerHTML='';
    clone.querySelector('#mockup-panel').setAttribute('hidden','');clone.querySelector('#mockup-toggle').setAttribute('aria-expanded','false');clone.querySelector('#mockup-toast').setAttribute('hidden','');
    clone.querySelector('body').classList.remove('mockup-editing');clone.querySelector('#mockup-edit-mode').removeAttribute('checked');
    clone.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));
    clone.querySelectorAll('dialog').forEach(el=>el.removeAttribute('open'));
    clone.querySelectorAll('[aria-expanded="true"][data-options],[aria-expanded="true"][data-action="date"]').forEach(el=>{el.setAttribute('aria-expanded','false');el.removeAttribute('aria-controls');});
    clone.querySelectorAll('.mockup-popup,#quick-dialog,#scoring-dialog,#consent-dialog,#checkout-dialog,#checkout-policy-dialog,#team-invite-dialog').forEach(el=>el.remove());
    const blob=new Blob(['<!doctype html>\n'+clone.outerHTML],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=save?'careit-mockup-edited.html':'careit-mockup-backup.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('현재 내용을 담은 HTML 내려받기를 요청했어요.',true);
  }
  document.addEventListener('click',async e=>{
    const editable=e.target.closest('[contenteditable="true"]'); if(editing&&editable){e.preventDefault();return;}
    if(e.composedPath().some(el=>el.classList?.contains('mockup-popup')))return;
    const typeCard=e.target.closest('#quick-type-picker .quick-check-type-card');
    if(typeCard){const input=$('input[name="quick-type-choice"]',typeCard);if(e.target===input)return;e.preventDefault();input.focus({preventScroll:true});if(!input.checked){input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}return;}
    const choiceLabel=e.target.closest('.journal-choice-chips label');
    if(choiceLabel&&e.target.tagName!=='INPUT'){const radio=$('input[type="radio"]',choiceLabel);if(radio?.checked){e.preventDefault();radio.checked=false;radio.dispatchEvent(new Event('change',{bubbles:true}));return;}}
    const quickClear=e.target.closest('.quick-check-clear');
    if(quickClear){const field=quickClear.closest('.quick-check-field')||$('.quick-check-field',quickClear.closest('.configuration-card,.quick-check-type-card'));if(!field)return;const time=$('.timefield',field);if(time){$$('input',time).forEach(input=>{input.value='';input.removeAttribute('aria-invalid');});updateTimeField(time);$('.timefield-error',time).hidden=true;$('input[type="hidden"]',time).dispatchEvent(new Event('change',{bubbles:true}));return;}$$('input',field).forEach(input=>{if(input.type==='range')input.value=input.min;else if(input.type==='radio'||input.type==='checkbox')input.checked=false;else input.value='';input.removeAttribute('aria-invalid');input.dispatchEvent(new Event('change',{bubbles:true}));});const durationError=$('.quick-check-duration-error',field);if(durationError)durationError.hidden=true;$('.quick-check-slider',field)?.classList.remove('is-selected');$$('.quick-check-slider-ticks button',field).forEach(b=>b.setAttribute('aria-pressed','false'));return;}
    const tick=e.target.closest('.quick-check-slider-ticks button');
    if(tick){const slider=tick.closest('.quick-check-slider'),input=$('input[type="range"]',slider),selected=$('input[type="hidden"]',slider);slider.classList.add('is-selected');selected.value='true';input.value=tick.textContent.trim();$$('.quick-check-slider-ticks button',slider).forEach(b=>b.setAttribute('aria-pressed',String(b===tick)));input.dispatchEvent(new Event('change',{bubbles:true}));return;}
    const navigation=e.target.closest('a[href^="#/"]');
    if(navigation&&journalDirty()){e.preventDefault();const href=navigation.getAttribute('href');confirmJournalNavigation(()=>routeTo(href));return;}
    if(navigation&&configurationDirty()){e.preventDefault();const href=navigation.getAttribute('href');confirmConfigurationNavigation(()=>routeTo(href));return;}
    if(navigation&&scorePageDirty()){e.preventDefault();const href=navigation.getAttribute('href');confirmScoreNavigation(()=>routeTo(href));return;}
    if(navigation?.closest('.sidebar')&&matchMedia('(max-width:767px)').matches){$('.app-layout').classList.add('mockup-nav-collapsed');syncSidebarButton();}
    const option=e.target.closest('[data-options]');if(option){dropdown(option);return;}
    if(!e.target.closest('.dropdown,.datefield,.mockup-popup'))closePopups();
    const detail=e.target.closest('[data-detail]');if(detail){showRecipient(Number(detail.dataset.detail));return;}
    const recipientTabButton=e.target.closest('[data-recipient-tab]');
    if(recipientTabButton){recipientTab=recipientTabButton.dataset.recipientTab;renderRecipients();return;}
    const button=e.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action;
    if(handlePopupAction(action,button,e))return;
    if(action==='coupon-tab'){const tab=button.dataset.tab;$$('[data-action="coupon-tab"]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.tab===tab)));$$('[data-coupon-panel]').forEach(panel=>panel.hidden=panel.dataset.couponPanel!==tab);}
    else if(action==='coupon-preview')useCoupon(Number(button.dataset.index));
    else if(action==='edit-journal-title'){const input=document.getElementById(button.getAttribute('aria-controls'));input.focus();input.select();}
    else if(action==='reset-record-dates'){recordRange.from='';recordRange.to='';updateRecordFilters();filterRecords();}
    else if(action==='reset-record-filters'){recordRange.from='';recordRange.to='';params.set('recipient','all');params.set('tab',recordTab);routeTo('#/records?'+params);}
    else if(action==='record-page'){recordPage=Number(button.dataset.page);filterRecords(false);$('[data-record-list]')?.scrollIntoView({block:'start'});}
    else if(action==='sidebar'){$('.app-layout').classList.toggle('mockup-nav-collapsed');syncSidebarButton();}
    else if(action==='theme'){const previous=state.sidebarTheme;state.sidebarTheme=document.body.dataset.theme==='dark'?'light':'dark';syncSidebarTheme();if(!await persist()){state.sidebarTheme=previous;syncSidebarTheme();}}
    else if(action==='business-info'){footerBusinessOpen=!footerBusinessOpen;$('.site-footer-business').hidden=!footerBusinessOpen;button.setAttribute('aria-expanded',String(footerBusinessOpen));}
    else if(action==='date')datePicker(button);
    else if(action==='close-editor'){$('#mockup-panel').hidden=true;$('#mockup-toggle').setAttribute('aria-expanded','false');setEditMode(false);}
    else if(action==='apply-css'){state.css=$('#mockup-css').value;applyDesign();if(await persist())toast('CSS를 적용했어요.');}
    else if(action==='export-html')exportHTML();
    else if(action==='storage-backup')exportHTML({save:false});
    else if(action==='storage-reload')location.reload();
    else if(action==='close-dialog'){pendingNavigation=null;pendingClose=null;confirmAction=null;$('#mockup-dialog').close();}
    else if(action==='save-journal')saveJournal();
    else if(action==='delete-journal'){const row=journalRows()[Number(params.get('entry'))];if(row)dialog('일지를 삭제할까요?','<p>저장한 일지는 30일 동안 휴지통에서 복원할 수 있어요</p>','삭제',async()=>{const key=JSON.stringify([recipient,row[0],row[2]]);(state.deletedJournalKeys||=[]).push(key);state.trash.push({type:'journal',recipient,date:row[0],title:row[1]+' 일지',key});if(!await persist())return;routeTo('#/records?recipient='+recipient);toast('일지를 휴지통으로 옮겼어요.');},true);}
    else if(action==='home-guide')dialog('케어릿 이용 방법','<ol class="home-guide-steps"><li><strong>관리대상 선택</strong><p>기록할 관리대상과 일지 템플릿을 선택해요.</p></li><li><strong>일지 작성</strong><p>퀵체크와 오늘의 일지를 작성하고 저장해요.</p></li><li><strong>주간 리포트 확인</strong><p>금요일부터 목요일까지 기록한 일지가 3일 이상이면 다음 날부터 리포트를 만들 수 있어요.</p></li></ol>');
    else if(action==='add-recipient'){if(!recipientHasCapacity())showRecipientLimit();else openRecipientForm();}
    else if(action==='cancel-recipient')closeRecipientForm();
    else if(action==='choose-active-recipients')chooseActiveRecipients();
    else if(action==='save-active-recipients'){const modal=$('#recipient-choose-dialog'),selected=$$('input:checked',modal).map(el=>Number(el.value)),limit=mockupRecipientCapacity(state,currentDate());if(selected.length!==limit)return;const previous=copy(state.recipients);state.recipients.forEach((r,i)=>{if(r.active&&!r.deleted&&!selected.includes(i)){r.active=false;r.pausedByPlanLimit=true;}});if(!await persist()){state.recipients=previous;return;}modal.close();renderRecipients();toast('관리대상을 선택했어요.');}
    else if(action==='form-toggle-recipient'){const r=state.recipients[editingRecipient];if(r.active)return;if(!r.active&&!recipientHasCapacity()){showRecipientLimit();return;}dialog(r.active?'관리대상을 비활성화할까요?':'관리대상을 활성화할까요?',`<p>${r.active?'홈과 기록 작성 목록에서 제외되며, 기존 기록은 보관돼요.':'홈과 기록 작성 목록에 다시 표시돼요.'}${recipientFormValues()!==recipientFormSnapshot?' 입력한 변경 사항은 저장되지 않아요.':''}</p>`,r.active?'비활성화':'활성화',async()=>{if(!r.active&&!recipientHasCapacity()){showRecipientLimit();return;}const previous=copy(r);r.active=!r.active;delete r.pausedByPlanLimit;if(!await persist()){Object.assign(r,previous);return;}$('.recipient-form-dialog').close();renderRecipients();});}
    else if(action==='delete-recipient'){const index=editingRecipient,r=state.recipients[index];dialog(`${r.name}을 삭제하시겠습니까?`,'<p>이 관리대상의 일지·리포트·IEP 계획과 개별 설정이 함께 삭제되며 복원할 수 없어요. 공통 템플릿은 유지돼요.</p>','삭제',async()=>{if(!await deleteRecipientPermanently(index))return;$('.recipient-form-dialog').close();renderRecipients();toast('관리대상을 삭제했어요.');},true);}
    else if(action==='close-recipient')$('#recipient-dialog').close();
    else if(action==='edit-recipient'){$('#recipient-dialog').close();openRecipientForm(detailRecipient);}
    else if(action==='edit-recipient-card'){openRecipientForm(Number(button.dataset.index));}
    else if(action==='toggle-template-name'){const form=$('#configuration-template-name'),input=$('#template-name'),open=!form.classList.contains('is-renaming');if(!open){const index=Math.max(0,Number(params.get('template')||1)-1);input.value=state.journalTemplates[index]?.name||'';input.dispatchEvent(new Event('input',{bubbles:true}));}form.classList.toggle('is-renaming',open);button.textContent=open?'취소':'이름 수정';button.setAttribute('aria-expanded',String(open));if(open)input.focus();}
    else if(action==='journal-template-edit'){routeTo(`#/settings/configuration?recipient=${recipient}&template=${Number(button.dataset.index)+1}`);}
    else if(action==='report-template-edit'){openScoring(true,Number(button.dataset.index));}
    else if(action==='edit-account-name'){const row=button.closest('.account-profile-row'),value=$('.account-value',row);row.classList.add('is-editing');value.innerHTML=`<input id="account-name" aria-label="이름" maxlength="100" autocomplete="name" value="${escapeHTML(state.profile.name)}"><button class="button secondary" type="button" data-action="cancel-account-name">취소</button>`;const input=$('#account-name',row);input.focus();input.setSelectionRange(input.value.length,input.value.length);}
    else if(action==='cancel-account-name'){const row=button.closest('.account-profile-row'),input=$('#account-name',row);if(input)input.dataset.cancelled='true';restoreAccountName(row);}
    else if(action==='copy-account-invite'){
      const input=$('#account-invite-url');let copied=false;
      try {if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(input.value);copied=true;}}catch{}
      if(!copied){input.focus();input.select();try{copied=document.execCommand('copy');}catch{}}
      toast(copied?'초대 링크를 복사했어요.':'링크를 선택해 직접 복사해 주세요.');
    }
    else if(action==='password-preview')openPasswordDialog();
    else if(action==='password-toggle'){const input=document.getElementById(button.getAttribute('aria-controls')),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'숨기기':'보기';button.setAttribute('aria-label',`${input.dataset.label} ${show?'숨기기':'보기'}`);}
    else if(action==='marketing-consent'){
      const next=!state.marketingConsent;
      dialog(next?'마케팅 정보 수신에 동의할까요?':'마케팅 정보 수신 동의를 철회할까요?',`<p>${next?'서비스·기능 업데이트와 혜택 안내를 받을 수 있어요.':'광고성 정보 수신이 중단돼요. 서비스 이용은 계속할 수 있어요.'}</p>`,next?'동의하기':'철회하기',async()=>{state.marketingConsent=next;if(!await persist())return;prepareSettings();toast(next?'수신 동의 상태를 표시했어요.':'수신 동의를 철회했어요.');});
    }
    else if(action==='read-notification'){button.closest('li').classList.remove('unread');button.remove();}
    else if(action==='read-all'){state.notificationsRead=true;if(!await persist())return;$$('.notification-list .unread').forEach(x=>x.classList.remove('unread'));$$('[data-action="read-notification"]').forEach(x=>x.remove());}
    else if(action==='print-report')window.print();
    else if(action==='word-report')downloadReportWord();
  });
  document.addEventListener('submit',async e=>{
    e.preventDefault();
    if(e.target.id==='quick-edit-form'){saveQuick();return;}
    if(e.target.id==='score-edit-form'){saveScoring();return;}
    if(e.target.id==='configuration-form'){saveConfiguration();return;}
    if(e.target.id==='mock-password-form'){await changeMockPassword(e.target);return;}
    if(e.target.id==='configuration-template-name'){const index=Math.max(0,Number(params.get('template')||1)-1),name=$('#template-name').value.trim();if(!name)return;state.journalTemplates[index].name=name;if(await persist()){ $('button[type=submit]',e.target).disabled=true;$('[data-options="configuration-templates"] span').textContent=name;e.target.classList.remove('is-renaming');const rename=$('[data-action="toggle-template-name"]',e.target);rename.textContent='이름 수정';rename.setAttribute('aria-expanded','false');if(matchMedia('(max-width:767px)').matches)rename.focus();toast('템플릿 이름을 저장했어요.');}return;}
    if(e.target.id!=='recipient-form')return;
    if(editingRecipient===null&&!recipientHasCapacity()){showRecipientLimit();return;}
    const name=$('#recipient-name').value.trim();if(!name){$('#recipient-name').focus();return;}
    const templateIndex=Number($('#recipient-journal-template').dataset.value),reportTemplate=$('#recipient-report-template').dataset.value;
    const index=editingRecipient===null?state.recipients.length:editingRecipient;
    const journalChanged=editingRecipient!==null&&(state.recipients[index].templateIndex||0)!==templateIndex,reportChanged=editingRecipient!==null&&(state.reportTemplates[index]||'누리과정')!==reportTemplate;
    const replacesOverrides=(journalChanged&&(state.quickChecks[index]||state.configuration[index]))||(reportChanged&&state.scoring[index]);
    if(replacesOverrides&&!recipientFormReplaceConfirmed){dialog('템플릿을 변경할까요?','<p>해당 대상의 개별 설정이 선택한 공통 템플릿으로 바뀌어요. 기존에 저장한 기록은 보관돼요.</p>','변경',()=>{recipientFormReplaceConfirmed=true;$('#recipient-form').requestSubmit();});return;}
    recipientFormReplaceConfirmed=false;
    const previous=editingRecipient===null?null:{recipient:{...state.recipients[index]},quick:state.quickChecks[index],configuration:state.configuration[index],scoring:state.scoring[index],report:state.reportTemplates[index]};
    if(editingRecipient!==null){if(journalChanged){preserveJournalSchemas(state.recipients[index].templateIndex||0);delete state.quickChecks[index];delete state.configuration[index];}if(reportChanged)delete state.scoring[index];Object.assign(state.recipients[index],{name,templateIndex});}else state.recipients.push({name,templateIndex,count:0,date:currentDate().replaceAll('-','/'),active:true});
    state.reportTemplates[index]=reportTemplate;
    if(!await persist()){if(previous){state.recipients[index]=previous.recipient;for(const [key,value] of [['quickChecks',previous.quick],['configuration',previous.configuration],['scoring',previous.scoring],['reportTemplates',previous.report]]){if(value===undefined)delete state[key][index];else state[key][index]=value;}}else{state.recipients.pop();delete state.reportTemplates[index];}return;}$('.recipient-form-dialog').close();renderRecipients();toast('관리대상을 저장했어요.');
  });
  const timeInputValues=new WeakMap();
  document.addEventListener('focusout',e=>{if(e.target.id==='account-name'){if(e.relatedTarget?.matches('[data-action="cancel-account-name"]'))return;saveAccountName(e.target);}else if(e.target.matches('[data-action="cancel-account-name"]')){const row=e.target.closest('.account-profile-row');if(row&&!row.contains(e.relatedTarget)){const input=$('#account-name',row);if(input)saveAccountName(input);}}});
  document.addEventListener('keydown',e=>{if(e.target.id!=='account-name'||e.isComposing)return;if(e.key==='Enter'){e.preventDefault();e.target.blur();}else if(e.key==='Escape'){e.preventDefault();e.target.dataset.cancelled='true';restoreAccountName(e.target.closest('.account-profile-row'));}});
  document.addEventListener('keydown',e=>{if(e.key==='Tab')document.documentElement.dataset.inputModality='keyboard';},true);
  document.addEventListener('pointerdown',()=>{document.documentElement.dataset.inputModality='pointer';},true);
  document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-action="cancel-account-name"]'))e.preventDefault();},true);
  const allowedTimeInput=input=>input.value===''?!input.validity.badInput:/^\d{1,2}$/.test(input.value)&&Number(input.value)<=Number(input.max);
  document.addEventListener('focusin',e=>{if(e.target.matches('.timefield input[type="number"]'))timeInputValues.set(e.target,allowedTimeInput(e.target)?e.target.value:'');});
  document.addEventListener('beforeinput',e=>{if(e.target.matches('.timefield input[type="number"]')&&e.inputType==='insertText'&&e.data&&!/^\d+$/.test(e.data))e.preventDefault();});
  document.addEventListener('input',async e=>{
    const el=e.target;
    if(el.closest('#mock-password-form')){el.removeAttribute('aria-invalid');const message=$('[data-password-message]',el.form);message.hidden=true;message.textContent='';}
    if(el.matches('.timefield input[type="number"]')){if(!allowedTimeInput(el))el.value=timeInputValues.get(el)??'';else timeInputValues.set(el,el.value);syncTimeInput(el.closest('.timefield'));}
    if(el.matches('.quick-check-duration input[type="number"]')){el.removeAttribute('aria-invalid');const duration=el.closest('.quick-check-duration');if($$('input',duration).every(input=>input.checkValidity()))$('.quick-check-duration-error',duration).hidden=true;}
    if(el.id==='quick-min'||el.id==='quick-max'){const error=$('#quick-scale-error');if(error)error.hidden=true;$('#quick-min')?.removeAttribute('aria-invalid');$('#quick-max')?.removeAttribute('aria-invalid');}
    if(el.closest('#recipient-form'))updateRecipientFormSave();
    if(el.closest('#score-edit-form')){updateScoreSave();$$('[data-score-status]').forEach(status=>status.textContent='');}
    if(el.closest('#configuration-form'))$('#configuration-form button[type=submit]').disabled=JSON.stringify($$('#configuration-form input').map(x=>x.value))===configSnapshot;
    if(el.id==='template-name')$('#configuration-template-name button[type=submit]').disabled=!el.value.trim()||el.value.trim()===(state.journalTemplates[Math.max(0,Number(params.get('template')||1)-1)]?.name||'');
    if(el.type==='range'&&el.closest('.quick-check-slider')){const slider=el.closest('.quick-check-slider');slider.classList.add('is-selected');$('input[type="hidden"]',slider).value='true';$$('.quick-check-slider-ticks button',slider).forEach(button=>button.setAttribute('aria-pressed',String(button.textContent.trim()===el.value)));}
    if(el.dataset.editKey&&editing){state.edits[el.dataset.editKey]=el.textContent;persist();return;}
    updateCounter(el);
    if(route==='/journals/new'&&el.closest('#screen')){updateJournalSaveState();if(params.get('entry')===null){captureDraft(false);const saved=await persist();setDraftStatus(saved?'작성 내용은 이 브라우저에 자동 보관돼요.':'자동 보관이 중단됐어요.');updateJournalSaveState();}}
  });
  document.addEventListener('change',e=>{if(e.target.matches('.timefield input[type="number"]'))syncTimeInput(e.target.closest('.timefield'));if(route==='/journals/new'&&e.target.closest('[data-quick-checks]')){captureDraft();updateJournalSaveState();}if(e.target.name==='quick-type-choice')$$('.quick-check-type-card',$('#quick-type-picker')).forEach(card=>card.classList.toggle('is-selected',!!$('input[name="quick-type-choice"]',card)?.checked));});
  function finishScoreTitle(input){
    const editor=input.closest('.score-title-editor'),label=$('.score-title-text',editor),edit=$('.score-title-edit',editor),done=$('.score-title-done',editor);
    const name=input.value.trim();
    if(!name){input.focus();$$('[data-score-status]').forEach(status=>status.textContent='이름을 입력해 주세요.');return;}
    input.value=name;
    if(input.id==='score-template-title'){input.hidden=true;label.hidden=false;edit.hidden=false;done.hidden=true;$('.dropdown-trigger span',label).textContent=name;}
    else {const index=Number(input.id.replace('score-domain-title-',''));const option=$(`[data-action="score-select-domain"][data-index="${index}"] span`);if(option)option.textContent=name;const selected=$('.score-area-mobile-select .dropdown-trigger span');if(index===scoreCurrentDomain&&selected)selected.textContent=name;}
    updateScoreSave();$$('[data-score-status]').forEach(status=>status.textContent=JSON.stringify(scoreDraft)===scoreSnapshot?'':'변경 사항은 저장을 눌러 적용해 주세요.');
  }
  document.addEventListener('focusout',e=>{if(!e.target.matches('#score-template-title, [id^="score-domain-title-"]')||e.relatedTarget?.matches('[data-action="score-title-done"]'))return;finishScoreTitle(e.target);});
  document.addEventListener('keydown',e=>{if(e.target.matches('#score-template-title, [id^="score-domain-title-"]')&&e.key==='Enter'&&!e.isComposing){e.preventDefault();if(e.target.id.startsWith('score-domain-title-'))e.target.blur();else finishScoreTitle(e.target);}});
  document.addEventListener('focusout',e=>{const time=e.target.closest('.timefield');if(!time||time.contains(e.relatedTarget))return;const parts=$$('input[type="number"]',time),hasValue=parts.some(input=>input.value!==''),invalid=hasValue&&parts.some(input=>input.value===''||!input.checkValidity());parts.forEach(input=>{if(invalid&&(input.value===''||!input.checkValidity()))input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');});$('.timefield-error',time).hidden=!invalid;});
  document.addEventListener('keydown',e=>{if(e.key===' '&&e.target.matches('.journal-choice-chips input[type="radio"]:checked')){e.preventDefault();e.target.checked=false;e.target.dispatchEvent(new Event('change',{bubbles:true}));return;}const handle=e.target.closest('[data-quick-move]');if(handle&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const index=Number(handle.dataset.quickMove);moveQuick(index,index+(['ArrowUp','ArrowLeft'].includes(e.key)?-1:1));}});
  let draggedQuickIndex=null;
  document.addEventListener('dragstart',e=>{const card=e.target.closest('[data-quick-order]');if(card)draggedQuickIndex=Number(card.dataset.quickOrder);});
  document.addEventListener('dragover',e=>{if(draggedQuickIndex!==null&&e.target.closest('[data-quick-order]'))e.preventDefault();});
  document.addEventListener('drop',e=>{const card=e.target.closest('[data-quick-order]');if(card&&draggedQuickIndex!==null){e.preventDefault();moveQuick(draggedQuickIndex,Number(card.dataset.quickOrder));}draggedQuickIndex=null;});
  document.addEventListener('dragend',()=>{draggedQuickIndex=null;});
  let recipientSwipeStart=null;
  document.addEventListener('touchstart',e=>{
    if(route!=='/recipients'||!matchMedia('(max-width:767px)').matches||e.touches.length!==1||!e.target.closest('.recipients-page')||e.target.closest('input,textarea,select,dialog,.mockup-popup')){recipientSwipeStart=null;return;}
    recipientSwipeStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  document.addEventListener('touchcancel',()=>{recipientSwipeStart=null;},{passive:true});
  document.addEventListener('touchend',e=>{
    const start=recipientSwipeStart;recipientSwipeStart=null;
    if(!start||e.touches.length||e.changedTouches.length!==1||route!=='/recipients'||!matchMedia('(max-width:767px)').matches)return;
    const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;
    if(Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.5)return;
    const tabs=['recipients','journal','report'],next=tabs.indexOf(recipientTab)+(dx<0?1:-1);
    if(next>=0&&next<tabs.length)$(`[data-recipient-tab="${tabs[next]}"]`)?.click();
  },{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!popupPanel&&matchMedia('(max-width:767px)').matches&&!$('.app-layout').classList.contains('mockup-nav-collapsed')){$('.app-layout').classList.add('mockup-nav-collapsed');syncSidebarButton();return;}if(popupPanel){e.preventDefault();e.stopImmediatePropagation();closePopups(true);return;}if(editing){setEditMode(false);toast('문구 편집을 마쳤어요.');}}},true);
  $('#mockup-toggle').addEventListener('click',()=>{const panel=$('#mockup-panel');panel.hidden=!panel.hidden;$('#mockup-toggle').setAttribute('aria-expanded',String(!panel.hidden));});
  $('#mockup-edit-mode').addEventListener('change',e=>setEditMode(e.target.checked));
  $('#mockup-color').addEventListener('input',e=>{state.color=e.target.value;applyDesign();persist();});
  $('#mockup-radius').addEventListener('input',e=>{state.radius=Number(e.target.value);applyDesign();persist();});
  window.addEventListener('hashchange',event=>{
    if(navigationApproved){navigationApproved=false;render();return;}
    const next=new URL(event.newURL).hash||'#/',previous=new URL(event.oldURL).hash||'#/';
    const guard=journalDirty()?confirmJournalNavigation:configurationDirty()?confirmConfigurationNavigation:scorePageDirty()?confirmScoreNavigation:null;
    if(guard&&next!==previous){history.replaceState(null,'',previous);guard(()=>routeTo(next));return;}
    render();
  });window.addEventListener('resize',scaleReports);
  function syncSidebarButton(){const collapsed=$('.app-layout').classList.contains('mockup-nav-collapsed'),button=$('.nav-handle');button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?'메뉴 열기':'메뉴 접기');button.title=collapsed?'메뉴 열기':'메뉴 접기';$('.app-bottom-nav button')?.setAttribute('aria-expanded',String(!collapsed));}
  matchMedia('(max-width:1023px)').addEventListener('change', e => { $('.app-layout').classList.toggle('mockup-nav-collapsed',e.matches);syncSidebarButton(); });
  function scaleReports(){ const viewport=$('.configured-report-viewport');if(!viewport)return;const pages=$('.configured-report-pages'),style=getComputedStyle(viewport),width=viewport.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);const scale=Math.min(1,Math.max(0,width)/794);pages.style.setProperty('--configured-report-scale',scale); }
  function prepareConfiguration(){
    const common=editingCommonJournal;
    if(common&&!commonJournalDraft){
      const templateIndex=Math.max(0,Number(params.get('template')||1)-1);
      commonJournalDraft=copy(state.journalTemplateConfigs[templateIndex]||state.commonTemplates?.journal||{labels:['자유 메모','사회 · 정서','학습 · 활동','건강 · 안전','특이사항'],quickChecks:defaultQuickChecks()});
      commonJournalSnapshot=JSON.stringify(commonJournalDraft);
    }
    const templateIndex=Math.max(0,Number(params.get('template')||1)-1),templateName=state.journalTemplates[templateIndex]?.name||'일지 템플릿';
    $('#template-name').value=templateName;$('[data-options="configuration-templates"] span').textContent=templateName;
    const labels=commonJournalDraft?.labels||state.configuration[recipient]||journalTemplateConfig(recipient).labels;
    $('[data-config-labels]').innerHTML=labels.map((label,i)=>`<div class="field"><span class="field-heading"><label for="configuration-label-${i}">항목 ${i+1}</label> <small class="field-limit" id="configuration-label-${i}-limit">${label.length}/12자</small></span><input id="configuration-label-${i}" maxlength="12" aria-describedby="configuration-label-${i}-limit" value="${escapeHTML(label)}"></div>`).join('');
    const dragIcon='<svg viewBox="30 -930 900 900" fill="currentColor" aria-hidden="true"><path d="M200-360q-17 0-28.5-11.5T160-400q0-17 11.5-28.5T200-440h560q17 0 28.5 11.5T800-400q0 17-11.5 28.5T760-360H200Zm0-160q-17 0-28.5-11.5T160-560q0-17 11.5-28.5T200-600h560q17 0 28.5 11.5T800-560q0 17-11.5 28.5T760-520H200Z"/></svg>';
    const plusIcon='<svg viewBox="30 -930 900 900" fill="currentColor" aria-hidden="true"><path d="M440-440v120q0 17 11.5 28.5T480-280q17 0 28.5-11.5T520-320v-120h120q17 0 28.5-11.5T680-480q0-17-11.5-28.5T640-520H520v-120q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v120H320q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440h120Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>';
    $('[data-config-quick]').innerHTML=configurationQuickChecks().map((q,i)=>`<article class="configuration-card" draggable="true" data-quick-order="${i}"><button class="configuration-drag-handle" type="button" aria-label="${escapeHTML(q.name)} 순서 바꾸기" aria-description="${i+1}번째예요. 끌어서 옮기거나 방향키로 옮길 수 있어요." data-quick-move="${i}">${dragIcon}</button><header><div><strong>${escapeHTML(q.name)}</strong></div><div class="configuration-card-actions"><button class="button secondary" type="button" data-action="edit-quick-check" data-index="${i}">편집</button></div></header><fieldset class="journal-quick-checks configuration-preview">${quickPreview(q,i,true)}</fieldset></article>`).join('')+`<button class="configuration-create-card" type="button" aria-label="새로 만들기" data-action="new-quick-check">${plusIcon}</button>`;
    $$('.configuration-card').forEach(card=>{const legend=$('legend',card),actions=$('.configuration-card-actions',card),clear=legend?.querySelector('.quick-check-clear-slot'),counter=card.querySelector('.quick-check-text-field .field-heading');if(clear)actions.prepend(clear);if(counter)actions.prepend(counter.querySelector('small'));counter?.remove();legend?.remove();});
    configSnapshot=JSON.stringify(labels);
    $('#configuration-form button[type=submit]').disabled=true;
  }
  let configSnapshot='',quickDraft=null,quickIndex=null,quickSnapshot='',scoreDraft=null,scoreSnapshot='';
  let editingCommonJournal=false,commonJournalDraft=null,commonJournalSnapshot='',editingCommonReport=false,editingReportTemplateIndex=null;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const configurationQuickChecks=()=>commonJournalDraft?.quickChecks||getQuickChecks();
  async function moveQuick(from,to,confirmed=false){const items=configurationQuickChecks();if(to<0||to>=items.length||from===to)return;const index=Math.max(0,Number(params.get('template')||1)-1);if(!confirmed){const affected=journalTemplateRecipients(index).filter(item=>!item.quick).length;dialog('퀵체크 순서를 바꿀까요?',`<p>공통 퀵체크를 사용하는 ${affected}명에게 적용돼요. 기존 일지는 그대로 남아요.</p>`,'변경',()=>moveQuick(from,to,true));return;}preserveJournalSchemas(index);const labels=$$('#configuration-form input').map(x=>x.value),[item]=items.splice(from,1);items.splice(to,0,item);state.journalTemplateConfigs[index]=copy(commonJournalDraft);if(!await persist())return;commonJournalSnapshot=JSON.stringify(commonJournalDraft);prepareConfiguration();$$('#configuration-form input').forEach((el,i)=>el.value=labels[i]);$('#configuration-form button[type=submit]').disabled=JSON.stringify(labels)===configSnapshot;$(`[data-quick-move="${to}"]`)?.focus();}
  async function saveConfiguration(){
    const values=$$('#configuration-form input').map(x=>x.value.trim());
    if(values.some(x=>!x)){toast('영역 이름을 모두 입력해 주세요.');return;}
    const templateIndex=Math.max(0,Number(params.get('template')||1)-1);
    const previous={templates:copy(state.journalTemplateConfigs),schemas:copy(state.journalSchemaSnapshots),draft:commonJournalDraft&&copy(commonJournalDraft),configuration:copy(state.configuration)};
    if(editingCommonJournal){preserveJournalSchemas(templateIndex);commonJournalDraft.labels=values;state.journalTemplateConfigs[templateIndex]=copy(commonJournalDraft);}else state.configuration[recipient]=values;
    if(!await persist()){state.journalTemplateConfigs=previous.templates;state.journalSchemaSnapshots=previous.schemas;commonJournalDraft=previous.draft;state.configuration=previous.configuration;return;}
    if(editingCommonJournal)commonJournalSnapshot=JSON.stringify(commonJournalDraft);
    prepareConfiguration();toast('일지 기록 항목을 저장했어요.');
  }
  function defaultQuickChecks(){
    return quickFields.map(([name,choices],i)=>({name,type:'선택형',multiple:i===4,active:true,choices:choices.map(name=>({name,active:true})),min:'',max:'',unit:'',maxLength:500}));
  }
  function journalTemplateConfig(index=recipient){
    const templateIndex=state.recipients[index]?.templateIndex||0;
    return state.journalTemplateConfigs[templateIndex]||{labels:['자유 메모','사회 · 정서','학습 · 활동','건강 · 안전','특이사항'],quickChecks:defaultQuickChecks()};
  }
  function getQuickChecks(index=recipient){return state.quickChecks[index]||journalTemplateConfig(index).quickChecks||defaultQuickChecks();}
  function quickPreview(q,i,preview){
    const prefix=preview?'preview':'quick',id=`${prefix}-${i}`;
    const attrs=`id="${id}" aria-label="${escapeHTML(q.name)}"`;
    let input='';
    if(q.type==='선택형')input=`<div class="journal-choice-chips" style="--chip-cols:${q.columns||2}">${q.choices.filter(c=>c.active).map((c,j)=>`<label><input class="sr-only" type="${q.multiple?'checkbox':'radio'}" name="${id}" id="${id}-${j}" value="${escapeHTML(c.name)}"><span>${escapeHTML(c.name)}</span></label>`).join('')}</div>`;
    else if(q.type==='텍스트')input=`<span class="field-heading"><small class="field-limit" id="${id}-limit">0/${Number(q.maxLength||500).toLocaleString('ko-KR')}자</small></span><textarea ${attrs} rows="2" maxlength="${q.maxLength||500}" aria-describedby="${id}-limit"></textarea>`;
    else if(q.type==='시각'){input=`<div class="quick-check-time"><div class="timefield"><input type="hidden" id="${id}" value=""><input type="hidden" id="${id}-period" value=""><div class="timefield-parts"><button type="button" class="dropdown-trigger timefield-period" data-options="time-period" data-value="오전" aria-label="${escapeHTML(q.name)} 오전 또는 오후" aria-haspopup="listbox" aria-expanded="false"><span>오전</span></button><label class="timefield-part"><input id="${id}-hour" type="number" min="1" max="12" step="1" inputmode="numeric" placeholder="--" aria-label="${escapeHTML(q.name)} 시" aria-describedby="${id}-time-error"><span aria-hidden="true">시</span></label><label class="timefield-part"><input id="${id}-minute" type="number" min="0" max="59" step="1" inputmode="numeric" placeholder="--" aria-label="${escapeHTML(q.name)} 분" aria-describedby="${id}-time-error"><span aria-hidden="true">분</span></label></div><p class="timefield-error field-error" id="${id}-time-error" role="alert" hidden>시는 1~12, 분은 0~59로 입력해 주세요.</p></div></div>`;}
    else if(q.type==='시간 길이')input=`<div class="quick-check-duration"><div class="quick-check-duration-row">${['시간','분','초'].map((unit,j)=>`<label class="quick-check-duration-part"><input id="${id}-${j}" aria-label="${escapeHTML(q.name)} ${unit}" aria-describedby="${id}-duration-error" type="number" min="0" ${j?'max="59"':''} step="1" inputmode="numeric"><span aria-hidden="true">${unit}</span></label>`).join('')}</div><p class="quick-check-duration-error field-error" id="${id}-duration-error" role="alert" hidden>시간은 0 이상의 정수, 분과 초는 0~59로 입력해 주세요.</p></div>`;
    else if(q.type==='척도') {const {min,max,valid}=mockupScaleRange(q.min,q.max);input=preview&&!valid?'<p class="quick-check-scale-invalid">척도 범위를 2~11단계로 설정해 주세요.</p>':`<div class="quick-check-slider" style="--tick-count:${Math.max(1,Math.min(11,max-min+1))}"><input type="hidden" id="${id}-selected" value=""><input ${attrs} class="quick-check-scale-value" type="range" min="${min}" max="${max}" step="1" value="${min}" tabindex="-1" aria-hidden="true"><div class="quick-check-slider-ticks">${Array.from({length:Math.max(1,Math.min(11,max-min+1))},(_,j)=>`<button type="button" aria-pressed="false" aria-label="${escapeHTML(q.name)} ${min+j}">${min+j}</button>`).join('')}</div>${q.scaleStart||q.scaleEnd?`<div class="quick-check-scale-labels"><span>${escapeHTML(q.scaleStart||'')}</span><span>${escapeHTML(q.scaleEnd||'')}</span></div>`:''}</div>`;}
    else input=`<div class="quick-check-number"><label class="quick-check-number-control"><input ${attrs} type="number" step="any" inputmode="decimal" ${q.unit?`aria-describedby="${id}-unit"`:''}>${q.unit?`<span class="quick-check-unit" id="${id}-unit" title="${escapeHTML(q.unit)}">${escapeHTML(q.unit)}</span>`:''}</label></div>`;
    const clear=['선택형','시각','시간 길이','숫자','척도'].includes(q.type)?`<span class="quick-check-clear-slot"><button type="button" class="quick-check-clear" aria-label="${escapeHTML(q.name)} 초기화">초기화</button></span>`:'';
    return `<fieldset class="quick-check-field${q.type==='텍스트'?' quick-check-text-field':''}"><legend><span>${escapeHTML(q.name)}</span>${q.multiple&&q.type==='선택형'?'<span class="field-limit">여러 개 선택</span>':''}${clear}</legend>${input}</fieldset>`;
  }
  function updateTimeField(time){const hidden=$('input[type="hidden"]',time),match=hidden.value.match(/^(오전|오후) (\d{1,2}):(\d{2})$/),period=$('input[id$="-period"]',time),button=$('.timefield-period',time),numbers=$$('input[type="number"]',time),value=match?match[1]:(period.value||'오전');button.dataset.value=value;$('span',button).textContent=value;if(match){period.value=value;numbers[0].value=Number(match[2]);numbers[1].value=Number(match[3]);}}
  function syncTimeInput(time){const button=$('.timefield-period',time),numbers=$$('input[type="number"]',time),hour=numbers[0].value,minute=numbers[1].value;$('input[id$="-period"]',time).value=button.dataset.value;$('input[type="hidden"]',time).value=hour!==''&&minute!==''&&numbers.every(input=>input.checkValidity())?`${button.dataset.value} ${Number(hour)}:${String(Number(minute)).padStart(2,'0')}`:'';$$('[aria-invalid]',time).forEach(input=>input.removeAttribute('aria-invalid'));$('.timefield-error',time).hidden=true;}
  function configurationDirty(){
    if(route!=='/settings/configuration'||!$('#configuration-form'))return false;
    const labels=$$('#configuration-form input').map(x=>x.value);
    const templateIndex=Math.max(0,Number(params.get('template')||1)-1),nameChanged=$('#template-name').value.trim()!==(state.journalTemplates[templateIndex]?.name||'');
    return nameChanged||(commonJournalDraft?JSON.stringify({...commonJournalDraft,labels})!==commonJournalSnapshot:JSON.stringify(labels)!==configSnapshot);
  }
  function confirmClose(save,close,impact=''){
    pendingClose=close;
    dialog('변경 내용을 저장할까요?',`<p>저장하지 않으면 변경 내용이 사라져요.${escapeHTML(impact)}</p>`,'저장하고 닫기',save);
    $('#mockup-dialog .dialog-actions [data-action="confirm-dialog"]').insertAdjacentHTML('beforebegin','<button type="button" class="button secondary" data-action="discard-and-close">저장하지 않고 닫기</button>');
  }
  function confirmNavigation(move,save,impact='',message='저장하지 않으면 변경 내용이 사라져요.'){
    pendingNavigation=move;
    dialog('변경 내용을 저장할까요?',`<p>${escapeHTML(message+impact)}</p>`,'저장하고 나가기',async()=>{const next=pendingNavigation;pendingNavigation=null;if(await save()){const previous=location.hash;navigationApproved=true;next?.();if(location.hash===previous)navigationApproved=false;}});
    const modal=$('#mockup-dialog'),close=$('[data-dialog-close]',modal);close.hidden=false;close.dataset.action='close-dialog';$('.dialog-actions [data-action="close-dialog"]',modal).remove();close.focus();
    $('#mockup-dialog .dialog-actions [data-action="confirm-dialog"]').insertAdjacentHTML('beforebegin','<button type="button" class="button secondary" data-action="discard-and-move">저장하지 않고 나가기</button>');
  }
  function confirmJournalNavigation(move){
    const message=params.has('entry')?'저장하지 않으면 변경 내용이 사라져요.':'일지는 저장되지 않지만, 임시저장된 내용은 보관돼요.';
    confirmNavigation(move,saveJournal,'',message);
  }
  async function saveConfigurationForNavigation(){
    const name=$('#template-name').value.trim(),inputs=$$('#configuration-form input'),values=inputs.map(el=>el.value.trim());
    if(!name){toast('템플릿 이름을 입력해 주세요.');$('#template-name').focus();return false;}
    const empty=values.findIndex(value=>!value);if(empty!==-1){toast('영역 이름을 모두 입력해 주세요.');inputs[empty].focus();return false;}
    const index=Math.max(0,Number(params.get('template')||1)-1),labelsChanged=JSON.stringify(values)!==configSnapshot;
    const previous={name:state.journalTemplates[index].name,templates:copy(state.journalTemplateConfigs),schemas:copy(state.journalSchemaSnapshots),draft:copy(commonJournalDraft)};
    state.journalTemplates[index].name=name;
    if(labelsChanged){preserveJournalSchemas(index);commonJournalDraft.labels=values;state.journalTemplateConfigs[index]=copy(commonJournalDraft);}
    if(!await persist()){state.journalTemplates[index].name=previous.name;state.journalTemplateConfigs=previous.templates;state.journalSchemaSnapshots=previous.schemas;commonJournalDraft=previous.draft;return false;}
    return true;
  }
  function confirmConfigurationNavigation(move){
    const index=Math.max(0,Number(params.get('template')||1)-1),labelsChanged=JSON.stringify($$('#configuration-form input').map(el=>el.value))!==configSnapshot;
    const affected=journalTemplateRecipients(index).filter(item=>!item.labels).length;
    confirmNavigation(move,saveConfigurationForNavigation,labelsChanged?` 공통 일지 기록을 사용하는 ${affected}명에게 적용되고, 기존 일지는 그대로 남아요.`:'');
  }
  function confirmScoreNavigation(move){
    const affected=editingReportTemplateIndex===null?0:reportTemplateRecipients(editingReportTemplateIndex).filter(item=>!item.custom).length;
    confirmNavigation(move,()=>saveScoring(true),editingCommonReport&&editingReportTemplateIndex!==null?` 공통 기준을 사용하는 ${affected}명의 새 리포트에 적용되고, 기존 리포트는 그대로 남아요.`:'');
  }
  function editorDialog(id,className,title,body){
    closePopups();let el=document.getElementById(id);
    if(!el){el=document.createElement('dialog');el.id=id;document.body.append(el);el.addEventListener('cancel',e=>{e.preventDefault();closeEditorDialog(id);});}
    el.className=className;el.setAttribute('aria-labelledby',id+'-title');
    el.innerHTML=`<header class="${id==='consent-dialog'?'mockup-consent-header':className.trim().split(/\s+/).at(-1)+'-header'}"><div><h2 id="${id}-title">${title}</h2>${id==='scoring-dialog'?'<p>변경한 기준은 새로 생성하는 리포트부터 적용돼요. 기존 리포트는 바뀌지 않아요.</p>':''}</div><button type="button" class="recipient-form-close" data-action="close-modal" data-modal="${id}" aria-label="닫기" title="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>${body}`;
    if(!el.open)el.showModal();else if(!el.contains(document.activeElement))$('button',el)?.focus();return el;
  }
  function closeEditorDialog(id){
    closePopups();const modal=document.getElementById(id);
    let dirty=false;
    if(id==='quick-dialog'){readQuickDraft();dirty=JSON.stringify(quickDraft)!==quickSnapshot;}
    if(id==='scoring-dialog'){readScoreDraft();dirty=JSON.stringify(scoreDraft)!==scoreSnapshot;}
    if(dirty&&id==='quick-dialog'){
      const index=Math.max(0,Number(params.get('template')||1)-1),affected=journalTemplateRecipients(index).filter(item=>!item.quick).length;
      const impact=commonJournalDraft?` 공통 퀵체크를 사용하는 ${affected}명에게 적용되고, 기존 일지는 그대로 남아요.`:'';
      confirmClose(()=>saveQuick(true),()=>modal.close(),impact);
    }else if(dirty&&id==='scoring-dialog'){
      const affected=editingReportTemplateIndex===null?0:reportTemplateRecipients(editingReportTemplateIndex).filter(item=>!item.custom).length;
      const impact=editingCommonReport&&editingReportTemplateIndex!==null?` 공통 기준을 사용하는 ${affected}명의 새 리포트에 적용되고, 기존 리포트는 그대로 남아요.`:'';
      confirmClose(async()=>{if(await saveScoring(true))modal.close();},()=>modal.close(),impact);
    }else modal.close();
  }
  function openPlanCheckout(selected = 'starter') {
    if (state.subscription && !mockupSubscriptionPeriod(state.subscription,currentDate()).ended) { openPaymentResult(false); return; }
    const plans = checkoutPlans;
    if (selected === 'pro') selected = 'team';
    if (!Object.hasOwn(plans, selected)) selected = 'starter';
    const plan = plans[selected];
    const today = currentDate(), amount=mockupCheckoutPrice(selected), nextBillingOn=mockupBillingDate(today,1);
    const modal = editorDialog('checkout-dialog','checkout-dialog',`${plan.name} 요금제`,`
      <form id="checkout-form" class="checkout-body" novalidate>
        <section class="checkout-summary" aria-labelledby="checkout-amount-title">
          <div class="checkout-total"><h3 id="checkout-amount-title">오늘 결제 금액</h3><strong>${won(amount)}</strong></div>
          <p class="checkout-tax">VAT 포함 금액</p>
          <dl class="checkout-billing"><div><dt>결제 주기</dt><dd>매월 자동결제</dd></div><div><dt>다음 결제일</dt><dd>${nextBillingOn}</dd></div><div><dt>다음 결제 금액</dt><dd>${won(amount)}</dd></div></dl>
        </section>
        <div class="checkout-notices"><p>결제 후 바로 이용할 수 있어요. 해지 전까지 매월 ${won(amount)}이 자동 결제돼요.</p><p>요금제에서 언제든 자동갱신을 해지할 수 있어요. 해지 후에도 결제한 기간까지 이용해요.</p><p>결제 후 7일 이내 · 유료 기능 미사용 시 전액 환불해요. 사용 후·7일 경과 시의 제한과 법령상 예외는 환불 기준에서 확인해 주세요.</p>${selected==='team'?'<p class="checkout-team-notice">팀 플랜은 결제자만 결제·자동갱신 해지·환불을 관리합니다. 결제자가 해지하면 이용기간 종료일에 팀원도 무료 플랜으로 전환됩니다.</p>':''}</div>
        <div class="checkout-footer">
          <div class="checkout-consent"><input type="checkbox" id="checkout-terms-agree" required><label for="checkout-terms-agree">결제 조건 및 환불 기준을 확인했습니다. <span class="checkout-required">(필수)</span></label><button type="button" class="checkout-policy-link" data-action="checkout-policy" data-policy="terms" aria-label="결제 조건과 환불 기준 보기">보기</button></div>
          <div class="checkout-consent"><input type="checkbox" id="checkout-renewal-agree" required><label for="checkout-renewal-agree">정기결제·자동갱신에 동의해요. <span class="checkout-required">(필수)</span></label><button type="button" class="checkout-policy-link" data-action="checkout-policy" data-policy="renewal" data-plan="${selected}" data-date="${today}" aria-label="정기결제와 자동갱신 조건 보기">보기</button></div>
          <button type="submit" class="button primary checkout-submit" disabled>결제하기</button>
          
        </div>
      </form>`);
    const form = $('#checkout-form',modal);
    let submitting = false;
    const consent = () => ({terms:$('#checkout-terms-agree',form).checked,renewal:$('#checkout-renewal-agree',form).checked});
    const update = () => {
      const submit = $('.checkout-submit',form);
      submit.textContent='결제하기';
      submit.disabled=submitting||!consent().terms||!consent().renewal;
    };
    form.addEventListener('change',update);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if (submitting || (state.subscription && !mockupSubscriptionPeriod(state.subscription,currentDate()).ended)) return;
      if (today!==currentDate()) { openPlanCheckout(selected); toast('결제일이 바뀌었어요. 결제 내용을 다시 확인해 주세요.'); return; }
      const subscription=mockupCheckoutSubscription(selected,today,consent(),new Date().toISOString());
      if (!subscription) return;
      submitting = true;
      $('.checkout-submit',form).disabled = true;
      $('.checkout-submit',form).textContent = '결제 처리 중';
      const previous=state.subscription, previousRecipients=copy(state.recipients);
      state.subscription = subscription;
      mockupRestorePlanRecipients(state,today);
      if (!await persist()) { state.subscription=previous;state.recipients=previousRecipients;submitting=false;update();return; }
      history.replaceState(null,'','#/plans');
      render();
      openPaymentResult(true);
    });
    update();
  }
  function subscriptionDetails() {
    const sub=state.subscription, cycle=checkoutCycles[sub.cycle];
    const period=mockupSubscriptionPeriod(sub,currentDate());
    return `<dl class="subscription-details">
      <div><dt>결제 금액</dt><dd>${won(sub.amount)}<small>VAT 포함 금액</small></dd></div>
      <div><dt>결제일</dt><dd>${mockupBillingDate(sub.paidOn)}</dd></div>
      <div><dt>${sub.autoRenew===false?'유료 이용 종료일':'다음 결제일'}</dt><dd>${sub.autoRenew===false?period.end:sub.nextBillingOn}</dd></div>
      <div><dt>다음 결제</dt><dd>${sub.autoRenew===false?'없음':won(sub.amount)}<small>${sub.autoRenew===false?'자동갱신 해지됨':`${cycle.months===12?'매년':'매월'} 정기 결제`}</small></dd></div>
    </dl>`;
  }
  function subscriptionOverview(sub, period, cycle) {
    const stopped=sub.autoRenew===false;
    return `<dl class="subscription-overview-details">
      <div><dt>${stopped?'이용 종료일':'다음 결제일'}</dt><dd>${stopped?period.end:sub.nextBillingOn}</dd></div>
      <div><dt>결제 금액</dt><dd>${stopped?'다음 결제 없음':won(sub.amount)}</dd>${stopped?'':`<p>${cycle.months===12?'매년':'매월'} 정기 결제 · VAT 포함 금액</p>`}</div>
      <div class="subscription-first-payment"><dt>첫 결제일</dt><dd>${mockupBillingDate(sub.paidOn)}</dd></div>
    </dl>`;
  }
  function openCheckoutPolicy(type,plan,date) {
    const renewal=type==='renewal', amount=mockupCheckoutPrice(plan);
    if (renewal && (!Number.isInteger(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(date||''))) return;
    const html=renewal?`<p><strong>${checkoutPlans[plan].name} · 월 ${won(amount)}</strong> (VAT 포함 금액)</p><p>첫 결제는 ${mockupBillingDate(date)}, 다음 결제는 ${mockupBillingDate(date,1)}에 ${won(amount)}이에요. 이후에도 첫 결제일과 같은 날짜에 매월 자동 결제돼요. 해당 날짜가 없는 달에는 마지막 날에 결제해요.</p><p>결제 직후 유료 기능이 제공돼요. 요금제 → 자동갱신 해지 또는 support@careit.kr를 통해 다음 결제부터 해지할 수 있어요. 이미 결제한 기간까지 이용할 수 있으며, 자동갱신 해지는 환불 신청과 달라요.</p>${plan==='team'?'<p>팀의 해지·환불은 결제자가 요청해요. 이용기간이 끝나면 결제자와 팀원 모두 무료 요금제로 전환돼요.</p>':''}<p>요금이 인상되는 경우 변경 금액과 적용 시점을 미리 안내하고 별도 동의를 받아요.</p>`:$('#checkout-policy-template').innerHTML;
    const modal=editorDialog('checkout-policy-dialog','checkout-dialog',renewal?'정기결제·자동갱신':'이용약관·환불 기준',`<div class="checkout-body"><div class="checkout-policy-copy">${html}</div><button type="button" class="button secondary" data-action="close-modal" data-modal="checkout-policy-dialog">확인</button></div>`);
    const title=$('#checkout-policy-dialog-title',modal);title.tabIndex=-1;title.focus();
  }
  function cancelSubscriptionRenewal() {
    const sub=state.subscription;
    if (!sub || sub.autoRenew===false) return;
    const today=currentDate(), period=mockupSubscriptionPeriod(sub,today), deadline=mockupRefundDeadline(sub.paidOn);
    const refundable=!!deadline && today>=sub.paidOn && today<=deadline;
    const dateLabel=value=>{const [,month,day]=value.split(/[-.]/).map(Number);return `${month}월 ${day}일`;};
    const modal=editorDialog('plan-cancel-dialog','checkout-dialog plan-cancel-dialog','구독 해지',`<div class="plan-cancel-body"><p class="plan-cancel-plan">${checkoutPlans[sub.plan].name}</p><form id="plan-cancel-form"><fieldset class="plan-cancel-options"><legend class="sr-only">해지 방법 선택</legend>
      <label class="plan-cancel-choice"><input type="radio" name="cancel-method" value="scheduled" checked><span><strong>${dateLabel(period.end)}까지 쓰고 해지</strong><small>그 뒤 무료로 바뀌어요. 그때까지 유료 기능을 그대로 써요.${sub.plan==='team'?' 팀원도 이용 종료 후 무료로 전환돼요.':''}</small></span></label>
      <label class="plan-cancel-choice${refundable?'':' is-unavailable'}"><input type="radio" name="cancel-method" value="refund" ${refundable?'':'disabled'}><span><strong>지금 해지하고 전액 환불</strong> <span class="plan-cancel-badge">${refundable?`${dateLabel(deadline)}까지`:'환불 기간 종료'}</span><small>유료 기능을 쓰지 않았다면 결제 금액 전액을 돌려받고 바로 무료로 바뀌어요.${sub.plan==='team'?' 팀원도 무료로 전환돼요.':''}</small></span></label>
      </fieldset><p class="plan-cancel-notice">중복 결제나 서비스 문제라면 <a href="mailto:support@careit.kr">support@careit.kr</a>로 알려주세요. <button type="button" data-action="checkout-policy" data-policy="terms">환불 기준 보기</button></p><div class="dialog-actions"><button type="button" class="button secondary" data-action="close-modal" data-modal="plan-cancel-dialog">닫기</button><button type="submit" class="button primary">해지 예약</button></div></form></div>`);
    const form=$('#plan-cancel-form',modal), submit=$('button[type=submit]',form);
    form.addEventListener('change',()=>{submit.textContent=$('input[name=cancel-method]:checked',form).value==='refund'?'해지·환불':'해지 예약';});
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(state.subscription!==sub || sub.autoRenew===false)return;
      const refund=$('input[name=cancel-method]:checked',form).value==='refund';
      if(refund && (!refundable || currentDate()>deadline))return;
      submit.disabled=true;
      state.subscription=mockupStopRenewal(sub,new Date().toISOString());
      if(refund)state.subscription.refundDemoOn=currentDate();
      if(!await persist()){state.subscription=sub;submit.disabled=false;return;}
      modal.close();render();$('#subscription-title')?.focus();toast(refund?'구독 해지와 환불이 완료됐어요.':'자동갱신을 해지했어요. 다음 결제는 없어요.');
    });
  }
  let billingDemoOpen=false;
  function teamDemoMembers(sub) {
    const remaining=Math.max(0,2-sub.invites.length);
    return (Array.isArray(sub.demoMembers)?sub.demoMembers:['팀원 1','팀원 2']).slice(0,remaining);
  }
  function renderBillingDemo() {
    const current=state.subscription?.plan || 'free';
    const sub=state.subscription, teamActive=sub?.plan==='team'&&!mockupSubscriptionPeriod(sub,currentDate()).ended;
    $('#screen').insertAdjacentHTML('beforeend',`<button type="button" class="qa-billing-toggle" data-action="billing-demo-toggle" aria-expanded="${billingDemoOpen}" aria-controls="qa-billing-panel">결제 시연</button>${billingDemoOpen?`<aside id="qa-billing-panel" class="qa-billing-panel" aria-label="결제 시연"><div class="qa-billing-panel-heading"><strong>결제 시연</strong><button type="button" aria-label="결제 시연 닫기" data-action="billing-demo-toggle">×</button></div><section aria-label="요금제 바꾸기"><p class="qa-billing-panel-note">요금제 바꾸기 · 목업에서만 적용돼요</p><div class="qa-billing-panel-options">${[['free','무료'],['starter','플러스'],['team','팀(팀장)']].map(([value,label])=>`<button type="button" data-action="billing-demo-select" data-plan="${value}" aria-pressed="${current===value}">${label}</button>`).join('')}<button type="button" data-action="billing-demo-reset" aria-pressed="false">QA로 되돌리기</button>${sub?'<button type="button" data-action="payment-back">결제 전으로 돌아가기</button>':''}</div></section>${teamActive?`<section aria-label="팀 멤버 시연"><p class="qa-billing-panel-note">팀 멤버 시연</p><div class="qa-billing-panel-options">${[[3,'3명 이용 중'],[2,'2명 이용 중'],[1,'팀장만 이용 중']].map(([count,label])=>`<button type="button" data-action="billing-demo-team-size" data-count="${count}" aria-pressed="${1+teamDemoMembers(sub).length===count}">${label}</button>`).join('')}</div></section>`:''}</aside>`:''}`);
  }
  async function setBillingDemoTeamSize(count) {
    const sub=state.subscription;
    if(sub?.plan!=='team'||mockupSubscriptionPeriod(sub,currentDate()).ended||![1,2,3].includes(count))return;
    if(count-1>2-sub.invites.length){toast('초대 대기 중인 자리가 있어 이 상태를 선택할 수 없어요.');return;}
    const previous=sub.demoMembers;
    sub.demoMembers=['팀원 1','팀원 2'].slice(0,count-1);
    if(!await persist()){if(previous===undefined)delete sub.demoMembers;else sub.demoMembers=previous;return;}
    render();
  }
  async function setBillingDemo(plan) {
    const previous=state.subscription?copy(state.subscription):null, oldFree=state.planDemoFree, oldOriginal=state.planDemoOriginal, previousRecipients=copy(state.recipients), previousCapacity=mockupRecipientCapacity(state,currentDate());
    if (!Object.prototype.hasOwnProperty.call(state,'planDemoOriginal')) state.planDemoOriginal=previous || null;
    if(plan==='reset'){state.subscription=state.planDemoOriginal;state.planDemoFree=!state.subscription;delete state.planDemoOriginal;}
    else if(plan==='free'){state.subscription=null;state.planDemoFree=true;}
    else {const today=currentDate();state.subscription={plan,cycle:'monthly',amount:mockupCheckoutPrice(plan),paidOn:today,nextBillingOn:mockupBillingDate(today,1),autoRenew:true,invites:[],source:'demo'};state.planDemoFree=false;}
    if(previousCapacity===1 && mockupRecipientCapacity(state,currentDate())>1)mockupRestorePlanRecipients(state,currentDate());
    if(!await persist()){state.subscription=previous;state.recipients=previousRecipients;state.planDemoFree=oldFree;if(oldOriginal===undefined)delete state.planDemoOriginal;else state.planDemoOriginal=oldOriginal;return;}
    history.replaceState(null,'','#/plans');render();
  }
  function preparePlans() {
    $$('.pricing-features li').forEach(li=>li.insertAdjacentHTML('afterbegin','<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'));
    $$('.pricing-card').forEach(card=>{const list=$('.pricing-features',card);if(list&&list.children.length>3)list.insertAdjacentHTML('afterend','<button type="button" class="pricing-features-toggle" data-action="toggle-plan-features" aria-expanded="false">기능 전체 보기</button>');});
    renderBillingDemo();
    const sub=state.subscription;
    const today=currentDate(),couponActive=state.couponPlusFrom<=today&&state.couponPlusUntil>=today;
    if(couponActive&&(!sub||mockupSubscriptionPeriod(sub,today).ended)){
      $('.pricing-audience')?.remove();
      const grid=$('.pricing-grid');
      grid.insertAdjacentHTML('beforebegin',`<section class="subscription-card subscription-overview"><header class="subscription-header"><div><div class="subscription-heading"><h2>플러스 이용 중</h2><span class="subscription-badge">쿠폰</span></div><p>관리대상 최대 5명</p></div></header><div class="subscription-overview-details"><div><dt>쿠폰 이용 종료일</dt><dd>${state.couponPlusUntil.replaceAll('-','.')}</dd><p>자동 결제 없이 이용 기간이 끝나면 무료로 전환돼요.</p></div></div></section>`);
      $$('.pricing-card',grid).forEach(card=>{const button=$('.button',card);if(button.dataset.plan==='starter'){card.classList.add('is-current');$('h2',card).insertAdjacentHTML('beforeend','<span class="pricing-badge">지금 쓰는 요금제</span>');button.disabled=true;button.textContent='지금 쓰는 요금제';}});
      return;
    }
    if (!sub) { $('.pricing-audience')?.remove();const current=$('.pricing-card');current.classList.add('is-current');$('h2',current).insertAdjacentHTML('beforeend','<span class="pricing-badge">지금 쓰는 요금제</span>');return; }
    const plan=checkoutPlans[sub.plan], cycle=checkoutCycles[sub.cycle];
    const period=mockupSubscriptionPeriod(sub,currentDate());
    const audience=$('.pricing-audience'), grid=$('.pricing-grid');
    const teamActive=sub.plan==='team'&&!period.ended;
    const comparison=document.createElement(teamActive?'details':'section');
    comparison.className='subscription-comparison';
    if(teamActive) comparison.innerHTML='<summary>전체 요금제 보기</summary>';
    audience.before(comparison); comparison.append(grid); audience.remove();
    $$('.pricing-card',grid).forEach(card=>{
      const button=$('.button',card);
      const current=period.ended?button.disabled:button.dataset.plan===sub.plan;
      if (current) { card.classList.add('is-current'); $('h2',card).insertAdjacentHTML('beforeend','<span class="pricing-badge">지금 쓰는 요금제</span>'); }
      const label=current?'지금 쓰는 요금제':button.textContent.trim();
      if(!period.ended || current) button.outerHTML=`<button type="button" class="button ${button.classList.contains('secondary')?'secondary':'pricing-button--soft'}" disabled>${escapeHTML(label)}</button>`;
    });
    if(sub.source==='live'){
      comparison.insertAdjacentHTML(teamActive?'beforebegin':'afterend',`<section class="subscription-card live-plan-card" aria-labelledby="subscription-title">
        <header class="subscription-header"><div><div class="subscription-heading"><h2 id="subscription-title" tabindex="-1">팀 이용 중</h2><span class="subscription-badge">팀장</span></div><p>최대 3명 이용 · 1인당 관리대상 최대 5명</p></div></header>
        <div class="live-plan-details"><section aria-labelledby="team-plan-title"><h3 id="team-plan-title">팀</h3><dl><div><dt>시작일</dt><dd>2026.10.29</dd></div><div><dt>현재 인원</dt><dd>${1+teamDemoMembers(sub).length}명 / 최대 3명</dd></div><div><dt>참가 링크</dt><dd>2026.11.15까지</dd></div></dl></section><section aria-labelledby="usage-plan-title"><h3 id="usage-plan-title">이용 현황</h3><dl><div><dt>이용 기한</dt><dd>기한 없음</dd></div><div><dt>관리대상</dt><dd>${state.recipients.filter(person=>person.active&&!person.deleted).length}/5 명</dd></div></dl></section></div>
      </section>${teamMembersHTML()}`);
      return;
    }
    comparison.insertAdjacentHTML(teamActive?'beforebegin':'afterend',`<section class="subscription-card subscription-overview" aria-labelledby="subscription-title">
      <header class="subscription-header"><div><div class="subscription-heading"><h2 id="subscription-title" tabindex="-1">${period.ended?'무료':plan.name} 이용 중</h2><span class="subscription-badge">${sub.refundDemoOn?'환불 완료':sub.autoRenew===false?'자동갱신 해지됨':cycle.name}</span></div><p>${period.ended?'유료 이용기간이 종료됐어요.':sub.plan==='team'?'최대 3명 이용 · 1인당 관리대상 최대 5명':'관리대상 최대 5명'}</p></div></header>
      ${subscriptionOverview(sub,period,cycle)}
      ${sub.autoRenew===false?`<p class="subscription-status">${sub.refundDemoOn?'구독이 해지되고 환불이 완료됐어요.':period.ended?'결제한 이용기간이 끝나 무료 요금제로 전환됐어요.':`${period.end}까지 ${plan.name} 기능을 이용할 수 있어요.${sub.plan==='team'?' 이후 결제자와 팀원 모두 무료 요금제로 전환돼요.':''}`}</p>`:''}
      <div class="subscription-management"><button type="button" class="button tertiary" data-action="payment-details">결제 내역</button>${sub.autoRenew!==false?'<button type="button" class="button tertiary" data-action="cancel-renewal">자동갱신 해지</button>':''}</div>
    </section>${sub.plan==='team'&&!period.ended?teamMembersHTML():''}`);
    if(state.couponPlusFrom&&state.couponPlusUntil>=today)$('#subscription-title')?.closest('.subscription-card')?.insertAdjacentHTML('beforeend',`<p class="subscription-status">${state.couponPlusFrom>today?'쿠폰 등록 완료':'쿠폰 적용 중'} · ${state.couponPlusFrom.replaceAll('-','.')}부터 ${state.couponPlusUntil.replaceAll('-','.')}까지 플러스 이용</p>`);
  }
  function teamMembersHTML() {
    const sub=state.subscription, invites=sub.invites, members=teamDemoMembers(sub);
    const available=2-invites.length-members.length;
    return `<section class="subscription-card" aria-labelledby="team-members-title"><header class="subscription-header"><div class="subscription-heading"><h2 id="team-members-title">팀 멤버</h2><span class="subscription-badge">${1+members.length}명 / 최대 3명</span></div><button type="button" class="button tertiary" data-action="team-invite" ${available?'':'disabled'}>멤버 초대</button></header>
      <p class="team-records-note">각자 계정으로 기록하며, 서로의 기록은 공유되지 않아요.</p>
      <ul class="team-member-list"><li><div><strong>나</strong><span>결제자</span></div><span class="subscription-badge">이용 중</span></li>
        ${members.map(name=>`<li><div><strong>${escapeHTML(name)}</strong><span>팀원</span></div><span class="subscription-badge">이용 중</span></li>`).join('')}
        ${invites.map((email,i)=>`<li><div><strong>${escapeHTML(email)}</strong><span>초대 대기</span></div><button type="button" class="button tertiary" data-action="cancel-team-invite" data-index="${i}" aria-label="${escapeHTML(email)} 초대 취소">초대 취소</button></li>`).join('')}
      </ul></section>`;
  }
  function openPaymentResult(completed) {
    const sub=state.subscription;
    if (!sub) return;
    const plan=checkoutPlans[sub.plan], cycle=checkoutCycles[sub.cycle];
    const canInvite=sub.plan==='team' && teamDemoMembers(sub).length+sub.invites.length<2;
    const modal=editorDialog('checkout-dialog','checkout-dialog',completed?'결제가 완료됐어요':'결제 내역',`<div class="checkout-body">
      <div class="payment-result-heading">${completed?'<span class="payment-success-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4 10-10"/></svg></span>':''}<div><h3>${plan.name} · ${cycle.name}</h3><p>${!completed?'결제한 요금제 내역이에요.':sub.plan==='team'?(canInvite?'이제 함께 이용할 멤버를 초대해 보세요.':'팀 멤버를 확인해 보세요.'):'이제 플러스 기능을 이용할 수 있어요.'}</p></div></div>
      ${subscriptionDetails()}
      ${completed || sub.plan!=='team'?`<div class="payment-result-actions"><button type="button" class="button secondary" data-action="close-modal" data-modal="checkout-dialog">요금제 보기</button><button type="button" class="button primary" data-action="${sub.plan==='team'&&!mockupSubscriptionPeriod(sub,currentDate()).ended?(completed&&canInvite?'team-invite':'team-members'):'payment-start'}">${sub.plan==='team'&&!mockupSubscriptionPeriod(sub,currentDate()).ended?(completed&&canInvite?'멤버 초대하기':'팀 멤버 보기'):'일지 작성하기'}</button></div>`:''}
      
    </div>`);
    $('#checkout-dialog-title',modal).tabIndex=-1;
    $('#checkout-dialog-title',modal).focus();
    modal.addEventListener('close',()=>$('#subscription-title')?.focus(),{once:true});
  }
  function openTeamInvite() {
    const sub=state.subscription;
    if (sub?.plan!=='team' || mockupSubscriptionPeriod(sub,currentDate()).ended) return;
    $('#checkout-dialog')?.close();
    const available=2-sub.invites.length-teamDemoMembers(sub).length;
    if (available<=0) { toast('초대할 수 있는 자리가 없어요.'); return; }
    const inviteURL=`${location.origin}${location.pathname}#/team/join/mockup-${sub.mockInviteVersion||1}`;
    const active=sub.mockInviteDisabled!==true;
    editorDialog('team-invite-dialog','checkout-dialog','팀 참가 링크',`<div class="checkout-body team-invite-body"><p class="team-invite-lead">링크를 받은 사람이 로그인하면 바로 팀에 참가할 수 있어요</p>${active?`<div class="team-invite-field"><label for="dialog-team-invite-url">참가 링크</label><div class="team-invite-row"><input id="dialog-team-invite-url" readonly value="${escapeHTML(inviteURL)}"><button type="button" class="button primary" data-action="team-link-copy">복사</button></div><div class="team-invite-meta"><p>링크 만료일: <time>11월 15일 오후 12:57</time></p><p>남은 자리: ${available}</p></div></div><p class="team-invite-notice">이 링크는 만료일까지 계속 쓸 수 있어요. 새 링크를 만들면 이전 링크는 바로 막혀요.</p><div class="team-invite-actions"><button type="button" class="button danger-soft" data-action="team-link-disable">링크 끄기</button><button type="button" class="button secondary" data-action="team-link-new">새 링크 만들기</button></div>`:'<p class="team-invite-notice">사용 중인 참가 링크가 없어요.</p><div class="team-invite-actions"><button type="button" class="button secondary" data-action="team-link-new">새 링크 만들기</button></div>'}</div>`);
  }
  async function resetPaymentSimulation() {
    const previous=state.subscription;
    delete state.subscription;
    state.planDemoFree=true;
    if(!await persist()){state.subscription=previous;state.planDemoFree=false;return;}
    history.replaceState(null,'','#/plans');
    $('#mockup-panel').hidden=true;
    $('#mockup-toggle').setAttribute('aria-expanded','false');
    render();
    toast('다시 결제를 시연할 수 있어요.');
  }
  function openQuickEditor(index=null){
    quickIndex=index;quickDraft=copy(index===null?{name:'',type:'선택형',multiple:false,active:true,choices:[{name:'',active:true},{name:'',active:true}],min:'',max:'',unit:'',maxLength:200}:configurationQuickChecks()[index]);
    drawQuickEditor();readQuickDraft();quickSnapshot=JSON.stringify(quickDraft);
  }
  function openQuickTypePicker(){
    readQuickDraft();let picker=$('#quick-type-picker');if(!picker){picker=document.createElement('dialog');picker.id='quick-type-picker';document.body.append(picker);}picker.className='quick-check-type-picker';picker.setAttribute('aria-labelledby','quick-type-picker-title');
    const descriptions=['정해 둔 항목 중에서 골라요','200자까지 직접 적어요','몇 시였는지 골라요','걸린 시간을 시·분·초로 적어요','횟수나 양을 세요','정도를 단계로 매겨요'];
    picker.innerHTML=`<header class="configuration-dialog-header"><div><h2 id="quick-type-picker-title">입력 방식 고르기</h2></div><button type="button" class="recipient-form-close" data-action="quick-type-cancel" aria-label="닫기" title="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header><div class="quick-check-type-grid">${quickTypes.map((type,i)=>{const name=type==='시간 길이'?'소요 시간':type,q={name,type,multiple:false,active:true,choices:['항목 1','항목 2','항목 3'].map(name=>({name,active:true})),columns:3,min:'',max:'',unit:'',maxLength:200},preview=quickPreview(q,200+i,true);return `<section class="quick-check-type-card${quickDraft.type===type?' is-selected':''}" aria-label="${name} 방식"><header><label><input class="sr-only" type="radio" name="quick-type-choice" value="${type}" ${quickDraft.type===type?'checked':''}>${name}</label><span class="quick-check-type-description">${descriptions[i]}</span>${quickDraft.type===type?'<span class="quick-check-type-current">지금 방식</span>':''}<svg class="quick-type-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></header><div class="quick-check-type-preview" aria-hidden="true" inert>${preview}</div></section>`;}).join('')}</div><footer class="quick-check-type-footer"><p>입력 방식을 바꿔도 이미 쓴 일지의 값은 그대로 남아요.</p><div><button class="button secondary" type="button" data-action="quick-type-cancel">취소</button><button class="button primary" type="button" data-action="quick-type-save">저장</button></div></footer>`;
    $$('.quick-check-type-card',picker).forEach(card=>{$('legend',card)?.remove();$('.quick-check-text-field .field-heading',card)?.remove();});
    picker.showModal();
  }
  function readQuickDraft(){
    const form=$('#quick-edit-form');if(!form)return;
    quickDraft.name=$('#quick-name').value;quickDraft.multiple=$('#quick-multiple')?.checked||false;
    for(const key of ['min','max','unit','maxLength','scaleStart','scaleEnd'])if($('#quick-'+key))quickDraft[key]=$('#quick-'+key).value;
    $$('[data-choice-input]',form).forEach(el=>quickDraft.choices[Number(el.dataset.choiceInput)].name=el.value);
  }
  function drawQuickEditor(){
    const q=quickDraft;
    const field=(key,label,type='text',maxLength)=>`<div class="field"><span class="field-heading"><label for="quick-${key}">${label}</label>${maxLength?`<small class="field-limit" id="quick-${key}-limit">${String(q[key]||'').length}/${maxLength}자</small>`:''}</span><input id="quick-${key}" type="${type}" ${maxLength?`maxlength="${maxLength}" aria-describedby="quick-${key}-limit"`:['min','max'].includes(key)?'aria-describedby="quick-scale-error"':''} value="${escapeHTML(q[key]??'')}" ${key==='name'?'required placeholder="예: 기분"':''}></div>`;
    const extra=q.type==='선택형'?`<fieldset class="choice-mode quick-check-mode"><legend class="sr-only">선택 방식</legend><label><input class="sr-only" type="radio" name="quick-mode" ${!q.multiple?'checked':''}><span>하나만 선택</span></label><label><input class="sr-only" type="radio" id="quick-multiple" name="quick-mode" ${q.multiple?'checked':''}><span>여러 개 선택</span></label></fieldset>`:'';
    const cross='<svg viewBox="30 -930 900 900" fill="currentColor" aria-hidden="true"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>';
    const options=`<section class="quick-check-options" aria-label="${escapeHTML(q.name||'새 퀵체크')} 선택 항목"><div class="quick-check-edit-chips" style="--chip-cols:3">${q.choices.map((c,i)=>`<div class="quick-check-edit-chip"><input data-choice-input="${i}" aria-label="선택 항목 ${i+1}" placeholder="항목 이름" value="${escapeHTML(c.name)}"><button class="button danger" type="button" data-action="quick-option-delete" data-index="${i}" ${q.choices.length<=2?'disabled':''} aria-label="${escapeHTML(c.name||`선택 항목 ${i+1}`)} 삭제">${cross}</button></div>`).join('')}<button class="quick-check-add-chip" type="button" data-action="quick-option-add" ${q.choices.length>=6?'disabled':''}>+ 항목 추가</button></div>${q.choices.filter(c=>c.name.trim()).length<2?'<p>선택 항목은 2개 이상 필요해요</p>':''}</section>`;
    const preview=q.type==='선택형'?options:quickPreview(q,99,true).replace(/<legend>[\s\S]*?<\/legend>/,'').replace(/<span class="field-heading">[\s\S]*?<\/span>/,'');
    const settings=q.type==='숫자'?`<div class="quick-check-form-grid">${field('unit','단위 (선택)','text',10)}</div>`:q.type==='척도'?`<div class="quick-check-form-grid">${field('min','최솟값 (기본 1)','number')}${field('max','최댓값 (기본 5, 2~11단계)','number')}<p class="quick-scale-error" id="quick-scale-error" role="alert" hidden>최솟값과 최댓값을 정수로 입력하고, 척도는 2~11단계로 설정해 주세요.</p>${field('scaleStart','낮은 단계 설명 (선택)','text',30)}${field('scaleEnd','높은 단계 설명 (선택)','text',30)}</div>`:'';
    editorDialog('quick-dialog','configuration-dialog',quickIndex===null?'퀵체크 새로 만들기':'퀵체크 편집',`<div class="configuration-dialog-body"><section class="quick-check-view quick-check-detail"><form class="quick-check-form quick-check-editor-form" id="quick-edit-form" novalidate><fieldset class="quick-check-editor-controls"><div class="quick-check-form-grid">${field('name','섹션 이름','text',30)}<div class="field"><label>입력 방식</label><div class="dropdown"><button class="dropdown-trigger" type="button" data-options="quick-type" aria-label="입력 방식" aria-haspopup="listbox" aria-expanded="false"><span>${q.type==='시간 길이'?'소요 시간':q.type}</span></button></div></div></div>${extra}${settings}<div class="quick-check-preview-slot"><section class="quick-check-preview"><header><h3>일지 미리보기</h3>${q.type==='선택형'?`<span aria-label="선택 항목 개수">${q.choices.length}/6</span>`:q.type==='텍스트'?`<small class="field-limit">0/${q.maxLength||200}자</small>`:''}</header><div class="quick-check-preview-card">${preview}</div>${q.type==='텍스트'?'<p class="quick-check-config-note">텍스트는 200자까지 적어요. 따로 고칠 설정은 없어요</p>':''}</section></div><p class="mockup-quick-help" role="status" data-quick-error hidden></p></fieldset></form><footer class="quick-check-form-actions">${quickIndex!==null?'<button class="button danger" type="button" data-action="quick-delete">삭제</button>':'<button class="button secondary" type="button" data-action="close-modal" data-modal="quick-dialog">취소</button>'}<button class="button primary" type="submit" form="quick-edit-form">${quickIndex===null?'섹션 추가':'저장'}</button></footer></section></div>`);
  }
  function quickOptionEditor(index){
    readQuickDraft();const target=$('[data-quick-option-editor]');
    target.innerHTML=`<div class="mockup-quick-option-form"><input id="quick-option-name" aria-label="선택 항목 이름" maxlength="30" value="${escapeHTML(index===null?'':quickDraft.choices[index].name)}" placeholder="항목 이름"><button type="button" class="button primary" data-action="quick-option-save" data-index="${index??''}">${index===null?'추가':'저장'}</button><button type="button" class="button secondary" data-action="quick-option-cancel">취소</button></div>`;$('#quick-option-name').focus();
  }
  async function saveQuick(confirmed=false){
    readQuickDraft();const q=quickDraft; q.name=q.name.trim();let error='';
    if(!q.name)error='섹션 이름을 입력해 주세요.';
    else if(q.type==='선택형'&&q.choices.filter(c=>c.name.trim()).length<2)error='선택 항목은 2개 이상 필요해요';
    else if(q.type==='선택형'&&q.choices.some(c=>!c.name.trim()))error='선택 항목 이름을 입력해 주세요.';
    else if(q.type==='선택형'&&new Set(q.choices.map(c=>c.name.trim())).size!==q.choices.length)error='같은 이름의 항목이 있어요.';
    else if(q.type==='척도'&&(!mockupScaleRange(q.min,q.max).valid||['#quick-min','#quick-max'].some(selector=>$(selector)?.validity.badInput))){const message=$('#quick-scale-error');message.hidden=false;$('#quick-min')?.setAttribute('aria-invalid','true');$('#quick-max')?.setAttribute('aria-invalid','true');return;}
    else if(q.type==='텍스트'&&(!Number.isInteger(Number(q.maxLength))||q.maxLength<1||q.maxLength>2000))error='최대 글자 수는 1~2000 사이의 정수로 설정해 주세요.';
    if(error){const message=$('[data-quick-error]');message.textContent=error;message.hidden=false;return;}
    const index=Math.max(0,Number(params.get('template')||1)-1),affected=journalTemplateRecipients(index).filter(item=>!item.quick).length;
    if(commonJournalDraft&&!confirmed){dialog('퀵체크를 저장할까요?',`<p>공통 퀵체크를 사용하는 ${affected}명에게 적용돼요. 기존 일지는 그대로 남아요.</p>`,'저장',()=>saveQuick(true));return;}
    const items=copy(configurationQuickChecks());if(quickIndex===null)items.push(copy(q));else items[quickIndex]=copy(q);
    if(commonJournalDraft){
      preserveJournalSchemas(index);const pendingLabels=$$('#configuration-form input').map(x=>x.value);commonJournalDraft.quickChecks=items;state.journalTemplateConfigs[index]=copy(commonJournalDraft);if(state.journalTemplates[index])state.journalTemplates[index].quickChecks=items.length;if(!await persist())return;commonJournalSnapshot=JSON.stringify(commonJournalDraft);$('#quick-dialog').close();prepareConfiguration();$$('#configuration-form input').forEach((el,i)=>el.value=pendingLabels[i]);$('#configuration-form button[type=submit]').disabled=JSON.stringify(pendingLabels)===configSnapshot;toast('퀵체크를 저장했어요.');return;
    }
    state.quickChecks[recipient]=items;if(!await persist())return;$('#quick-dialog').close();prepareConfiguration();toast('퀵체크를 저장했어요.');
  }
  function scoreSeed(template=2){
    const t=LIVE_SCORING[template]||LIVE_SCORING[2];
    const domains=template===0?[t.domains[0],t.domains[3],t.domains[1],t.domains[4],t.domains[2]]:template===1?[t.domains[0],t.domains[3],t.domains[1],t.domains[4],t.domains[2]]:[t.domains[0],t.domains[3],t.domains[1],t.domains[4],t.domains[2]];
    return {title:t.title,templateId:t.id,version:'live-2026-11-08',domains:domains.map(d=>({name:d.name,questions:[...d.questions]}))};
  }
  function scoreTemplateIndex(draft){
    const i=LIVE_SCORING.findIndex(t=>t.id===draft?.templateId||t.title===draft?.title);
    return i<0?2:i;
  }
  function currentScoring(index=recipient){const selected=state.reportTemplates[index]||'누리과정',template=LIVE_SCORING.findIndex((t,i)=>(state.reportTemplateConfigs?.[i]?.title||t.title)===selected);return state.scoring[index]||state.reportTemplateConfigs?.[template]||scoreSeed(template<0?2:template);}
  let scoreCurrentDomain=0;
  function openScoring(common=false,templateIndex=null){
    const query=new URLSearchParams();
    if(common){query.set('mode','common');if(Number.isInteger(templateIndex))query.set('template',String(templateIndex));}
    else query.set('recipient',String(detailRecipient));
    routeTo('#/recipients/scoring?'+query);
  }
  function prepareScoring(){
    editingCommonReport=params.get('mode')==='common';
    const requested=params.has('template')?Number(params.get('template')):null;
    editingReportTemplateIndex=editingCommonReport&&Number.isInteger(requested)&&requested>=0&&requested<LIVE_SCORING.length?requested:null;
    if(!editingCommonReport)detailRecipient=recipient;
    const templateDraft=editingReportTemplateIndex===null?null:state.reportTemplateConfigs?.[editingReportTemplateIndex];
    scoreDraft=copy(editingCommonReport?(templateDraft||state.commonTemplates?.report||scoreSeed(editingReportTemplateIndex??2)):currentScoring(detailRecipient));
    scoreSnapshot=JSON.stringify(scoreDraft);scoreCurrentDomain=0;drawScoring();
  }
  function scorePageDirty(){if(route!=='/recipients/scoring'||!$('#score-edit-form'))return false;readScoreDraft();return JSON.stringify(scoreDraft)!==scoreSnapshot;}
  function readScoreDraft(){
    if(!$('#score-edit-form'))return;
    scoreDraft.title=$('#score-template-title').value;
    scoreDraft.domains.forEach((domain,i)=>{domain.name=$('#score-domain-title-'+i).value;domain.questions=$$(`[data-score-question="${i}"]`).map(el=>el.value);});
  }
  function drawScoring(){
    const domains=scoreDraft.domains;
    scoreCurrentDomain=Math.max(0,Math.min(scoreCurrentDomain,domains.length-1));
    const domainNav=domains.map((d,i)=>`<button type="button" class="score-area-option" data-action="score-select-domain" data-index="${i}" aria-pressed="${i===scoreCurrentDomain}"><span>${escapeHTML(d.name||'이름 없는 영역')}</span><small>${d.questions.length}</small></button>`).join('');
    const panels=domains.map((d,i)=>`<section class="score-area-panel" ${i===scoreCurrentDomain?'':'hidden'} aria-label="${escapeHTML(d.name)} 문항"><header class="score-area-heading"><div><div class="score-title-editor"><label class="sr-only" for="score-domain-title-${i}">${i+1}번째 영역명</label><span class="score-title-input"><input id="score-domain-title-${i}" maxlength="40" value="${escapeHTML(d.name)}" aria-describedby="score-domain-title-${i}-limit"><small class="field-limit" id="score-domain-title-${i}-limit">${d.name.length}/40자</small></span></div><p>문항 ${d.questions.length}개${d.questions.length<5?' · 리포트 생성에는 5개 이상 필요':''}</p></div></header><ol class="score-question-list">${d.questions.map((q,j)=>`<li><span>${j+1}</span><div><label class="sr-only" for="score-question-${i}-${j}">${escapeHTML(d.name)} ${j+1}번 문항</label><textarea id="score-question-${i}-${j}" data-score-question="${i}" maxlength="80" rows="1" aria-describedby="score-question-${i}-${j}-limit">${escapeHTML(q)}</textarea><small class="field-limit score-input-limit" id="score-question-${i}-${j}-limit">${q.length}/80자</small></div><button class="button danger" type="button" data-action="score-delete-question" data-index="${i}" data-question="${j}" aria-label="${escapeHTML(d.name)} ${j+1}번 문항 삭제">삭제</button></li>`).join('')}</ol><button class="score-question-add" type="button" data-action="score-add-question" data-index="${i}" ${d.questions.length>=15?'disabled':''}>+ 문항 추가 (${d.questions.length}/15)</button></section>`).join('');
    $('.score-editor-page').innerHTML=`<a class="score-editor-back" href="#/recipients?tab=report"><svg class="mobile-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span class="desktop-back-chevron" aria-hidden="true">‹</span> 대상·템플릿</a><form id="score-edit-form"><div class="score-editor-heading"><h1>리포트 템플릿 편집</h1></div><section class="score-editor-top card"><div class="score-editor-template"><div class="score-title-editor"><div class="dropdown score-title-text"><button type="button" class="dropdown-trigger" data-options="score-templates" aria-label="편집할 템플릿 고르기" aria-haspopup="listbox" aria-expanded="false"><span>${escapeHTML(scoreDraft.title)}</span></button></div><label class="sr-only" for="score-template-title">템플릿 이름</label><span class="score-title-input"><input id="score-template-title" maxlength="40" value="${escapeHTML(scoreDraft.title)}" aria-describedby="score-template-title-limit" hidden><small class="field-limit" id="score-template-title-limit">${scoreDraft.title.length}/40자</small></span><button type="button" class="button secondary score-title-done" data-action="score-title-done" hidden>완료</button><button type="button" class="button secondary score-title-edit" data-action="score-title-edit" data-target="score-template-title" aria-label="템플릿 이름 수정">수정</button></div></div><div class="score-editor-actions"><button class="button secondary" type="button" data-action="score-reset">초기화</button><button class="button primary" type="submit">저장</button><p class="score-editor-status" role="status" data-score-status></p></div></section><div class="score-editor-workspace card"><aside class="score-area-list"><div class="score-area-list-heading"><h2>영역</h2><span>${domains.length}/5</span></div><div class="score-area-mobile-row"><div class="score-area-mobile-select dropdown"><button type="button" class="dropdown-trigger" data-options="score-domains" aria-label="영역 선택" aria-haspopup="listbox" aria-expanded="false"><span>${escapeHTML(domains[scoreCurrentDomain]?.name||'영역 선택')}</span></button></div><button class="button secondary score-area-mobile-reset" type="button" data-action="score-reset">초기화</button></div><div class="score-area-options">${domainNav}</div></aside><div class="score-area-content">${panels||'<p class="score-area-empty">영역이 없어요. 초기화하면 기본 영역을 불러올 수 있어요.</p>'}</div></div><div class="score-mobile-save"><p class="score-editor-status" role="status" data-score-status></p><button class="button primary" type="submit">저장</button></div></form>`;
    updateScoreSave();
    const rail=$('.score-area-options'),selected=$('.score-area-option[aria-pressed="true"]');
    if(rail&&selected){const r=rail.getBoundingClientRect(),s=selected.getBoundingClientRect();if(s.right>r.right)rail.scrollLeft+=s.right-r.right;else if(s.left<r.left)rail.scrollLeft-=r.left-s.left;}
  }
  function updateScoreSave(){const form=$('#score-edit-form');if(!form)return;readScoreDraft();$$('button[type="submit"]',form).forEach(button=>button.disabled=JSON.stringify(scoreDraft)===scoreSnapshot);}
  async function saveScoring(confirmed=false){
    readScoreDraft();if(!scoreDraft.title.trim()){$$('[data-score-status]').forEach(status=>status.textContent='템플릿 이름을 입력해 주세요.');const input=$('#score-template-title'),editor=input.closest('.score-title-editor');$('.score-title-text',editor).hidden=true;input.hidden=false;$('.score-title-edit',editor).hidden=true;input.focus();return false;}
    if(editingCommonReport&&editingReportTemplateIndex!==null&&!confirmed){const affected=reportTemplateRecipients(editingReportTemplateIndex).filter(item=>!item.custom).length;dialog('리포트 템플릿을 저장할까요?',`<p>공통 기준을 사용하는 ${affected}명의 새 리포트에 적용돼요. 기존 리포트와 개별 기준은 그대로 유지돼요.</p>`,'저장',()=>saveScoring(true));return;}
    const previous={configs:copy(state.reportTemplateConfigs||{}),templates:copy(state.reportTemplates),common:copy(state.commonTemplates||{}),scoring:copy(state.scoring)};
    const restore=()=>{state.reportTemplateConfigs=previous.configs;state.reportTemplates=previous.templates;state.commonTemplates=previous.common;state.scoring=previous.scoring;};
    if(editingCommonReport){
      if(editingReportTemplateIndex===null)mockupSaveCommonTemplate(state,'report',scoreDraft);
      else {const oldTitle=state.reportTemplateConfigs?.[editingReportTemplateIndex]?.title||LIVE_SCORING[editingReportTemplateIndex].title;(state.reportTemplateConfigs||={})[editingReportTemplateIndex]=copy(scoreDraft);state.recipients.forEach((_,i)=>{if((state.reportTemplates[i]||'누리과정')===oldTitle)state.reportTemplates[i]=scoreDraft.title;});}
      if(!await persist()){restore();return false;}scoreSnapshot=JSON.stringify(scoreDraft);if(route==='/recipients')renderRecipients();updateScoreSave();
      $$('[data-score-status]').forEach(status=>status.textContent='리포트 공통 템플릿을 저장했어요.');return true;
    }
    state.scoring[detailRecipient]=copy(scoreDraft);state.reportTemplates[detailRecipient]=scoreDraft.title;if(!await persist()){restore();return false;}scoreSnapshot=JSON.stringify(scoreDraft);
    $$('[data-score-status]').forEach(status=>status.textContent='저장했어요. 새 리포트부터 적용돼요.');updateScoreSave();return true;
  }
  function prepareSettings(){
    const invite=$('#account-invite-url');if(invite){const url=new URL(location.href);url.hash='/invite?code=careit-demo';invite.value=url.href;}
    $$('[data-account-name]').forEach(el=>el.textContent=state.profile.name);
    syncSidebarProfile();
    const plan=$('[data-account-plan]'),activePlan=mockupActivePlan(state,currentDate());if(plan)plan.textContent=activePlan?checkoutPlans[activePlan].name:'무료';
    const marketing=$('[data-action="marketing-consent"]');
    if(marketing){marketing.textContent=state.marketingConsent?'철회하기':'동의하기';marketing.dataset.consentState=state.marketingConsent?'agreed':'not-agreed';marketing.setAttribute('aria-label',`마케팅 정보 수신 ${marketing.textContent}`);$('[data-marketing-status]').textContent=state.marketingConsent?'수신 동의함':'수신 동의하지 않음';}
    $$('.session-list li[data-session-id]').forEach(item=>{if((state.mockRemovedSessionIds||[]).includes(item.dataset.sessionId))item.remove();});
    const sessionCount=$('[data-session-count]');if(sessionCount)sessionCount.textContent=`${$$('.session-list li').length}개`;
    const logoutOthers=$('.session-details > [data-action="account-preview"]');if(logoutOthers)logoutOthers.disabled=!$$('.session-list li:not(:has(.session-badge))').length;
    const list=$('.inactive-recipient-list');
    if(list)list.innerHTML=state.recipients.map((r,i)=>!r.active&&!r.deleted?`<li><strong>${escapeHTML(r.name)}</strong><div class="inactive-recipient-actions"><button type="button" class="button primary" data-action="reactivate" data-index="${i}">활성화</button><button type="button" class="button danger-soft" data-action="account-preview" data-index="${i}">완전삭제</button></div></li>`:'').join('')||'<li>비활성화된 관리대상이 없어요.</li>';
    const consent=$('[data-action="ai-consent"]');
    if(consent){
      consent.textContent=state.aiConsent?'철회하기':'동의하기';consent.dataset.consentState=state.aiConsent?'agreed':'not-agreed';consent.className=state.aiConsent?'button danger':'button tertiary';consent.setAttribute('aria-label',`AI 기능 ${consent.textContent}`);
      $('[data-ai-consent-status]').textContent=state.aiConsent?'동의함':'동의하지 않음';
      const details=$('[data-ai-consent-details]');
      details.innerHTML=state.aiConsent?'<div><dt>동의 상태</dt><dd>동의함</dd></div><div><dt>동의한 시각</dt><dd>11월 1일 오후 2:18</dd></div><div><dt>안내 문구 버전</dt><dd>2026-10-13-ai-consent-3</dd></div>':'<div><dt>동의 상태</dt><dd>동의하지 않음</dd></div>';
    }
  }
  function openPasswordDialog(){let el=$('#mock-password-dialog');if(!el){el=document.createElement('dialog');el.id='mock-password-dialog';el.addEventListener('cancel',event=>{if($('#mock-password-form',el)?.dataset.saving)event.preventDefault();});document.body.append(el);}el.className='confirm-dialog account-password-dialog';el.setAttribute('aria-labelledby','change-password-title');el.setAttribute('aria-describedby','change-password-notice');el.innerHTML=`<h2 id="change-password-title">비밀번호 변경</h2><p id="change-password-notice">바꾸면 다른 기기에서는 모두 로그아웃돼요. 이 기기는 그대로예요.</p><form id="mock-password-form" novalidate>${['현재 비밀번호','새 비밀번호','새 비밀번호 확인'].map((label,i)=>`<div class="field"><label for="change-password-${i}">${label}</label><div class="password-field"><input id="change-password-${i}" data-label="${label}" autocomplete="${i?'new-password':'current-password'}" type="password" aria-describedby="password-guidance password-error"><button type="button" data-action="password-toggle" aria-controls="change-password-${i}" aria-label="${label} 보기">보기</button></div></div>`).join('')}<p class="field-help" id="password-guidance">8자 이상, 영문·숫자·특수문자를 포함해 주세요</p><p class="field-help password-error" id="password-error" role="alert" data-password-message hidden></p><div class="dialog-actions"><button class="button secondary" type="button" data-action="close-modal" data-modal="mock-password-dialog">취소</button><button class="button primary">비밀번호 바꾸기</button></div></form>`;el.showModal();}
  async function changeMockPassword(form){
    if(form.dataset.saving)return;
    const inputs=$$('input',form),[current,next,confirmation]=inputs.map(input=>input.value),message=$('[data-password-message]',form),submit=$('button.primary',form),cancel=$('[data-action="close-modal"]',form);
    const fail=(index,text)=>{inputs.forEach(input=>input.removeAttribute('aria-invalid'));if(index!==null){inputs[index].setAttribute('aria-invalid','true');inputs[index].focus();}message.textContent=text;message.hidden=false;};
    if(!current)return fail(0,'현재 비밀번호를 입력해 주세요.');
    if(!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d\s]).{8,}$/.test(next))return fail(1,'새 비밀번호는 8자 이상, 영문·숫자·특수문자를 포함해 주세요.');
    if(!confirmation)return fail(2,'새 비밀번호를 한 번 더 입력해 주세요.');
    if(next!==confirmation)return fail(2,'새 비밀번호가 일치하지 않아요.');
    if(next===current)return fail(1,'현재 비밀번호와 다른 비밀번호를 입력해 주세요.');
    if(!globalThis.crypto?.subtle)return fail(null,'이 브라우저에서는 비밀번호 변경을 사용할 수 없어요.');
    form.dataset.saving='true';submit.disabled=true;cancel.disabled=true;
    try{
      const valid=state.mockPassword ? await mockupPasswordHash(current,state.mockPassword.salt)===state.mockPassword.hash : current==='Careit123!';
      if(!valid){fail(0,'현재 비밀번호가 일치하지 않아요.');return;}
      const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
      const previousPassword=state.mockPassword,previousSessions=state.mockRemovedSessionIds;
      state.mockPassword={salt,hash:await mockupPasswordHash(next,salt)};
      const otherSessions=$$('.session-list li[data-session-id]').filter(item=>!$('.session-badge',item)).map(item=>item.dataset.sessionId);
      state.mockRemovedSessionIds=[...new Set([...(previousSessions||[]),...otherSessions])];
      if(!await persist()){state.mockPassword=previousPassword;state.mockRemovedSessionIds=previousSessions;return;}
      form.reset();$('#mock-password-dialog').close();prepareSettings();toast('비밀번호를 변경했어요.');
    }catch{fail(null,'비밀번호를 변경하지 못했어요. 다시 시도해 주세요.');}
    finally{delete form.dataset.saving;submit.disabled=false;cancel.disabled=false;}
  }
  function openConsent(){
    const terms=$('#page-settings').content.querySelectorAll('.settings-consent-terms')[1].outerHTML;
    const modal=editorDialog('consent-dialog','confirm-dialog consent-dialog','AI 기능을 쓰기 전에 알려드려요',`<p>일지 내용을 AI 서비스로 보내 문장을 다듬고, 한 주의 기록을 채점·요약한 리포트를 만들어요. 동의하지 않아도 일지를 직접 쓰고 저장할 수 있어요.</p><details class="consent-terms-toggle"><summary>동의 내용 전체 보기</summary>${terms}</details><fieldset class="consent-items"><legend>내용을 확인하고 선택해 주세요</legend><div class="consent-item"><input type="checkbox" id="consent-data"><div><label for="consent-data">AI 기능을 위한 민감정보(건강정보) 수집·이용에 동의해요</label><p>요청한 AI 기능에 일지 내용이 사용돼요.</p></div></div><div class="consent-item"><input type="checkbox" id="consent-check"><div><label for="consent-check">AI 기능을 위한 개인정보 국외 이전에 동의해요</label><p>요청 시 관련 정보가 미국의 Google LLC로 전송돼요.</p></div></div></fieldset><p>AI 결과는 틀릴 수 있어요. 저장하기 전에 내용을 확인해 주세요.</p><div class="dialog-actions"><button type="button" class="button primary" data-action="accept-consent" disabled>동의하고 켜기</button></div>`);
    modal.addEventListener('change',()=>{$('[data-action="accept-consent"]',modal).disabled=!$$('.consent-items input',modal).every(x=>x.checked);});
  }
  function accountDialog(button){
    const label=button.textContent.trim(),isSession=!!button.closest('.session-list'),all=label==='다른 기기 모두 로그아웃';
    let title='로그아웃할까요?',message='현재 브라우저에 보관된 로그인 세션이 삭제됩니다.',confirm='로그아웃';
    if(button.getAttribute('aria-label')?.includes('세션')||isSession){title='선택한 기기에서 로그아웃할까요?';message='선택한 기기의 로그인이 즉시 해제돼요.';}
    if(all){title='다른 기기에서 모두 로그아웃할까요?';message='현재 브라우저를 제외한 모든 기기의 로그인이 해제돼요.';}
    if(label==='계정 탈퇴'){title='계정 탈퇴를 신청할까요?';message='모든 기기에서 즉시 로그아웃되고 다시 로그인할 수 없어요. 기록은 30일 후 완전히 삭제돼요.';confirm='탈퇴 신청';}
    if(label==='완전삭제'){const name=state.recipients[Number(button.dataset.index)]?.name||'이지훈';title=`「${name}」 관리대상을 완전삭제할까요?`;message=`「${name}」의 관리대상 정보·일지(휴지통 포함)·리포트·IEP 계획과 개별 설정이 모두 삭제되고 복원할 수 없어요. 공통 템플릿은 유지돼요.`;confirm='완전삭제';}
    dialog(title,`<p>${escapeHTML(message)}</p>`,confirm,async()=>{
      if(label==='로그아웃'&&(!isSession||button.closest('li')?.querySelector('.session-badge'))){try{localStorage.removeItem('careit-mockup-auto-login');}catch{}location.href='login.html';return;}
      if(label==='완전삭제'){if(!await deleteRecipientPermanently(Number(button.dataset.index)))return;prepareSettings();}
      else if(isSession||all){const previous=state.mockRemovedSessionIds;const rows=isSession?[button.closest('li')]:$$('.session-list li').filter(li=>!$('.session-badge',li));state.mockRemovedSessionIds=[...new Set([...(previous||[]),...rows.map(li=>li.dataset.sessionId)])];if(!await persist()){state.mockRemovedSessionIds=previous;return;}prepareSettings();}
      toast(label==='완전삭제'?'관리대상을 완전히 삭제했어요.':label==='계정 탈퇴'?'탈퇴 신청을 접수했어요.':'로그아웃했어요.');
    },true);
  }
  function handlePopupAction(action,button,e){
    if(action==='confirm-dialog'){const callback=confirmAction;confirmAction=null;$('#mockup-dialog').close();callback?.();}
    else if(action==='common-edit'){if(button.dataset.kind==='journal')routeTo('#/settings/configuration?template=common');else if(button.dataset.kind==='report')openScoring(true);}
    else if(action==='close-modal')closeEditorDialog(button.dataset.modal);
    else if(action==='discard-and-close'){const close=pendingClose;pendingClose=null;confirmAction=null;$('#mockup-dialog').close();close?.();}
    else if(action==='discard-and-move'){const move=pendingNavigation;pendingNavigation=null;confirmAction=null;$('#mockup-dialog').close();const previous=location.hash;navigationApproved=true;move?.();if(location.hash===previous)navigationApproved=false;}
    else if(action==='new-quick-check')openQuickEditor();
    else if(action==='edit-quick-check')openQuickEditor(Number(button.dataset.index));
    else if(action==='quick-toggle'){readQuickDraft();quickDraft.active=!quickDraft.active;drawQuickEditor();}
    else if(action==='quick-option-add'){readQuickDraft();if(quickDraft.choices.length<6){quickDraft.choices.push({name:'',active:true});drawQuickEditor();$(`[data-choice-input="${quickDraft.choices.length-1}"]`)?.focus();}}
    else if(action==='quick-option-delete'){readQuickDraft();if(quickDraft.choices.length>2){quickDraft.choices.splice(Number(button.dataset.index),1);drawQuickEditor();}}
    else if(action==='quick-type-cancel')$('#quick-type-picker').close();
    else if(action==='quick-type-save'){const selected=$('input[name="quick-type-choice"]:checked')?.value;$('#quick-type-picker').close();if(selected&&selected!==quickDraft.type){const apply=()=>{quickDraft.type=selected;if(selected==='텍스트')quickDraft.maxLength=200;drawQuickEditor();};if(quickIndex!==null)dialog('입력 방식을 바꿀까요?','<p>입력 방식을 바꿔도 이미 쓴 일지의 값은 그대로 남아요. 새로 입력할 때부터 바뀐 방식이 적용돼요.</p>','바꾸기',apply);else apply();}}
    else if(action==='quick-delete'){const index=Math.max(0,Number(params.get('template')||1)-1),affected=journalTemplateRecipients(index).filter(item=>!item.quick).length;dialog('퀵체크를 삭제할까요?',`<p>공통 퀵체크를 사용하는 ${affected}명에게 적용돼요. 이미 저장된 일지는 그대로 남아요.</p>`,'삭제',async()=>{preserveJournalSchemas(index);commonJournalDraft.quickChecks.splice(quickIndex,1);state.journalTemplateConfigs[index]=copy(commonJournalDraft);state.journalTemplates[index].quickChecks=commonJournalDraft.quickChecks.length;if(await persist()){commonJournalSnapshot=JSON.stringify(commonJournalDraft);$('#quick-dialog').close();prepareConfiguration();toast('퀵체크를 삭제했어요.');}},true);}
    else if(action==='quick-option-edit')quickOptionEditor(Number(button.dataset.index));
    else if(action==='quick-option-toggle'){readQuickDraft();const item=quickDraft.choices[Number(button.dataset.index)];item.active=!item.active;drawQuickEditor();}
    else if(action==='quick-option-cancel')$('[data-quick-option-editor]').replaceChildren();
    else if(action==='quick-option-save'){
      const input=$('#quick-option-name'),name=input.value.trim();if(!name){input.focus();return true;}
      if(quickDraft.choices.some((c,i)=>c.name===name&&String(i)!==button.dataset.index)){input.setCustomValidity('같은 이름의 항목이 있어요.');input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return true;}
      readQuickDraft();if(button.dataset.index==='')quickDraft.choices.push({name,active:true});else quickDraft.choices[Number(button.dataset.index)].name=name;drawQuickEditor();
    }
    else if(action==='scoring')openScoring();
    else if(action==='score-title-edit'){const input=document.getElementById(button.dataset.target),editor=button.closest('.score-title-editor'),label=$('.score-title-text',editor);label.hidden=true;input.hidden=false;button.hidden=true;$('.score-title-done',editor).hidden=false;input.focus();input.select();}
    else if(action==='score-title-done'){const input=$('input',button.closest('.score-title-editor'));finishScoreTitle(input);}
    else if(action==='score-select-domain'){readScoreDraft();scoreCurrentDomain=Number(button.dataset.index);drawScoring();$(`[data-action="score-select-domain"][data-index="${scoreCurrentDomain}"]`)?.focus();}
    else if(action==='score-help')button.setAttribute('aria-expanded',button.getAttribute('aria-expanded')!=='true');
    else if(action==='score-reset')dialog('관찰 문항을 초기화할까요?','<p>영역명과 문항을 기본 템플릿으로 되돌려요. 저장 전까지 기존 기준은 유지돼요.</p>','초기화',()=>{scoreDraft=scoreSeed(scoreTemplateIndex(scoreDraft));drawScoring();});
    else if(action==='score-add-question'){readScoreDraft();const i=Number(button.dataset.index);scoreDraft.domains[i].questions.push('');drawScoring();$(`#score-question-${i}-${scoreDraft.domains[i].questions.length-1}`).focus();}
    else if(action==='score-delete-question'){readScoreDraft();scoreDraft.domains[Number(button.dataset.index)].questions.splice(Number(button.dataset.question),1);drawScoring();}
    else if(action==='ai-consent'){
      if(state.aiConsent)dialog('AI 기능 동의를 철회할까요?','<p>이제 일지 내용이 외부로 전송되지 않아요. 문장 다듬기·주간 리포트 생성이 함께 꺼져요. 이미 다듬어 저장한 일지는 그대로 남고, 언제든 다시 동의할 수 있어요.</p>','철회',async()=>{state.aiConsent=false;if(!await persist())return;prepareSettings();},true);
      else openConsent();
    }
    else if(action==='accept-consent'){state.aiConsent=true;persist().then(saved=>{if(!saved)return;$('#consent-dialog').close();if(route==='/settings')prepareSettings();toast('AI 기능을 켰어요.');});}
    else if(action==='ai-preview'){
      if(!mockupActivePlan(state,currentDate())){dialog('플러스 요금제에서 이용할 수 있어요','<p>AI 문장 정리는 플러스와 팀 요금제에서 이용할 수 있어요.</p>','요금제 보기',()=>routeTo('#/plans'));return;}
      if(!state.aiConsent){openConsent();return;}
      if(journalAiComparison){toast('정리된 문장을 확인해 주세요.');$('.journal-memo-card')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
      const fields=$$('.journal-memo-fields textarea').filter(field=>field.value.trim());
      if(!fields.length){toast('정리할 일지 기록을 입력해 주세요.');$('#journal-raw').focus();return;}
      dialog('AI 문장 정리를 사용할까요?','<p>AI 문장 정리는 관리대상별 하루에 한 번 사용할 수 있어요.</p>','문장 정리',()=>{
        startJournalAiComparison(fields);$('.journal-memo-card')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    }
    else if(action==='journal-ai-view')setJournalAiView(button.closest('.field').querySelector('textarea').id,button.dataset.aiView);
    else if(action==='account-preview')accountDialog(button);
    else if(action==='reactivate'){const i=Number(button.dataset.index);if(!recipientHasCapacity()){showRecipientLimit();return;}dialog('관리대상을 활성화할까요?',`<p>「${escapeHTML(state.recipients[i].name)}」을 홈과 기록 작성 목록에서 다시 볼 수 있어요.</p>`,'활성화',async()=>{if(!recipientHasCapacity()){showRecipientLimit();return;}const r=state.recipients[i],previous=copy(r);r.active=true;delete r.pausedByPlanLimit;if(!await persist()){Object.assign(r,previous);return;}prepareSettings();});}
    else if(action==='toggle-recipient'){const r=state.recipients[detailRecipient];if(r.active)return;if(!r.active&&!recipientHasCapacity()){showRecipientLimit();return;}dialog(r.active?'관리대상을 비활성화할까요?':'관리대상을 활성화할까요?',`<p>${r.active?'홈과 기록 작성 목록에서 제외돼요. 기존 일지와 리포트는 보관돼요.':'홈과 기록 작성 목록에 다시 표시돼요.'}</p>`,r.active?'비활성화':'활성화',async()=>{if(!r.active&&!recipientHasCapacity()){showRecipientLimit();return;}const previous=copy(r);r.active=!r.active;delete r.pausedByPlanLimit;if(!await persist()){Object.assign(r,previous);return;}$('#recipient-dialog').close();renderRecipients();});}
    else if(action==='trash-report')dialog('리포트를 휴지통으로 옮길까요?','<p>30일 동안 휴지통에서 복원할 수 있어요.</p>','휴지통으로',async()=>{const chosen=reportRecords(recipient).find(item=>item.id===params.get('report'))||reportRecords(recipient)[0];if(!chosen)return;(state.hiddenReportIds||=[]).push(`${recipient}:${chosen.id}`);state.trash.push({type:'report',recipient,date:currentDate(),title:`${formatShortDate(chosen.from)} – ${formatShortDate(chosen.to)} 주간 리포트`,reportId:chosen.id});if(!await persist())return;routeTo(`#/records?recipient=${recipient}&tab=reports`);toast('리포트를 휴지통으로 옮겼어요.');},true);
    else if(action==='restore-trash'){const i=Number(button.dataset.index);dialog('기록을 복원할까요?','<p>복원한 기록은 기록 목록에서 다시 볼 수 있어요.</p>','복원',async()=>{const item=state.trash[i];if(item.type==='report'){if(state.reportRemoved)state.reportRemoved[item.recipient]=false;if(item.reportId)state.hiddenReportIds=(state.hiddenReportIds||[]).filter(key=>key!==`${item.recipient}:${item.reportId}`);}if(item.type==='journal'&&item.key)state.deletedJournalKeys=(state.deletedJournalKeys||[]).filter(key=>key!==item.key);state.trash.splice(i,1);if(!await persist())return;renderRecords();});}
    else if(action==='delete-trash'){const i=Number(button.dataset.index);dialog('기록을 완전히 삭제할까요?','<p>완전히 삭제한 기록은 복원할 수 없어요.</p>','완전삭제',async()=>{state.trash.splice(i,1);if(!await persist())return;renderRecords();},true);}
    else if(action==='generate-report'){
      if(!state.aiConsent){openConsent();return true;}
      if(!mockupReportEligibility(reportRange,currentDate(),reportDays()).allowed||currentScoring().domains.length<3||currentScoring().domains.length>5||currentScoring().domains.some(domain=>domain.questions.length<5)){updateReportPeriod();return true;}
      dialog('리포트를 생성할까요?',`<p>${escapeHTML(state.recipients[recipient].name)} · ${formatDate(reportRange.from)} ~ ${formatDate(reportRange.to)} · 기록 ${reportDays()}일 / 기준 3일.</p><p>관찰 기준: ${escapeHTML(currentScoring().title)}</p>`,'생성',async()=>{
        if(!state.aiConsent){openConsent();return;}
        if(!mockupReportEligibility(reportRange,currentDate(),reportDays()).allowed){updateReportPeriod();toast('생성 가능한 주간과 기록 일수를 다시 확인해 주세요.');return;}
        const days=reportDays(),id=`mock-${Date.now()}`,version=reportRecords(recipient).filter(item=>item.from===reportRange.from&&item.to===reportRange.to).length+1;
        (state.generatedReports||=[]).unshift({id,recipient,from:reportRange.from,to:reportRange.to,generated:currentDate(),version,days,mock:true,scoring:copy(currentScoring())});
        if(!await persist())return;routeTo(`#/reports?recipient=${recipient}&report=${id}`);toast('리포트를 생성했어요.');
      });
    }
    else if(action==='reset-design')dialog('편집 내용을 초기화할까요?','<p>수정한 문구와 스타일을 초기화해요. 저장한 일지와 관리대상은 유지돼요.</p>','초기화',async()=>{state.edits={};delete state.css;delete state.color;delete state.radius;if(!await persist())return;location.reload();});
    else if(action==='plan'){e.preventDefault();openPlanCheckout(button.dataset.plan||'starter');}
    else if(action==='toggle-plan-features'){const card=button.closest('.pricing-card'),expanded=card.classList.toggle('features-expanded');button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'기능 접기':'기능 전체 보기';}
    else if(action==='billing-demo-toggle'){billingDemoOpen=!billingDemoOpen;$('.qa-billing-toggle')?.remove();$('#qa-billing-panel')?.remove();renderBillingDemo();}
    else if(action==='billing-demo-select')setBillingDemo(button.dataset.plan);
    else if(action==='billing-demo-team-size')setBillingDemoTeamSize(Number(button.dataset.count));
    else if(action==='billing-demo-reset')setBillingDemo('reset');
    else if(action==='payment-details')openPaymentResult(false);
    else if(action==='checkout-policy')openCheckoutPolicy(button.dataset.policy,button.dataset.plan,button.dataset.date);
    else if(action==='cancel-renewal')cancelSubscriptionRenewal();
    else if(action==='payment-start'){$('#checkout-dialog').close();routeTo('#/journals/new');}
    else if(action==='team-invite')openTeamInvite();
    else if(action==='team-link-copy'){const input=$('#dialog-team-invite-url');if(navigator.clipboard)navigator.clipboard.writeText(input.value).then(()=>toast('참가 링크를 복사했어요.'),()=>{toast('링크를 선택해 복사해 주세요.');input.select();});else input.select();}
    else if(action==='team-link-disable'){state.subscription.mockInviteDisabled=true;persist().then(saved=>{if(saved)openTeamInvite();});}
    else if(action==='team-link-new'){state.subscription.mockInviteDisabled=false;state.subscription.mockInviteVersion=(state.subscription.mockInviteVersion||1)+1;persist().then(saved=>{if(saved)openTeamInvite();});}
    else if(action==='team-members'){$('#checkout-dialog').close();$('#team-members-title')?.scrollIntoView({block:'nearest'});}
    else if(action==='cancel-team-invite'){
      const sub=state.subscription,index=Number(button.dataset.index);
      if(sub?.invites[index])dialog('초대를 취소할까요?',`<p>${escapeHTML(sub.invites[index])}</p>`,'초대 취소',async()=>{const removed=sub.invites.splice(index,1);if(!await persist()){sub.invites.splice(index,0,...removed);return;}render();});
    }
    else if(action==='report-preview-open'){
      const original=$('.configured-report-viewport .configured-report-pages');
      if(!original)return;
      const viewer=document.createElement('dialog');viewer.className='report-document-modal';viewer.setAttribute('aria-label','리포트 문서 미리보기');
      viewer.innerHTML='<header class="report-document-modal-header"><strong>문서 미리보기</strong><button type="button" aria-label="미리보기 닫기">×</button></header><div class="report-document-modal-content" tabindex="0" aria-label="리포트 문서"></div><div class="report-document-modal-controls"><button type="button" data-zoom="fit">화면 맞춤</button><button type="button" data-zoom="out" aria-label="축소">−</button><output aria-live="polite"></output><button type="button" data-zoom="in" aria-label="확대">+</button></div>';
      const pages=original.cloneNode(true);pages.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));pages.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));
      const content=$('.report-document-modal-content',viewer),output=$('output',viewer),out=$('[data-zoom="out"]',viewer),inside=$('[data-zoom="in"]',viewer);content.append(pages);document.body.append(viewer);
      const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';let scale=0,fit=0;
      const updateZoom=()=>{pages.style.setProperty('--configured-report-scale',scale);output.textContent=`${Math.round(scale*100)}%`;out.disabled=scale<=fit;inside.disabled=scale>=2;};
      const resizeViewer=()=>{const wasFit=scale<=fit;fit=Math.min(1,Math.max(0,(content.clientWidth-24)/794));scale=wasFit?fit:Math.max(fit,scale);updateZoom();};
      if(document.body.classList.contains('mobile-app-preview')){
        let pinch=null;
        const distance=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
        content.addEventListener('touchstart',event=>{if(event.touches.length!==2)return;const rect=content.getBoundingClientRect(),x=(event.touches[0].clientX+event.touches[1].clientX)/2-rect.left,y=(event.touches[0].clientY+event.touches[1].clientY)/2-rect.top;pinch={distance:distance(event.touches),scale,x,y,left:content.scrollLeft,top:content.scrollTop};},{passive:true});
        content.addEventListener('touchmove',event=>{if(!pinch||event.touches.length!==2||!pinch.distance)return;event.preventDefault();scale=Math.min(2,Math.max(fit,pinch.scale*distance(event.touches)/pinch.distance));updateZoom();const ratio=scale/pinch.scale;content.scrollLeft=(pinch.left+pinch.x)*ratio-pinch.x;content.scrollTop=(pinch.top+pinch.y)*ratio-pinch.y;},{passive:false});
        content.addEventListener('touchend',()=>{pinch=null;},{passive:true});
        content.addEventListener('touchcancel',()=>{pinch=null;},{passive:true});
      }
      viewer.addEventListener('close',()=>{window.removeEventListener('resize',resizeViewer);document.body.style.overflow=previousOverflow;viewer.remove();if(button.isConnected)button.focus();},{once:true});
      $('.report-document-modal-header button',viewer).addEventListener('click',()=>viewer.close());
      $('[data-zoom="fit"]',viewer).addEventListener('click',()=>{scale=fit;content.scrollLeft=0;updateZoom();});
      out.addEventListener('click',()=>{scale=Math.max(fit,Math.round((scale-.2)*100)/100);updateZoom();});
      inside.addEventListener('click',()=>{scale=Math.min(2,Math.round((scale+.2)*100)/100);updateZoom();});
      viewer.showModal();resizeViewer();window.addEventListener('resize',resizeViewer);
    }
    else if(action==='payment-back')resetPaymentSimulation();
    else if(action==='reset-payment')dialog('결제 시연을 초기화할까요?','<p>목업의 결제·초대 상태만 지워요. 저장한 일지와 계획은 유지돼요.</p>','초기화',resetPaymentSimulation);
    else return false;
    return true;
  }
  function showStoredReport(report=reportRecords(recipient).find(item=>item.id==='sample')){
    const tpl=$('#report-document');if(!tpl)return;
    $('.reports-layout').replaceChildren(tpl.content.cloneNode(true));
    const viewport=$('.configured-report-viewport'),wrap=document.createElement('div'),trigger=document.createElement('button');wrap.className='report-mobile-preview-wrap';trigger.type='button';trigger.className='report-mobile-preview-trigger';trigger.dataset.action='report-preview-open';trigger.setAttribute('aria-label','리포트 문서 미리보기 열기');trigger.innerHTML='<span>+ 문서 미리보기</span>';viewport.before(wrap);wrap.append(viewport,trigger);viewport.setAttribute('aria-label','리포트 문서');requestAnimationFrame(scaleReports);
    $('.configured-report-word-hint').textContent='목업의 Word 파일은 텍스트로 저장돼요.';
    const dateRange=report?`${formatDate(report.from)} ~ ${formatDate(report.to)}`:'2026년 8월 28일 ~ 2026년 9월 3일',generated=report?formatDate(report.generated):'2026년 9월 20일',version=report?.version>1?` · 버전 ${report.version}`:'',name=recipient===0?'산책 샘플':state.recipients[recipient].name;
    $('.configured-report-actions p').textContent=`${name} · ${dateRange}`;
    const pages=$$('.configured-report-page');$('.configured-report-page-header p',pages[0]).textContent=dateRange;$('.configured-report-overview-metadata strong',pages[0]).textContent=name;$$('.configured-report-overview-metadata strong',pages[0])[1].textContent=generated+version;
    $('.configured-report-page-header h2',pages[1]).textContent=name;$('.configured-report-page-header p',pages[1]).textContent=`${dateRange} · 발행 ${generated}${version}`;
    const areas=report?.mock?report.scoring.domains.map(domain=>[domain.name,0,0,'목업에서는 AI 분석 결과를 생성하지 않아요.',domain.questions,domain.questions.map(()=>0)]):recipient===1?PICTURE_REPORT_AREAS:recipient===2?(report?.id==='test'?TEST_ORIGINAL_REPORT_AREAS:TEST_REPORT_AREAS):REPORT_AREAS;
    const total=report?.mock?areas.reduce((sum,area)=>sum+area[4].length,0):recipient===1||report?.id==='test'?59:25,evidence=report?.mock?0:recipient===1?37:report?.id==='test'?7:recipient===2?3:8,score=report?.mock?0:recipient===1?48:recipient===2?9:28,count=report?.mock?report.days:recipient===1||recipient===2?4:3;
    $$('.configured-report-stats dd',pages[0]).forEach((node,i)=>node.textContent=[`${count}건`,`${count}일`,`${total}/${total}`,`${evidence}/${total}`,`${total-evidence}문항`,`${score}점`][i]);
    const previous=$('.configured-report-section-header span',pages[0]);if(previous)previous.textContent=`이전 기간 기록 없음 · 판정 ${total}/${total} · 근거 ${evidence}/${total}문항`;
    $('.configured-report-overall-score strong',pages[0]).textContent=score;$('.configured-report-score-ring',pages[0]).setAttribute('aria-label',`종합 관찰 점수 ${score}점`);$('.configured-report-score-progress',pages[0]).setAttribute('stroke-dasharray',`${314.16*score/100} 314.16`);
    $('.configured-report-care-map-score strong',pages[1]).textContent=`${score}점`;$('.configured-report-care-map-score small',pages[1]).textContent=`판정 ${total}/${total} · 근거 ${evidence}/${total}문항`;
    const radar=$('.configured-report-radar',pages[1]),axes=[[210,20],[352.658,123.647],[298.168,291.353],[121.832,291.353],[67.342,123.647]],points=areas.map((area,i)=>[210+(axes[i][0]-210)*area[1]/100,170+(axes[i][1]-170)*area[1]/100]);
    radar.setAttribute('aria-label','영역별 관찰 점수: '+areas.map(a=>`${a[0]} ${a[1]}점`).join(', '));$('.configured-report-radar-shape',radar).setAttribute('points',points.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' '));$$('g',radar).forEach((group,i)=>{const circle=$('circle',group),label=$('.configured-report-radar-label tspan',group),value=$('.configured-report-radar-value',group);circle.setAttribute('cx',points[i][0]);circle.setAttribute('cy',points[i][1]);label.textContent=areas[i][0];value.textContent=areas[i][1];});
    $('[data-report-changes]').innerHTML=areas.map(([name,score])=>`<article class="configured-report-change-card"><strong>${name}</strong><em>비교하지 않음</em><div><b>${score}점</b></div><small>비교할 이전 주 점수가 없어요.</small></article>`).join('');
    $('[data-report-care]').insertAdjacentHTML('beforeend',areas.map(([name,score,evidence,copy,questions])=>`<article class="configured-report-care-card"><div><strong>${name}</strong><b>${score}점</b></div><em>판정 ${questions.length}/${questions.length} · 근거 ${evidence}/${questions.length}</em><p>${copy}</p></article>`).join(''));
    const point=n=>Number(n.toFixed(2)).toString(),label=(value,count)=>{const max=100/count,earned=max*(value||0)/4;return value===4?`반복 확인 · 100% · 획득 점수 ${point(earned)}/${point(max)}점 · 근거 2일`:value===3?`명확한 수행 · 75% · 획득 점수 ${point(earned)}/${point(max)}점 · 근거 1일`:value===2?`부분 수행·혼재 · 50% · 획득 점수 ${point(earned)}/${point(max)}점 · 근거 1일`:`근거 없음 · 0점 · 영역 내 배점 0/${point(max)}점`;};
    $('[data-report-questions]').innerHTML=areas.map(([name,score,evidence,copy,questions,scores])=>`<section><h3>${escapeHTML(name)}</h3><ol>${questions.map((question,i)=>`<li><p>${escapeHTML(question)}</p><span>${label(scores[i],questions.length)}</span></li>`).join('')}</ol></section>`).join('');
  }
  function downloadReportWord(){
    const text=$$('.configured-report-page').map(page=>page.innerText).join('\n\n');if(!text.trim())return;
    const xmlEscape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    const paragraphs=text.split('\n').map(line=>`<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`).join('');
    const files={
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`
    };
    const encoder=new TextEncoder(),chunks=[],central=[];let offset=0;
    const header=(size)=>{const data=new Uint8Array(size);return {data,view:new DataView(data.buffer)};};
    const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
    for(const [path,content] of Object.entries(files)){const name=encoder.encode(path),body=encoder.encode(content),crc=crc32(body),local=header(30),v=local.view;v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,name.length,true);chunks.push(local.data,name,body);const entry=header(46),c=entry.view;c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,body.length,true);c.setUint32(24,body.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.push(entry.data,name);offset+=local.data.length+name.length+body.length;}
    const directorySize=central.reduce((n,b)=>n+b.length,0),end=header(22),v=end.view;v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length/2,true);v.setUint16(10,central.length/2,true);v.setUint32(12,directorySize,true);v.setUint32(16,offset,true);
    const url=URL.createObjectURL(new Blob([...chunks,...central,end.data],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})),a=document.createElement('a');a.href=url;a.download='케어릿_주간_리포트.docx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const REPORT_AREAS=[
      ['국어',15,1,'이웃을 만났을 때 손을 흔드는 것과 함께 밝게 인사말을 건네보세요.', ['글의 중심 내용을 파악한다.','근거를 들어 자신의 의견을 말하거나 쓴다.','상대와 목적에 맞게 대화한다.','다양한 글과 매체를 비판적으로 이해한다.','읽은 내용을 요약하고 자신의 생각을 표현한다.'],[0,0,3,0,0]],
      ['수학',0,0,'이번 기록만으로는 조언을 제안하기 어려워요.', ['문제 상황에 맞는 계산 방법을 선택한다.','규칙과 관계를 식이나 표로 표현한다.','자료를 수집하고 표와 그래프로 나타낸다.','도형의 성질을 활용해 문제를 해결한다.','해결 과정을 설명하고 다른 방법을 비교한다.'],[0,0,0,0,0]],
      ['사회',20,1,'횡단보도를 건널 때 주변의 신호를 살피며 안전하게 이동하는 연습을 계속해 보세요.', ['공동체에서 지켜야 할 규칙과 책임을 이해한다.','사회 현상을 다양한 관점에서 살펴본다.','자료를 바탕으로 자신의 의견을 근거 있게 표현한다.','지역사회와 세계의 변화에 관심을 보인다.','협력하여 공동의 문제 해결에 참여한다.'],[4,0,0,0,0]],
      ['과학',35,2,'공원에서 관찰한 나무나 새의 특징을 그림으로 그려보거나 이름을 함께 찾아보세요. 주변의 쓰레기를 줍는 것처럼 자연을 깨끗하게 유지하는 활동을 꾸준히 실천해 보세요.', ['자연 현상에 대해 질문하고 관찰한다.','예상과 실험을 통해 탐구한다.','탐구 결과를 자료로 정리하고 설명한다.','과학 원리를 생활 문제에 적용한다.','환경과 생명을 존중하는 태도를 실천한다.'],[4,0,0,0,3]],
      ['예술·체육',70,4,'오리를 보며 숫자를 세어본 것처럼 주변 사물의 개수를 손가락으로 표현하며 놀이해 보세요. 산책할 때처럼 옆 사람과 보폭을 맞추며 걷는 활동을 즐겨보세요. 외출 후 손을 씻고 수건을 정리하는 습관을 스스로 계속 실천해 보세요.', ['음악과 미술, 움직임으로 생각과 느낌을 표현한다.','다양한 표현 방식을 감상하고 의견을 나눈다.','신체 활동에 꾸준히 참여하며 안전을 지킨다.','협력과 규칙이 필요한 활동에 참여한다.','건강한 생활 습관을 스스로 실천한다.'],[3,0,4,3,4]]
    ];
  const PICTURE_REPORT_AREAS=[
    ['신체운동·건강',29,5,'다양한 질감의 종이를 찢어 붙이는 활동을 통해 손가락 소근육을 지속적으로 사용해 보세요.',[0,0,3,3,0,0,2,3,0,0,0,3]],
    ['의사소통',65,10,'그림책 속 장면과 자신의 경험을 연결하여 이야기 나누는 시간을 가져보세요.',[3,3,4,3,3,0,3,0,3,3,3,3]],
    ['사회관계',38,6,'친구의 작품을 감상하고 서로의 생각에 대해 짧게 대화를 나누는 경험을 격려해 주세요.',[0,3,3,0,3,0,3,3,0,0,0,3]],
    ['예술경험',68,9,'자신이 만든 작품의 색깔이나 모양에 대해 자유롭게 이야기하며 표현해 보세요.',[3,3,3,3,3,3,3,3,0,3]],
    ['자연탐구',40,7,'그림책 속 동물이 어디에 있는지 찾아보며 사물의 위치와 공간 관계를 탐색해 보세요.',[3,3,3,0,0,0,3,0,0,3,0,3,3]]
  ].map(([name,score,evidence,copy,scores])=>[name,score,evidence,copy,LIVE_SCORING[0].domains.find(domain=>domain.name===name).questions,scores]);
  const TEST_REPORT_AREAS=REPORT_AREAS.map((area,i)=>[area[0],[0,15,0,0,30][i],[0,1,0,0,2][i],['이번 기록만으로는 조언을 제안하기 어려워요','조언을 준비하지 못했어요','이번 기록만으로는 조언을 제안하기 어려워요','이번 기록만으로는 조언을 제안하기 어려워요','크레파스로 그린 집 주변에 나무나 꽃을 그려 풍경을 완성해 보세요. 계단을 오르내릴 때 난간을 잡는 습관을 유지하며 안전하게 이동해 보세요.'][i],area[4],[[0,0,0,0,0],[0,3,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[3,0,3,0,0]][i]]);
  const TEST_ORIGINAL_REPORT_AREAS=[
    ['신체운동·건강',19,3,'난간을 잡고 계단을 오르내리는 연습을 꾸준히 격려해 주세요. 퍼즐 조각 수를 조금씩 늘려가며 난이도를 조절해 보세요. 블록을 활용해 다양한 모양을 만드는 놀이를 함께 즐겨보세요.',[0,3,3,3,0,0,0,0,0,0,0,0]],
    ['의사소통',6,1,'그린 그림에 대해 어떤 집인지 이야기를 나누며 끄적이기 활동을 확장해 보세요.',[0,0,0,0,0,0,0,0,0,0,3,0]],
    ['사회관계',0,0,'이번 기록만으로는 조언을 제안하기 어려워요',[0,0,0,0,0,0,0,0,0,0,0,0]],
    ['예술경험',15,2,'종이접기로 만든 작품을 활용해 새로운 놀이를 시도해 보세요. 그린 그림 속의 집을 블록이나 다른 재료로 입체적으로 만들어 보세요.',[0,0,0,3,0,3,0,0,0,0]],
    ['자연탐구',6,1,'조언을 준비하지 못했어요',[0,0,0,0,0,3,0,0,0,0,0,0,0]]
  ].map(([name,score,evidence,copy,scores])=>[name,score,evidence,copy,LIVE_SCORING[0].domains.find(domain=>domain.name===name).questions,scores]);
  const iep=createCareitIEP({state,persist,toast,dialog,escapeHTML,registerEdits,ageBands});
  $('#iep-mock-tier').addEventListener('change',event=>iep.simulate('tier',event.target.value));
  $('#iep-mock-outcome').addEventListener('change',event=>iep.simulate('outcome',event.target.value));
  $('#iep-mock-cycle').addEventListener('click',()=>iep.simulate('cycle'));
  applyDesign();syncSidebarTheme();render();
})();
