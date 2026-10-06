/* IEP 실행 계획 목업. 법령·고시의 구성 원칙 + 교사 입력 + 자체 작성 규칙을 사용합니다.
 * 모델 호출, 웹 검색, 기존 일지 분석은 하지 않습니다. */
'use strict';
function createCareitIEP({state,persist,toast,dialog,escapeHTML:esc,registerEdits,ageBands}) {
  const $=(s,r=root)=>r?.querySelector(s);
  const $$=(s,r=root)=>[...(r?.querySelectorAll(s)||[])];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const INPUT_FIELDS={semesterGoal:'semesterGoal',monthGoal:'monthGoal',baseline:'observation',strength:'strength',familyRequest:'familyRequest',participationNeeds:'participationNeeds'};
  // 계획 구성에 사용할 입력을 명시적으로 제한합니다. 대상 구분명·기존 메모·일지 원문은 읽지 않습니다.
  const PLANNING_LABELS={ageBand:'연령대',semesterGoal:'기존 IEP 목표',monthGoal:'월 목표',observation:'목표 관련 관찰',strength:'흥미와 강점',familyRequest:'보호자의 교육적 요청',participationNeeds:'활동 참여·안전 지원'};
  const OPTIONAL_CONTEXT_FIELDS=['familyRequest','participationNeeds'];
  const OPTIONAL_PRINT_FIELDS=['strength','semesterGoal',...OPTIONAL_CONTEXT_FIELDS];
  const REQUIRED_FIELDS=['baseline','monthGoal','activity','content','support','evaluationMethod','criterion'];
  const INPUT_LIMITS={observation:500,strength:500,monthGoal:500,semesterGoal:500,familyRequest:500,participationNeeds:500};
  const normalizeText=value=>String(value??'').replace(/\r\n?/g,'\n').normalize('NFC');
  // 일지의 value.length + 브라우저 maxlength와 같은 기준을 사용합니다.
  const textLength=value=>String(value??'').replace(/\r\n?/g,'\n').length;
  function constrainInput(el){
    const limit=el.maxLength;
    if(limit<1)return;
    if(el.value.length<=limit){delete el.dataset.iepPreserveLong;return;}
    if(el.dataset.iepPreserveLong)return;
    const caret=Math.min(el.selectionStart,limit);
    el.value=el.value.slice(0,limit).replace(/[\uD800-\uDBFF]$/,'');
    el.setSelectionRange(Math.min(caret,el.value.length),Math.min(caret,el.value.length));
  }
  const EMPTY_LABELS={semesterGoal:'기존 IEP 목표가 있으면 연결해 주세요.',nuri:'교사가 관련 누리과정을 확인해 주세요.',evaluationResult:'활동 후 실제 관찰을 기록해 주세요.'};
  const SOURCE_POLICY='law-own-2026-09-23';
  const SOURCES=[
    {id:'iep',label:'IEP 구성 요소',title:'장애인 등에 대한 특수교육법 시행규칙',meta:'제4조 · 개별화교육지원팀의 구성 등',
      url:'https://law.go.kr/LSW/lumLsLinkPop.do?chrClsCd=010202&lspttninfSeq=118478',
      principle:'개별화교육계획에는 현재 학습 수행 수준, 교육목표·내용·방법·평가계획 등이 포함됩니다.',
      application:'계획의 기본 항목을 구분하는 근거예요. 이 화면은 월간 실행을 돕는 자체 양식이며, 학교의 인적사항·지원팀·관련서비스 등 공식 IEP 전체를 대신하지 않아요.',
      usage:'법령 원문 · 저작권법 제7조 제1호에 따라 저작권 보호 대상에서 제외됩니다.'},
    {id:'nuri',label:'누리과정 고시',title:'유치원 교육과정',meta:'교육부 고시 제2019-189호 · 제1장 Ⅱ. 운영',
      url:'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000180641&chrClsCd=010201',
      principle:'유아의 흥미에 따른 놀이 참여와 개별 특성에 맞는 배움을 지원하고, 평가를 교육과정 운영 개선에 활용하도록 정하고 있어요.',
      application:'목표에 연결할 영역·내용과 활동·지원·관찰 방법을 제안하고 교사가 수정하도록 구성했어요. 특정 활동의 효과나 성공 기준을 이 고시에서 도출하지 않아요.',
      usage:'고시 원문 · 저작권법 제7조 제2호에 따라 저작권 보호 대상에서 제외됩니다. 별도 해설서·활동집은 포함하지 않아요.'},
    {id:'own',label:'케어릿 자체 구성',title:'케어릿 실행 계획 구성',meta:'교사 입력 · 자체 작성 양식과 합성 예시',
      principle:'입력한 관찰과 목표를 활동·지원·기록 항목에 연결합니다. 기간, 목표의 기준과 실제 관찰 결과는 교사가 정해요.',
      application:'월 목표 연결, 준비·진행·반응별 지원, 조건부 다음 계획과 표 화면은 케어릿 목업에서 작성한 구성이에요. 외부 활동집의 예시나 번역문을 제공하지 않아요.',
      usage:'자체 작성한 목업 내용입니다. 교육적 효과나 전문가 검증이 완료되었다는 뜻은 아니에요.'}
  ];
  // 이전 저장본의 출처를 새 근거로 바꿔 표시하지 않습니다. 원문·요약은 보관하지 않습니다.
  const RETIRED_SOURCES=[
    {id:'template',label:'이전 양식 참고',title:'2023 유치원 업무길라잡이',meta:'인천광역시교육청유아교육진흥원 · 이전 참고 이력',usage:'판권면에 무단 복제·배포 금지가 있어 신규 계획의 자료에서 제외했어요.'},
    {id:'curriculum',label:'이전 해설서 참고',title:'2022 개정 특수교육 교육과정 총론 해설',meta:'이전 참고 이력',usage:'상업적 가공·재사용 조건을 확인하지 못해 신규 계획의 자료에서 제외했어요.'},
    {id:'dec',label:'이전 DEC 참고',title:'DEC Recommended Practices',meta:'2014 권고안 · 이전 참고 이력',usage:'2020 판권 재배포판에 상업 이용 시 사전 서면허가가 필요하다고 명시되어 신규 계획의 자료에서 제외했어요.'}
  ];
  const legacyResult=r=>!!r&&r.sourcePolicy!==SOURCE_POLICY;
  const resultSourceIds=r=>r?.sourceIds||['template','curriculum','dec','iep'];
  const calendar='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  let root,index=0,view='form',documentView=false,savedPlanId=null,saving=false,starting=false,jobTimer,settling=false;
  state.iep ||= {drafts:{},plans:[]};
  state.iep.savedDrafts ||= {};
  // 이용권과 작업 상태는 로컬 시연용입니다. 실제 결제·권한 검증은 연결하지 않습니다.
  state.iep.usage ||= {tier:'starter',cycleStart:'2026-09-26',cycleEnd:'2026-10-26',anchorDay:26,jobs:[]};
  const usage=()=>state.iep.usage;
  const liveRoot=()=>root?.isConnected;
  function nextBillingDate(value,anchor=26){const [y,m]=value.split('-').map(Number),date=new Date(Date.UTC(y,m,0));date.setUTCDate(Math.min(anchor,date.getUTCDate()));date.setUTCMonth(m,Math.min(anchor,new Date(Date.UTC(y,m+1,0)).getUTCDate()));return date.toISOString().slice(0,10);}
  function quota(recipient=index){
    const u=usage(),jobs=u.jobs.filter(j=>j.cycle===u.cycleStart&&['running','success'].includes(j.status));
    return {used:jobs.some(j=>j.recipient===recipient),total:jobs.length,limit:u.tier==='pro'?15:5,busy:u.jobs.some(j=>j.status==='running'),cooldown:u.blockedUntil>Date.now()};
  }
  function generatedForMonth(recipient=index,month=draft().input.month?.from?.slice(0,7)){
    const job=usage().jobs.find(j=>j.recipient===recipient&&j.status==='success'&&j.input.month.from.slice(0,7)===month);
    if(job)return job;
    const legacy=state.iep.plans.find(p=>p.recipient===recipient&&p.result.proposalMode==='mockup'&&p.result.input.month.from.slice(0,7)===month);
    return legacy?{planId:legacy.id}:null;
  }
  function generationMessage(){
    const q=quota(),u=usage();
    if(q.busy)return '계획을 작성하고 있어요';
    if(q.cooldown)return 'AI 작성이 잠시 지연되고 있어요. 잠시 후 다시 시도해 주세요.';
    if(q.used||q.total>=q.limit)return `이번 이용기간 사용 완료 · 다음 이용 ${Number(u.cycleEnd.slice(5,7))}월 ${Number(u.cycleEnd.slice(8))}일`;
    const last=u.jobs.filter(j=>j.recipient===index).at(-1);
    return last?.status==='failed'?'계획을 완성하지 못했어요. 이용 횟수는 그대로예요.':'이번 이용기간 생성 가능';
  }
  function blank() {return {example:false,input:{month:{from:'2026-09-01',to:'2026-09-30'},ageBand:'',semesterGoal:'',monthGoal:'',observation:'',strength:'',familyRequest:'',participationNeeds:''},result:null,savedId:null};}
  function sample() {
    const d=blank();d.example=true;
    Object.assign(d.input,{
      monthGoal:'놀이 중 도움이 필요할 때 손짓·그림·말 중 자신이 사용할 수 있는 방식으로 도움을 요청한다.',
      observation:'자동차 놀이를 즐겨 선택한다. 연결이 어려울 때 교사의 손을 끌어오며, 교사가 도움 요청 그림을 보여 주면 그림을 가리킨다.',
      strength:'자동차를 고르고 길을 만드는 놀이에 관심이 많다. 익숙한 그림을 가리켜 원하는 것을 표현한다.'
    });return d;
  }
  function workspaceDraft() {const d=state.iep.drafts[index] ||= index===0?sample():blank();d.input={...blank().input,...d.input};return d;}
  function draft() {return savedPlanId?state.iep.savedDrafts[savedPlanId]:workspaceDraft();}
  const inSavedTab=()=>view==='saved'||!!savedPlanId;
  function openSavedPlan(plan) {
    savedPlanId=plan.id;
    state.iep.savedDrafts[plan.id] ||= {example:plan.result.example,input:clone(plan.result.input),result:clone(plan.result),savedId:plan.id};
    view=draft().dirtyInput?'form':'result';documentView=false;
  }
  function planningInput(input) {
    const result={};
    result.month={from:input.month?.from||'',to:input.month?.to||''};
    for(const key of Object.keys(PLANNING_LABELS))result[key]=typeof input[key]==='string'?input[key]:'';
    // 이전 계획의 작성 당시 연령 표기는 보존하고, 새 선택에는 공통 연령 구간을 사용합니다.
    if(!ageBands.includes(result.ageBand)&&!['만 3세','만 4세','만 5세','만 6~7세','만 8~12세'].includes(result.ageBand))result.ageBand='';
    return result;
  }
  function currentPlanningInput(){return planningInput({...draft().input,ageBand:state.recipients[index].ageBand||draft().input.ageBand});}
  const fieldsOf=r=>r.sections.flatMap(s=>s.fields);
  const valueOf=(r,key)=>fieldsOf(r).find(f=>f[0]===key)?.[2]||'';
  // 이전 주간 내용은 로컬 보관본에 남기고, 화면·계획 입력·내려받기에는 월 계획만 사용합니다.
  const oldSampleCriterion='도움이 필요한 상황에서 요청이 나타났는가? 손짓·그림·말 중 어떤 방식이었는가? 추가 시범 전인지 후인지, 제공한 도움은 무엇인지 살펴본다. 이번 주는 수행 수준을 확인하고 다음 주의 성공 기준은 관찰 후 정한다.';
  function monthlyInput(input) {
    return planningInput({...blank().input,...input});
  }
  function migrateResult(old) {
    if(!old||old.schemaVersion===4)return old;
    const next=buildResult(monthlyInput(old.input),old.example);
    const previousDefaults={
      connection:[
        '월 목표의 도움 요청을 이번 주에는 익숙한 자동차 놀이에서 시도한다. 그림 제시·시범 전후의 표현을 살펴 다음 주 지원을 결정한다.',
        '월 목표의 일부를 입력한 이번 주 활동에서 시도한다. 현재 수행 모습과 비교해 참여와 도움 정도를 살피고 다음 주 목표·지원을 조정한다.'
      ],
      steps:[`1. ‘${old.input.context}’에서 유아가 참여할 수 있는 자료와 장면을 준비한다.\n2. 이번 주 목표를 자연스럽게 시도할 기회를 살핀다. 목표 행동: ${old.input.weekGoal}\n3. 아래 교사의 지원을 적용하며 실제 반응과 제공한 도움을 기록한다.\n4. 참여가 어려우면 자료·환경·지원이 적절한지 확인하고 조정한다.`],
      observe:['활동 직후 관찰을 기록하고 주 계획이 끝날 때 현행수준과 비교한다. 같은 표현 방식에서 추가 도움의 종류·정도가 어떻게 달랐는지 살핀다.'],
      criterion:[oldSampleCriterion]
    };
    for(const f of fieldsOf(next)){
      const previous=fieldsOf(old).find(x=>x[0]===f[0]);
      if(previous&&(old.editedFields?.includes(f[0])||!previousDefaults[f[0]]?.includes(previous[2])))f[2]=previous[2];
      if(INPUT_FIELDS[f[0]])next.input[INPUT_FIELDS[f[0]]]=f[2];
    }
    for(const s of next.sections)s.sources=old.sections.find(x=>x.key===s.key)?.sources||resultSourceIds(old);
    return {...old,...next,sourcePolicy:old.sourcePolicy||null,sourceIds:resultSourceIds(old),confirmed:old.schemaVersion>=2?old.confirmed:false,migrated:old.schemaVersion>=2?old.migrated:true,editedFields:(old.editedFields||[]).filter(key=>key!=='weekGoal')};
  }
  let migrated=false;
  function archiveMonthly(group,key,value) {
    state.iep.monthlyArchive ||= {drafts:{},savedDrafts:{},plans:{}};
    state.iep.monthlyArchive[group][key] ||= clone(value);
    migrated=true;
  }
  for(const group of ['drafts','savedDrafts'])for(const [key,d] of Object.entries(state.iep[group])){
    if((d.result&&d.result.schemaVersion!==4)||'week' in d.input||'weekGoal' in d.input){
      archiveMonthly(group,key,d);d.input=monthlyInput(d.input);d.result=migrateResult(d.result);
    }
  }
  for(const p of state.iep.plans){if(p.result.schemaVersion!==4){archiveMonthly('plans',p.id,p);p.result=migrateResult(p.result);}}
  if(migrated)persist();
  const fmt=date=>date?(validDate(date)?date.replaceAll('-','.'):'날짜 확인 필요'):'날짜 선택';
  const period=r=>r?.from&&r?.to?`${fmt(r.from)} ~ ${fmt(r.to)}`:'날짜 선택';
  const labelHTML=label=>esc(label.replace(' · 선택',' (선택)')).replace(/ \(선택\)$/, ' <span class="iep-optional">(선택)</span>');
  function field(key,label,{required=false,rows=3,placeholder='',help=''}={}) {
    const id=`iep-${key}`,limit=INPUT_LIMITS[key],value=draft().input[key];
    return `<div class="field iep-field"><div class="field-heading"><label for="${id}">${labelHTML(label)}${required?'<span class="iep-required"> (필수)</span>':''}</label><small class="field-limit" id="${id}-limit">${textLength(value)}/${limit}자</small></div><textarea id="${id}" name="${key}" rows="${rows}" maxlength="${limit}" ${textLength(value)>limit?'data-iep-preserve-long="true"':''} ${required?'required':''} aria-describedby="${id}-limit${help?` ${id}-help`:''}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>${help?`<p id="${id}-help" class="iep-help">${help}</p>`:''}</div>`;
  }
  function rangeField(key,label) {return `<div class="field iep-field"><span id="iep-${key}-label">${label}</span><div class="datefield"><button id="iep-${key}-date" type="button" class="datefield-trigger" data-action="date" data-date-range="iep-${key}" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="iep-${key}-label iep-${key}-value"><span id="iep-${key}-value">${period(draft().input[key])}</span>${calendar}</button></div></div>`;}
  function shell() {
    if(!root)return;
    const count=state.iep.plans.filter(p=>p.recipient===index).length;
    root.innerHTML=`<header class="page-header"><div class="iep-title"><h1>IEP</h1></div><button type="button" class="button secondary" data-iep-action="new">새 계획</button></header>
      <div class="iep-tabs-row"><div class="record-tabs" aria-label="IEP 화면"><button type="button" data-iep-action="workspace" aria-pressed="${!inSavedTab()}">계획 작성</button><button type="button" data-iep-action="saved" aria-pressed="${inSavedTab()}">저장한 계획 <span>${count}</span></button></div></div>
      <section class="iep-card iep-recipient-bar ${view==='saved'?'':'iep-recipient-bar--period'}" aria-label="IEP 대상 및 기간"><div class="field iep-field"><span>관리대상</span><div class="dropdown"><button type="button" class="dropdown-trigger" data-options="recipients" aria-label="관리대상" aria-haspopup="listbox" aria-expanded="false"><span>${esc(state.recipients[index].name)}</span></button></div></div><div class="field iep-field"><span id="iep-age-label">연령대</span><div class="dropdown"><button id="iep-age-band" type="button" class="dropdown-trigger" data-options="recipient-age-band" data-iep-age data-value="${esc(state.recipients[index].ageBand||'')}" aria-labelledby="iep-age-label iep-age-value" aria-haspopup="listbox" aria-expanded="false"><span id="iep-age-value">${esc(state.recipients[index].ageBand||'연령대 선택')}</span></button></div></div>${view==='saved'?'':rangeField('month','월 계획 기간')}</section>
      <div id="iep-content"></div>`;
    if(view==='saved')renderSaved();else if(view==='result'&&draft().result)renderResult();else renderForm();
    const range=draft().input.month;
    if(view!=='saved'&&(range?.from||range?.to))setFieldError($('#iep-month-date'),periodError(draft().input));
    registerEdits();refreshMockControls();
  }
  function renderForm() {
    const d=draft();
    $('#iep-content').innerHTML=`<form id="iep-form" novalidate>
      ${savedPlanId?'<div class="iep-card-heading"><h2>저장한 계획 수정</h2></div>':''}

      <section class="iep-card"><div class="iep-card-heading"><h2>1. 현행수준</h2>${savedPlanId?'':'<button type="button" class="button tertiary" data-iep-action="example">예시 불러오기</button>'}</div><div class="iep-two-col">${field('observation','목표와 관련된 현재 수행 모습',{required:true,placeholder:'예: 도움 요청 그림을 보여 주면 그림을 가리켜요.'})}${field('strength','흥미와 강점 (선택)',{placeholder:'예: 자동차 놀이를 좋아하고, 익숙한 그림으로 원하는 것을 표현해요.'})}</div><details class="iep-optional-context" ${d.input.familyRequest||d.input.participationNeeds?'open':''}><summary>목표에 필요한 추가 정보</summary><div class="iep-two-col">${field('familyRequest','보호자의 교육적 요청 (선택)',{rows:2,placeholder:'예: 가정에서도 그림으로 도움을 요청해 보길 원함'})}${field('participationNeeds','활동 참여·안전에 필요한 지원 (선택)',{rows:2,placeholder:'예: 앉아서 참여할 수 있는 자리 마련, 소음이 적은 공간 사용'})}</div></details></section>
      <section class="iep-card"><div class="iep-card-heading"><h2>2. 교육목표</h2></div>
        <div class="iep-two-col">${field('monthGoal','월 목표',{required:true,placeholder:'예: 놀이 중 도움이 필요할 때 그림이나 말로 도움을 요청해요.'})}${field('semesterGoal','연결할 기존 IEP 목표 (선택)',{placeholder:'예: 일상생활에서 자신의 요구를 그림이나 말로 표현해요.'})}</div>
      </section>
      ${generationActions(d)}
    </form>`;
  }
  function generationActions(d){return `<div class="iep-card iep-action-bar" data-iep-generation><div><strong role="status">${d.result?'수정한 입력을 계획에 반영해요':generationMessage()}</strong></div><div class="iep-inline-actions">${d.result?'':`${generatedForMonth()?'<button type="button" class="button tertiary" data-iep-action="generated">계획 보기</button>':''}<button type="button" class="button secondary" data-iep-action="manual">직접 작성</button>`}<button type="submit" class="button primary" ${!d.result&&(starting||quota().busy||quota().used||quota().total>=quota().limit||quota().cooldown||generatedForMonth())?'disabled':''}>${d.result?'변경 내용 반영':quota().busy?'작성 중…':'AI 계획 만들기'}</button></div></div>`;}
  // AI 연동 전 목업: 교사 입력에 맞는 자체 작성 제안 예시만 구성합니다.
  // 교육과정 연결은 기존에 대조한 고시의 영역·내용 범위이며, 수행 사실은 생성하지 않습니다.
  function proposePlan(i) {
    const request=/요청|의사소통|표현|전달/.test(i.monthGoal);
    const peer=/친구|또래|함께|차례|번갈/.test(i.monthGoal);
    const routine=/정리|씻기|손 씻|입기|신발|스스로/.test(i.monthGoal);
    const car=request&&/자동차/.test(i.observation+' '+i.strength);
    const p={
      nuri:'목표의 행동과 놀이 맥락에 맞는 누리과정 영역·내용을 확인해 연결한다.',
      context:'유아가 선택한 익숙한 놀이에서 월 목표를 시도하는 활동',
      educationContent:`월 목표: ${i.monthGoal}\n익숙한 활동에서 목표 행동을 시도하고, 필요한 도움을 받으며 참여를 이어 가는 경험을 한다.`,
      materials:'유아가 선택한 놀이 자료, 활동 순서를 보여 줄 사진이나 실물, 관찰 기록지',
      practice:'월 목표의 행동을 시도할 수 있는 자연스러운 장면을 마련하고 스스로 반응할 여유를 준다.',
      support:'현재 수행 모습에서 확인된 표현과 참여 방식을 활용한다. 어려운 부분은 짧게 시범을 보이거나 자료를 조정하고, 유아의 반응에 따라 도움의 양을 조절한다.'
    };
    if(request)Object.assign(p,{
      nuri:'의사소통 > 듣기와 말하기\n놀이 상황에서 자신의 생각과 필요를 상대에게 표현하는 경험과 연결한다.',
      context:car?'자유놀이 시간의 자동차 길 만들기':'좋아하는 놀이 자료를 고르고 필요한 도움이나 자료를 요청하는 놀이',
      educationContent:'도움이나 자료가 필요한 장면에서 손짓·그림·말 등 사용할 수 있는 방식으로 의사를 전하고, 상대의 반응을 확인하며 놀이를 이어 간다.',
      materials:car?'자동차와 연결 길, 유아가 사용하는 의사소통 자료, 관찰 기록지':'유아가 선택한 놀이 자료, 필요한 경우 선택을 돕는 사진·실물, 관찰 기록지',
      practice:'도움이나 자료가 실제로 필요한 장면에서 유아가 먼저 표현하는지 살핀다. 요청하면 필요한 도움이나 자료를 제공해 놀이를 이어 간다.',
      support:'표현할 여유를 주고 손짓·그림·말 등 유아가 사용하는 방식을 받아들인다. 어려우면 익숙한 의사소통 자료나 짧은 시범을 제안한다. 요청을 반복 요구하거나 필요한 도움을 보류하지 않는다.'
    });
    else if(peer)Object.assign(p,{
      nuri:'사회관계 > 더불어 생활하기\n친구와 서로 도우며 놀이하고, 함께 정한 약속을 경험하는 내용과 연결한다.',
      context:'친구와 번갈아 놀이 자료를 사용하며 함께 만들기',
      educationContent:'친구의 행동을 살펴 자신의 차례에 참여하고, 필요한 자료나 도움을 주고받으며 공동 놀이를 이어 간다.',
      materials:'함께 고른 블록·만들기 자료, 필요한 경우 차례를 알려 주는 사진·표시, 관찰 기록지',
      practice:'교사가 자료를 주고받는 모습을 짧게 보여 준 뒤, 유아와 친구가 참여할 순서와 역할을 함께 정한다. 각자의 반응과 놀이 제안을 살핀다.',
      support:'또래와 가까이에서 병행 놀이할 기회부터 마련하고, 참여가 이어지면 함께 사용할 자료나 역할을 제안한다. 기다림이 어려우면 차례를 시각적으로 알려 주고 기다리는 동안 할 수 있는 역할을 제공한다.'
    });
    else if(routine)Object.assign(p,{
      nuri:'사회관계 > 나를 알고 존중하기\n생활 속에서 자신이 할 수 있는 일을 스스로 해 보는 경험과 연결한다.',
      context:'일과 전환 시간에 월 목표와 관련된 생활 행동을 순서대로 해 보기',
      educationContent:`월 목표인 ‘${i.monthGoal}’을 작은 행동으로 나누고, 스스로 할 수 있는 부분부터 시도하며 어려운 단계에서는 도움을 요청한다.`,
      materials:'해당 일과에서 실제 사용하는 물품, 필요하면 행동 순서를 보여 주는 사진, 관찰 기록지',
      practice:'일과의 시작 신호와 필요한 물품을 함께 확인한다. 유아가 스스로 하는 단계를 살피고, 어려운 단계만 짧게 보여 준다.',
      support:'현재 가능한 행동부터 참여하도록 하고 도움이 필요한 단계만 지원한다. 사진·실물·시범 중 유아에게 맞는 방법을 선택하며, 반응을 보면서 추가 도움을 조절한다.'
    });
    p.evaluationMethod=`‘${p.context}’에서 월 목표와 관련된 장면을 관찰한다. 활동 직후 날짜·상황, 실제 행동, 제공한 도움과 반응을 누가 기록한다. 관찰 기회가 없었던 날은 구분한다.`;
    p.criterion=`관찰할 목표: ${i.monthGoal}\n어떤 상황에서 목표 행동이 나타나는지, 스스로 한 부분과 도움 뒤에 한 부분을 구분한다. 계획 시작과 종료 시점의 참여 모습·도움 정도를 비교하며, 교사가 정한 성공 기준이 있으면 함께 확인한다.`;
    return p;
  }
  function buildResult(input=currentPlanningInput(),example=draft().example) {
    const i=planningInput(input),s=sample().input,p=proposePlan(i);
    const carExample=['monthGoal','observation','strength'].every(k=>i[k]===s[k]);
    return {schemaVersion:4,proposalMode:'mockup',sourcePolicy:SOURCE_POLICY,input:i,example,sourceIds:SOURCES.map(s=>s.id),confirmed:false,sections:[
      {key:'present',title:'현행수준',sources:['iep','own'],fields:[['baseline','목표와 관련된 현재 수행 모습',i.observation],['strength','흥미와 강점',i.strength],['familyRequest','보호자의 교육적 요청 (선택)',i.familyRequest]]},
      {key:'goals',title:'교육목표',sources:['iep','own'],fields:[
        ['semesterGoal','연결할 기존 IEP 목표',i.semesterGoal],['monthGoal','월 목표',i.monthGoal],
        ['connection','목표 연결',carExample?'한 달 동안 익숙한 자동차 놀이에서 도움 요청을 시도한다. 그림 제시·시범 전후의 표현과 도움 정도의 변화를 살펴 다음 달 목표와 지원을 결정한다.':'제안한 활동에서 월 목표를 자연스럽게 시도한다. 한 달 동안 참여와 도움 정도를 살피고 현행수준과 비교해 다음 달 목표와 지원을 조정한다.']]},
      {key:'curriculum',title:'관련 누리과정',sources:['nuri'],fields:[['nuri','영역·내용과 연결점',p.nuri]]},
      {key:'content',title:'교육내용',sources:['iep','nuri','own'],fields:[['activity','활동과 실행 상황',p.context],['content','배울 내용',p.educationContent]]},
      {key:'method',title:'교육방법',sources:['iep','nuri','own'],fields:[
        ['materials','준비할 자료',p.materials],
        ['prepare','준비·환경',carExample?'익숙한 자동차와 연결 길을 고를 수 있게 준비한다. 도움 요청 그림을 유아가 볼 수 있고 사용할 수 있는 곳에 둔다. 자유놀이 중 실제로 도움이 필요한 장면에서 목표를 시도한다.':`${p.context}에 참여할 수 있도록 자료와 환경을 준비한다.${i.strength?' 입력한 흥미와 강점을 활용한다: '+i.strength:''}${i.participationNeeds?' 참여에 필요한 지원을 반영한다: '+i.participationNeeds:''}`],
        ['steps','진행 순서',carExample?'1. 유아가 고른 자동차로 길 만들기를 시작하고 관심과 참여를 살핀다.\n2. 길 연결 등에서 실제 도움이 필요한 장면이 생기면 표현할 여유를 준다.\n3. 먼저 나온 손짓·그림·말을 살핀다. 요청이 나오면 필요한 도움을 제공해 놀이를 이어 간다.\n4. 표현이 어려우면 제안한 지원에 따라 의사소통 자료를 보여 주거나 짧게 시범을 보인다. 이후 반응과 제공한 도움을 함께 기록한다.':`1. ${p.context}에 함께 참여할지 제안하고 유아가 사용할 자료를 선택하도록 한다.\n2. ${p.practice}\n3. ${p.support}\n4. 활동 직후 실제 반응과 도움 정도를 기록하고, 다음 활동에서 유지하거나 바꿀 지원을 정한다.`],
        ['support','교사의 지원',p.support],['participationNeeds','활동 참여·안전에 필요한 지원 (선택)',i.participationNeeds],
        ['responseSupport','반응별 지원',carExample?'스스로 요청하면 → 손짓·그림·말을 모두 유효한 표현으로 받아들이고 필요한 도움을 제공한다.\n그림 제시나 시범 뒤 요청하면 → 도움을 제공하고 어떤 지원 뒤에 표현했는지 기록한다.\n표현이 어렵거나 참여가 줄면 → 요청을 반복 요구하지 않고 필요한 도움과 놀이 접근성을 점검한다. 익숙한 의사소통 도구는 유지한다.':'목표와 관련된 행동이 나오면 → 실제 표현과 참여를 확인하고 필요한 지원을 이어 간다.\n지원 후 반응이 나오면 → 어떤 도움을 제공했는지 구분해 기록한다.\n반응이 어렵거나 참여가 줄면 → 자료·환경·지원 방법을 다시 살피고 유아에게 맞게 조정한다.']
      ]},
      {key:'evaluation',title:'평가계획',sources:['iep','nuri','own'],fields:[
        ['evaluationMethod','평가방법',p.evaluationMethod],
        ['criterion','평가초점',p.criterion],
        ['observe','기록과 검토 시점','활동 직후 관찰을 기록하고 월 계획이 끝날 때 현행수준과 비교한다. 같은 표현 방식에서 추가 도움의 종류·정도가 어떻게 달랐는지 살핀다.']
      ]},
      {key:'review',title:'평가결과',sources:['iep','own'],fields:[
        ['evaluationResult','실제 관찰과 평가', ''],
        ['adjust','다음 달 계획 검토 · 관찰 후 결정',carExample?'추가 시범 없이 요청한 장면이 관찰되면 → 다른 익숙한 장면에서도 같은 표현이 나오는지 살펴볼지 검토한다.\n그림 제시·시범 후 요청한 경우가 주로 관찰되면 → 익숙한 의사소통 도구를 유지하고 추가 도움의 정도를 조정할지 검토한다.\n참여가 어렵거나 관찰 기회가 부족하면 → 환경과 지원을 점검하고 추가 관찰한다. 목표 달성을 판정하거나 난이도를 자동으로 높이지 않는다.':'실제 관찰을 현행수준과 비교해 목표·활동·지원을 유지할지 조정할지 결정한다. 도움이 필요했던 조건과 참여를 함께 살핀다. 관찰 기회가 부족하면 추가로 관찰하며 달성을 단정하거나 난이도를 자동으로 높이지 않는다.']
      ]}
    ]};
  }
  function resultField(section,f) {
    const [key,label,value]=f,id=`iep-result-${key}`;
    const placeholder=EMPTY_LABELS[key]||'필요한 내용을 입력해 주세요.';
    return `<div class="iep-result-field iep-field" data-field-key="${key}"><div class="field-heading"><label for="${id}">${labelHTML(label)}</label><small class="field-limit" id="${id}-limit">${textLength(value)}/2400자</small></div><textarea id="${id}" rows="${value.length>160?6:3}" maxlength="2400" ${textLength(value)>2400?'data-iep-preserve-long="true"':''} aria-describedby="${id}-limit" data-iep-section="${section.key}" data-iep-field="${key}" placeholder="${placeholder}">${esc(value)}</textarea></div>`;
  }
  function planTable(r) {
    return `<table class="iep-plan-table"><caption>개별화교육 실행 계획 · ${esc(state.recipients[index].name)}</caption><colgroup><col class="iep-table-section"><col class="iep-table-label"><col></colgroup><thead><tr><th scope="col">구분</th><th scope="col">항목</th><th scope="col">계획 및 기록</th></tr></thead>${r.sections.map((s,n)=>{const fields=s.fields.filter(f=>!OPTIONAL_PRINT_FIELDS.includes(f[0])||String(f[2]??'').trim());return `<tbody>${fields.map((f,j)=>`<tr>${j===0?`<th scope="rowgroup" rowspan="${fields.length}">${n+1}. ${s.title}</th>`:''}<th scope="row">${labelHTML(f[1])}${f[0]==='evaluationResult'&&r===draft().result&&needsGoalDecision(draft())?' · 이전 목표 기록 (확인 중)':''}</th><td>${esc(String(f[2]??'').trim()?f[2]:f[0]==='evaluationResult'?'미기록':'—')}</td></tr>`).join('')}</tbody>`;}).join('')}</table>`;
  }
  function renderResult() {
    const d=draft(),r=d.result;
    $('#iep-content').innerHTML=`
      <section class="iep-card iep-result-header"><div><div class="iep-card-heading"><h2>${esc(state.recipients[index].name)}의 월간 계획</h2><span class="workflow-badge" data-iep-status>${r.confirmed?'검토 완료':d.editSessionFields?.length?'수정 중':'초안 검토'}</span>${r.proposalMode==='mockup'?'<span class="workflow-badge">제안 예시</span>':r.example?'<span class="workflow-badge">예시</span>':''}</div><p class="iep-help">${period(r.input.month)}</p><p class="iep-help">작성 당시 연령대 · ${esc(r.input.ageBand||'미기록')}</p></div><div class="iep-inline-actions"><button type="button" class="button tertiary" data-iep-action="edit-input">입력 수정</button><button type="button" class="button tertiary" data-iep-action="document">${documentView?'카드로 보기':'계획서 보기'}</button><button type="button" class="button tertiary" data-iep-action="download">계획서 내려받기</button></div></section>
      ${r.migrated?'<p class="iep-demo-note">기존 내용을 새 양식으로 옮겼어요. 추가된 항목을 확인한 뒤 다시 검토 완료해 주세요.</p>':''}
      ${documentView?`<section class="iep-card"><div class="iep-card-heading"><h2>계획서 미리보기</h2><span class="iep-help">HTML 문서 · 인쇄 시 PDF 저장 가능</span></div><div class="iep-table-scroll" tabindex="0" role="region" aria-label="IEP 계획서 표">${planTable(r)}</div></section>`:resultCards(r)}
      ${historyHTML(r)}<div data-iep-review-notice></div><div data-iep-goal-choice></div>
      <div class="iep-card iep-action-bar" data-iep-savebar><div><strong data-iep-save-message>${r.confirmed?'저장한 계획이에요':'수정한 내용을 확인하고 저장해 주세요'}</strong></div><button type="button" class="button primary" data-iep-action="save" ${r.confirmed?'disabled':''}>${r.confirmed?'저장 완료':savedPlanId?'변경 내용 저장':'검토 완료하고 저장'}</button></div>`;
    refreshReviewUI();
  }
  function resultCards(r){
    const fieldHTML=keys=>keys.map(key=>{const s=r.sections.find(s=>s.fields.some(f=>f[0]===key));return resultField(s,s.fields.find(f=>f[0]===key));}).join('');
    const group=(title,keys,{collapsed=false,summary='',review=''}={})=>`<${collapsed?'details':'section'} class="iep-card iep-result-group" ${review?`data-review-group="${review}"`:''}>${collapsed?`<summary><strong>${title}</strong>${summary?`<span class="iep-summary">${esc(summary)}</span>`:''}</summary>`:`<div class="iep-card-heading"><h2>${title}</h2>${review?`<span data-review-label="${review}"></span>`:''}</div>`}<div class="iep-result-fields iep-two-col">${fieldHTML(keys)}</div>${review?`<button type="button" class="button tertiary iep-review-button" data-iep-action="reviewed" data-section="${review}" hidden>내용 확인 완료</button>`:''}</${collapsed?'details':'section'}>`;
    return group('현행수준·교육목표',['baseline','strength','monthGoal','semesterGoal','familyRequest','connection'],{collapsed:true,summary:valueOf(r,'monthGoal')||'월 목표 미작성'})+
      group('활동 계획',['activity','content'],{review:'content'})+
      group('진행 방법·교사 지원',['steps','support','participationNeeds','responseSupport'],{review:'method'})+
      group('평가방법·평가초점',['evaluationMethod','criterion','observe'],{review:'evaluation'})+
      group('교육과정 연결·세부 준비',['nuri','materials','prepare'],{collapsed:true,summary:'교육과정 연결, 준비할 자료와 환경'})+
      group('실제 관찰·다음 달 검토',['evaluationResult','adjust'],{collapsed:!valueOf(r,'evaluationResult').trim(),summary:valueOf(r,'evaluationResult').trim()?'관찰 기록 있음':'실제 관찰 미기록'});
  }
  function historyHTML(r){
    return r.goalHistory?.length?`<details class="iep-card iep-goal-history"><summary>이전 목표 기록 ${r.goalHistory.length}건</summary>${r.goalHistory.map(h=>`<article><h3>${esc(valueOf(h.result,'monthGoal'))}</h3><p class="iep-help">${esc(new Date(h.at).toLocaleDateString('ko-KR'))} 보관</p><div class="iep-table-scroll" tabindex="0" role="region" aria-label="이전 목표 계획서">${planTable(h.result)}</div></article>`).join('')}</details>`:'';
  }
  function captureGoalBaseline(d){
    if(d.result&&(!d.goalBaseline||valueOf(d.goalBaseline,'monthGoal')===valueOf(d.result,'monthGoal')))d.goalBaseline=clone({...d.result,goalHistory:undefined});
  }
  function needsGoalDecision(d){return !!d.goalBaseline&&valueOf(d.goalBaseline,'monthGoal')!==valueOf(d.result,'monthGoal')&&!!valueOf(d.goalBaseline,'evaluationResult').trim();}
  function markReview(d){d.result.needsReview=['content','method','evaluation'];d.result.confirmed=false;}
  function refreshReviewUI(){
    if(!liveRoot()||view!=='result')return;
    const d=draft(),r=d.result,needs=r.needsReview||[];
    const summary=$('.iep-result-group>summary .iep-summary');if(summary)summary.textContent=valueOf(r,'monthGoal')||'월 목표 미작성';
    for(const el of $$('[data-review-label]'))el.innerHTML=needs.includes(el.dataset.reviewLabel)?'<span class="workflow-badge">다시 확인</span>':'';
    for(const el of $$('[data-iep-action="reviewed"]'))el.hidden=!needs.includes(el.dataset.section);
    const notice=$('[data-iep-review-notice]');
    if(notice)notice.innerHTML=needs.length?`<p class="iep-review-note">입력 내용이 바뀌었어요. 활동·지원·평가를 확인해 주세요.${documentView?'<button type="button" class="button tertiary" data-iep-action="document">계획 확인하기</button>':''}</p>`:'';
    const choice=$('[data-iep-goal-choice]');
    if(choice)choice.innerHTML=needsGoalDecision(d)?`<fieldset class="iep-card iep-goal-choice"><legend>월 목표가 바뀌었어요</legend><p>기존 관찰 기록을 어떻게 이어 갈까요?</p><label><input type="radio" name="iep-goal-decision" value="wording" ${d.goalDecision==='wording'?'checked':''}> 표현만 수정 · 기존 관찰 유지</label><label><input type="radio" name="iep-goal-decision" value="changed" ${d.goalDecision==='changed'?'checked':''}> 목표 변경 · 이전 기록 보관 후 새 관찰 시작</label></fieldset>`:'';
    // 목표 의미를 정하기 전에는 이전 관찰에 새 관찰을 섞어 입력하지 않습니다.
    const evaluation=$('#iep-result-evaluationResult');if(evaluation){evaluation.readOnly=needsGoalDecision(d)&&d.goalDecision!=='wording';evaluation.title=evaluation.readOnly?'저장 영역에서 목표 변경 여부를 정한 뒤 관찰을 기록해 주세요.':'';$('label[for="iep-result-evaluationResult"]').textContent=needsGoalDecision(d)?'실제 관찰과 평가 · 이전 목표 기록':'실제 관찰과 평가';}
  }
  function focusControl(control){
    if(!control)return;
    let parent=control.parentElement;while(parent&&parent!==root){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}
    control.focus({preventScroll:true});control.scrollIntoView({block:'center'});
  }
  function renderSaved() {
    const plans=state.iep.plans.filter(p=>p.recipient===index);
    $('#iep-content').innerHTML=plans.length?`<div class="iep-saved-list">${plans.map(p=>`<article class="iep-card iep-saved-card"><div><div class="iep-card-heading"><h2>${period(p.result.input.month)} 월간 계획</h2><span class="workflow-badge">${state.iep.savedDrafts[p.id]?.dirtyInput||state.iep.savedDrafts[p.id]?.editSessionFields?.length?'수정 중':p.result.confirmed?'검토 완료':'초안 검토'}</span></div><p>${esc(valueOf(p.result,'monthGoal'))}</p><span class="iep-help">${p.result.example?'목업 예시 · ':''}${esc(new Date(p.updatedAt).toLocaleDateString('ko-KR'))} 저장</span></div><div class="iep-inline-actions"><button type="button" class="button tertiary" data-iep-action="open" data-plan-id="${p.id}">계획 보기</button><button type="button" class="button secondary" data-iep-action="copy" data-plan-id="${p.id}">다음 달 계획으로 복사</button></div></article>`).join('')}</div>`:`<section class="iep-card iep-empty"><h2>저장한 계획이 없어요</h2><p class="iep-help">월 목표를 입력하고 검토한 계획을 저장해 보세요.</p><button type="button" class="button primary" data-iep-action="workspace">계획 작성하기</button></section>`;
  }
  function validDate(value) {
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const [year,month,day]=value.split('-').map(Number);
    if(year<1||month<1||month>12||day<1)return false;
    const leap=year%4===0&&(year%100!==0||year%400===0);
    return day<=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
  }
  function periodError(i) {
    if(!i.month?.from||!i.month?.to)return '월 계획 기간을 선택해 주세요.';
    if(!validDate(i.month.from)||!validDate(i.month.to))return '올바른 날짜로 월 계획 기간을 다시 선택해 주세요.';
    if(i.month.from>i.month.to)return '종료일은 시작일 이후로 선택해 주세요.';
    if(i.month.from.slice(0,7)!==i.month.to.slice(0,7))return '월 계획 기간은 같은 달 안에서 선택해 주세요.';
    return '';
  }
  function setFieldError(control,message) {
    if(!control)return;
    const id=control.id+'-error',existing=$('#'+id);
    const describedBy=(control.getAttribute('aria-describedby')||'').split(' ').filter(value=>value&&value!==id);
    if(!message){
      existing?.remove();control.removeAttribute('aria-invalid');
    }else{
      const hint=existing||document.createElement('p');
      hint.id=id;hint.className='iep-field-error';hint.setAttribute('role','alert');
      hint.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>';
      hint.append(document.createTextNode(message));
      if(!existing)control.closest('.iep-field').append(hint);
      control.setAttribute('aria-invalid','true');describedBy.push(id);
    }
    if(describedBy.length)control.setAttribute('aria-describedby',describedBy.join(' '));else control.removeAttribute('aria-describedby');
  }
  function validateInput(enforceLimits=true) {
    const i=draft().input;
    const checks=[
      [$('#iep-age-band'),ageBands.includes(state.recipients[index].ageBand)?'':'연령대를 선택해 주세요.'],
      [$('#iep-month-date'),periodError(i)],
      [$('#iep-observation'),i.observation.trim()?'':'현재 수행 모습을 입력해 주세요.'],
      [$('#iep-monthGoal'),i.monthGoal.trim()?'':'월 목표를 입력해 주세요.']
    ];
    if(enforceLimits)for(const [key,limit] of Object.entries(INPUT_LIMITS)){const control=$('#iep-'+key),message=textLength(i[key])>limit?`최대 ${limit}자까지 입력할 수 있어요.`:'';if(message||!checks.some(([el])=>el===control))checks.push([control,message]);}
    for(const [control,message] of checks)setFieldError(control,message);
    const missing=checks.find(([,message])=>message);
    if(missing){focusControl(missing[0]);return false;}return true;
  }
  function applyInputs(d,input){
    if(d.result.input.monthGoal!==input.monthGoal)captureGoalBaseline(d);
    if(['monthGoal','observation','participationNeeds','ageBand'].some(key=>d.result.input[key]!==input[key]))markReview(d);
    if(d.result.input.monthGoal!==input.monthGoal)delete d.goalDecision;
    for(const f of fieldsOf(d.result))if(INPUT_FIELDS[f[0]]){if(f[2]!==input[INPUT_FIELDS[f[0]]]){d.editSessionFields ||= [];if(!d.editSessionFields.includes(f[0]))d.editSessionFields.push(f[0]);}f[2]=input[INPUT_FIELDS[f[0]]];}
    d.result.input=clone(input);d.input=clone(input);d.dirtyInput=false;d.result.confirmed=false;
  }
  async function createPlan(event) {
    event.preventDefault();if(starting)return;
    const d=draft();if(!validateInput(!d.result))return;
    if(d.result){applyInputs(d,currentPlanningInput());if(await persist()===false)return;documentView=false;view='result';shell();focusHeading();return;}
    const existing=generatedForMonth();if(existing){openGenerated(existing);return;}
    const q=quota();if(q.busy||q.used||q.total>=q.limit||q.cooldown){shell();return;}
    starting=true;
    const snapshot=currentPlanningInput();for(const key of Object.keys(INPUT_LIMITS))snapshot[key]=normalizeText(snapshot[key]);
    const job={id:crypto.randomUUID(),recipient:index,cycle:usage().cycleStart,input:snapshot,sourceInput:clone(d.input),example:d.example,status:'running',finishAt:Date.now()+1400,outcome:usage().nextOutcome||'success',startedAt:Date.now()};
    usage().jobs.push(job);usage().nextOutcome='success';d.pendingJob=job.id;
    const saved=await persist();starting=false;
    if(saved===false){usage().jobs=usage().jobs.filter(j=>j.id!==job.id);delete d.pendingJob;return;}
    if(liveRoot())shell();scheduleJob();
  }
  function scheduleJob(){
    clearTimeout(jobTimer);const job=usage().jobs.find(j=>j.status==='running');
    if(job&&!settling)jobTimer=setTimeout(()=>finishJob(job.id),Math.max(0,job.finishAt-Date.now()));
    else if(!job&&usage().blockedUntil>Date.now())jobTimer=setTimeout(()=>{if(liveRoot()&&view==='form'){const controls=$('[data-iep-generation]');if(controls)controls.outerHTML=generationActions(draft());}},usage().blockedUntil-Date.now()+1);
  }
  async function finishJob(id){
    const job=usage().jobs.find(j=>j.id===id);if(!job||job.status!=='running'||settling)return;
    settling=true;const before=clone(state.iep);
    const d=state.iep.drafts[job.recipient];
    if(job.outcome==='failure'){
      job.status='failed';job.finishedAt=Date.now();
      const recent=usage().jobs.filter(j=>j.finishedAt>Date.now()-3600000).slice(-3);
      if(recent.length===3&&recent.every(j=>j.status==='failed'))usage().blockedUntil=Date.now()+600000;
    }else{
      const r=buildResult(job.input,job.example);r.generationId=job.id;
      const plan={id:crypto.randomUUID(),recipient:job.recipient,result:r,updatedAt:new Date().toISOString()};
      state.iep.plans.unshift(plan);job.status='success';job.planId=plan.id;job.finishedAt=Date.now();
    }
    // 입력 수정·대상 전환 후의 작업 영역은 덮어쓰지 않고 시작 당시 입력과 결과를 보관합니다.
    const attach=d?.pendingJob===job.id&&!d.result&&JSON.stringify(d.input)===JSON.stringify(job.sourceInput);
    if(d?.pendingJob===job.id)delete d.pendingJob;
    if(attach&&job.status==='success')state.iep.drafts[job.recipient]=blank();
    const saved=await persist();settling=false;
    if(saved===false){state.iep=before;return;}
    if(liveRoot()){
      if(attach&&index===job.recipient&&!savedPlanId&&view==='form'&&job.status==='success'){openGenerated(job,false);shell();focusHeading();}
      else if(view==='saved')renderSaved();
      else if(view==='form'){const controls=$('[data-iep-generation]');if(controls)controls.outerHTML=generationActions(draft());}
      const count=$('[data-iep-action="saved"] span');if(count)count.textContent=state.iep.plans.filter(p=>p.recipient===index).length;
      if(index===job.recipient)toast(job.status==='success'?'계획을 만들었어요. 저장한 계획에서 확인할 수 있어요.':'계획을 완성하지 못했어요. 이용 횟수는 그대로예요.');
    }
    refreshMockControls();scheduleJob();
  }
  function openGenerated(job,render=true){
    const plan=state.iep.plans.find(p=>p.id===job.planId&&p.recipient===index);if(!plan)return;
    openSavedPlan(plan);if(render){shell();focusHeading();}
  }
  async function manualPlan(){
    if(!validateInput(false))return;
    const d=draft(),r=buildResult(currentPlanningInput(),false);
    for(const f of fieldsOf(r))if(!INPUT_FIELDS[f[0]])f[2]='';
    r.proposalMode='manual';d.result=r;d.input=clone(r.input);d.dirtyInput=false;view='result';documentView=false;
    if(await persist()===false)return;shell();focusHeading();
  }
  function nextMonthRange(range){
    const [year,month]=range.from.split('-').map(Number);
    const from=new Date(Date.UTC(year,month,1)).toISOString().slice(0,10),to=new Date(Date.UTC(year,month+1,0)).toISOString().slice(0,10);
    return {from,to};
  }
  async function copyNextMonth(plan,force=false){
    if(!plan||periodError(plan.result.input))return;
    const month=nextMonthRange(plan.result.input.month),existing=state.iep.plans.find(p=>p.recipient===index&&p.result.input.month.from.slice(0,7)===month.from.slice(0,7));
    const workspace=workspaceDraft(),busyWorkspace=workspace.input.month.from.slice(0,7)===month.from.slice(0,7)&&(workspace.result||workspace.input.observation.trim()||workspace.input.monthGoal.trim());
    if(!force&&(existing||busyWorkspace)){
      dialog('다음 달에 작성 중인 계획이 있어요',`<p>기존 내용을 이어서 수정하거나 별도 사본을 만들 수 있어요.</p><button type="button" class="button secondary" id="iep-separate-copy">별도 사본 만들기</button>`,'기존 계획 열기',()=>{if(existing)openSavedPlan(existing);else {savedPlanId=null;view=workspace.result?'result':'form';}shell();});
      document.getElementById('iep-separate-copy').onclick=event=>{event.target.closest('dialog').close();copyNextMonth(plan,true);};return;
    }
    const before=clone(state.iep),sourceDraft=state.iep.savedDrafts[plan.id],r=clone(sourceDraft?.result||plan.result);
    if(sourceDraft?.dirtyInput)applyInputs({result:r,input:clone(sourceDraft.input)},planningInput(sourceDraft.input));
    r.input.month=month;r.confirmed=false;r.needsReview=['content','method','evaluation'];r.proposalMode='copy';delete r.generationId;delete r.goalHistory;
    fieldsOf(r).find(f=>f[0]==='evaluationResult')[2]='';
    const item={id:crypto.randomUUID(),recipient:index,result:r,updatedAt:new Date().toISOString()};state.iep.plans.unshift(item);
    if(await persist()===false){state.iep=before;return;}openSavedPlan(item);shell();focusHeading();toast('다음 달 초안을 만들었어요. 실제 관찰은 비워 두었어요.');
  }
  async function savePlan() {
    if(saving)return;
    const d=draft(),r=d.result;
    const rangeError=periodError(r.input);if(rangeError){setFieldError($('#iep-month-date'),rangeError);$('#iep-month-date').focus();return;}
    const missing=REQUIRED_FIELDS.find(key=>!valueOf(r,key).trim());
    if(missing){documentView=false;renderResult();const control=$(`#iep-result-${missing}`);setFieldError(control,'필수 내용을 입력해 주세요.');focusControl(control);return;}
    const over=fieldsOf(r).find(f=>textLength(f[2])>2400&&d.editSessionFields?.includes(f[0]));
    if(over){documentView=false;renderResult();const control=$(`#iep-result-${over[0]}`);setFieldError(control,'최대 2400자까지 입력할 수 있어요.');focusControl(control);return;}
    if(r.needsReview?.length){documentView=false;renderResult();focusControl($(`[data-section="${r.needsReview[0]}"]`));toast('다시 확인 표시가 있는 활동·지원·평가를 확인해 주세요.');return;}
    if(needsGoalDecision(d)&&!d.goalDecision){refreshReviewUI();focusControl($('[name="iep-goal-decision"]'));toast('월 목표 변경 여부를 선택해 주세요.');return;}
    const before=clone(state.iep),savingRecipient=index;
    saving=true;
    const saveRoot=root,saveButton=root?.querySelector('[data-iep-action="save"]');
    if(saveRoot)saveRoot.inert=true;if(saveButton)saveButton.disabled=true;
    if(needsGoalDecision(d)&&d.goalDecision==='changed'){
      const previousGoal=clone(d.goalBaseline);fieldsOf(previousGoal).find(f=>f[0]==='evaluationResult')[2]=valueOf(r,'evaluationResult');
      r.goalHistory ||= [];r.goalHistory.push({at:new Date().toISOString(),result:previousGoal});
      fieldsOf(r).find(f=>f[0]==='evaluationResult')[2]='';
    }
    r.confirmed=true;r.migrated=false;
    const previous=state.iep.plans.find(p=>p.id===d.savedId);
    const item={id:previous?.id||crypto.randomUUID(),recipient:index,result:clone(r),updatedAt:new Date().toISOString()};
    if(previous)Object.assign(previous,item);else state.iep.plans.unshift(item);
    if(!savedPlanId)state.iep.drafts[index]=blank();
    state.iep.savedDrafts[item.id]={example:r.example,input:clone(r.input),result:clone(r),savedId:item.id};
    const saved=await persist();saving=false;if(saveRoot)saveRoot.inert=false;
    if(saved===false){state.iep=before;if(saveButton)saveButton.disabled=false;return;}
    if(index===savingRecipient&&root===saveRoot){savedPlanId=item.id;view='result';shell();focusHeading();}toast('저장한 계획에 보관했어요.');
  }
  function download() {
    const r=draft().result;
    const rangeError=periodError(r.input);if(rangeError){setFieldError($('#iep-month-date'),rangeError);$('#iep-month-date').focus();return;}
    const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>케어릿 IEP 월간 실행 계획</title><style>
      *{box-sizing:border-box}body{margin:0;background:#f5f7f9;color:#16202a;font:14px/1.7 'Malgun Gothic',sans-serif}main{max-width:1000px;margin:32px auto;background:#fff;padding:36px}h1{font-size:24px;margin:0 0 12px}h2{font-size:20px}p{margin:8px 0}.note{color:#617080}.print-note{padding:12px 16px;background:#edf2f4;border-radius:8px}.iep-plan-table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:24px}.iep-plan-table caption{text-align:left;font-weight:bold;font-size:20px;margin-bottom:12px}.iep-table-section{width:16%}.iep-table-label{width:22%}th,td{border:1px solid #d9dfe3;padding:12px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#edf2f4}thead th{background:#eaf6f0;color:#00845e}a{color:#00845e}.iep-optional{color:#06784f}tr{break-inside:avoid}thead{display:table-header-group}@media(max-width:640px){main{margin:0;padding:16px}.table-scroll{overflow-x:auto}.iep-plan-table{min-width:650px}}@page{size:A4;margin:14mm}@media print{body{background:white}main{margin:0;padding:0;max-width:none}.print-note{display:none}.table-scroll{overflow:visible}.iep-plan-table{min-width:0}a{text-decoration:none}h1,h2,caption{break-after:avoid}}
      </style></head><body><main><h1>IEP 월간 실행 계획</h1><p><strong>대상 구분명</strong> ${esc(state.recipients[index].name)} · 연령대 ${esc(r.input.ageBand||'미설정')}</p><p>월 계획: ${period(r.input.month)}</p><p>상태: ${r.confirmed?'교사 검토 완료':'초안 · 검토 전'}</p><p class="print-note">이 문서는 목업에서 작성한 계획서예요. 목업의 계획 본문에서 바로 수정할 수 있어요. 브라우저 인쇄(Ctrl+P)에서 PDF로 저장할 수 있어요.</p>${r.example?'<p class="note">합성 예시 · 실제 아동의 관찰 기록이 아닙니다.</p>':''}<div class="table-scroll">${planTable(r)}</div><p class="note">학교의 공식 IEP 확정 절차는 별도로 진행합니다.</p></main></body></html>`;
    const url=URL.createObjectURL(new Blob(['\ufeff'+html],{type:'text/html;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`케어릿-IEP-월간계획서-${r.input.month.from}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('표 형태의 HTML 계획서를 내려받았어요.');
  }
  function focusHeading() {const heading=$(savedPlanId?'.page-header h1':'#iep-content h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});}}
  function replaceDraft(next,message) {
    const replace=()=>{state.iep.drafts[index]=next;savedPlanId=null;view='form';persist();shell();};
    const d=workspaceDraft(),hasContent=d.result||Object.entries(d.input).some(([k,v])=>typeof v==='string'&&v.trim());
    if(hasContent)dialog('작성 중인 계획을 바꿀까요?',`<p>${message} 저장한 계획은 그대로 남아요.</p>`,'바꾸기',replace);else replace();
  }
  function click(event) {
    if(document.body.classList.contains('mockup-editing'))return;
    const b=event.target.closest('[data-iep-action]');if(!b)return;
    const action=b.dataset.iepAction;
    if(action==='saved'){savedPlanId=null;view='saved';shell();}
    else if(action==='workspace'){savedPlanId=null;view=draft().result&&!draft().dirtyInput?'result':'form';shell();}
    else if(action==='edit-input'){view='form';shell();focusHeading();}
    else if(action==='example')replaceDraft(sample(),'입력한 내용을 도움 요청 목표의 합성 예시로 바꿔요.');
    else if(action==='new')replaceDraft(blank(),'현재 작성 중인 초안을 비우고 새 계획을 시작해요.');
    else if(action==='document'){documentView=!documentView;renderResult();registerEdits();focusHeading();}
    else if(action==='save')savePlan();
    else if(action==='download')download();
    else if(action==='manual')manualPlan();
    else if(action==='generated'){const job=generatedForMonth();if(job)openGenerated(job);}
    else if(action==='reviewed'){draft().result.needsReview=(draft().result.needsReview||[]).filter(key=>key!==b.dataset.section);persist();refreshReviewUI();}
    else if(action==='copy'){const plan=state.iep.plans.find(p=>p.id===b.dataset.planId&&p.recipient===index);copyNextMonth(plan);}
    else if(action==='open'){
      const p=state.iep.plans.find(p=>p.id===b.dataset.planId&&p.recipient===index);if(!p)return;
      openSavedPlan(p);persist();shell();focusHeading();
    }
  }
  function input(event) {
    if(document.body.classList.contains('mockup-editing'))return;
    const el=event.target,d=draft();
    if(el.tagName==='TEXTAREA'&&!event.isComposing)constrainInput(el);
    if(el.name==='iep-goal-decision'){d.goalDecision=el.value;persist();refreshReviewUI();return;}
    if(el.closest('#iep-form')&&Object.hasOwn(INPUT_LIMITS,el.name)){d.input[el.name]=el.value;d.dirtyInput=true;if(!event.isComposing)setFieldError(el,'');persist();}
    if(el.dataset.iepField){
      const section=d.result.sections.find(s=>s.key===el.dataset.iepSection),field=section.fields.find(f=>f[0]===el.dataset.iepField);
      if(field[0]==='evaluationResult'&&el.readOnly)return;
      if(field[0]==='monthGoal'&&field[2]!==el.value)captureGoalBaseline(d);
      if(['monthGoal','baseline','participationNeeds'].includes(field[0])&&field[2]!==el.value)markReview(d);
      if(field[0]==='monthGoal'&&field[2]!==el.value)delete d.goalDecision;
      field[2]=el.value;d.result.confirmed=false;
      d.editSessionFields ||= [];if(!d.editSessionFields.includes(field[0]))d.editSessionFields.push(field[0]);
      d.result.editedFields ||= [];if(!d.result.editedFields.includes(field[0]))d.result.editedFields.push(field[0]);
      if(INPUT_FIELDS[field[0]]){d.input[INPUT_FIELDS[field[0]]]=el.value;d.result.input[INPUT_FIELDS[field[0]]]=el.value;}
      $('[data-iep-status]').textContent=savedPlanId?'수정 중':'초안 검토';
      $('[data-iep-savebar]').hidden=false;
      const b=$('[data-iep-action="save"]');b.disabled=false;b.textContent=savedPlanId?'변경 내용 저장':'검토 완료하고 저장';
      $('[data-iep-save-message]').textContent='수정한 내용을 확인하고 저장해 주세요';
      if(!event.isComposing)setFieldError(el,'');refreshReviewUI();persist();
    }
  }
  function refreshMockControls(){
    const status=document.getElementById('iep-mock-status');if(!status)return;
    const q=quota(),u=usage();status.textContent=`${u.cycleStart} ~ ${u.cycleEnd} · ${q.total}/${q.limit}회${q.busy?' · 생성 중':''}`;
    document.getElementById('iep-mock-tier').value=u.tier;
    document.getElementById('iep-mock-outcome').value=u.nextOutcome||'success';
    document.getElementById('iep-mock-cycle').disabled=q.busy||starting||settling;
  }
  return {
    mount(element,recipient) {
      root=element;index=recipient;
      if(savedPlanId&&!state.iep.plans.some(p=>p.id===savedPlanId&&p.recipient===index)){savedPlanId=null;view='saved';}
      // 이전 버전에서 작성 탭에 남아 있던 저장본·수정 중 사본을 옮깁니다.
      const old=workspaceDraft(),saved=state.iep.plans.find(p=>p.id===old.savedId&&p.recipient===index);
      if(saved){state.iep.savedDrafts[saved.id] ||= clone(old);state.iep.drafts[index]=blank();openSavedPlan(saved);persist();}
      view=view==='saved'?'saved':draft().result&&!draft().dirtyInput?'result':'form';shell();root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('submit',createPlan);
      root.addEventListener('compositionend',event=>{const el=event.target;if(el.tagName==='TEXTAREA'&&!document.body.classList.contains('mockup-editing'))el.dispatchEvent(new Event('input',{bubbles:true}));});scheduleJob();
    },
    async simulate(action,value){
      if(quota().busy||starting||settling){toast('진행 중인 계획이 완료된 뒤 변경해 주세요.');refreshMockControls();return;}
      if(action==='tier')usage().tier=value==='pro'?'pro':'starter';
      else if(action==='outcome')usage().nextOutcome=value==='failure'?'failure':'success';
      else if(action==='cycle'){usage().cycleStart=usage().cycleEnd;usage().cycleEnd=nextBillingDate(usage().cycleEnd,usage().anchorDay);delete usage().blockedUntil;}
      if(await persist()===false)return;if(liveRoot())shell();refreshMockControls();
    },
    getRange(key){return draft().input[key] ||= {from:'',to:''};},
    validDate,
    setAgeBand(value){
      if(!ageBands.includes(value)||state.recipients[index].ageBand===value)return;
      state.recipients[index].ageBand=value;
      setFieldError($('#iep-age-band'),'');
      if(view!=='saved'){
        const d=draft();d.input.ageBand=value;
        if(view==='result'&&d.result){d.result.input.ageBand=value;markReview(d);renderResult();registerEdits();}
        else d.dirtyInput=true;
      }
      persist();
    },
    commitRange(key){
      const d=draft();$(`#iep-${key}-value`).textContent=period(d.input[key]);
      const control=$(`#iep-${key}-date`);if(control?.hasAttribute('aria-invalid'))setFieldError(control,periodError(d.input));
      if(view==='result'&&d.result){d.result.input[key]=clone(d.input[key]);d.result.confirmed=false;renderResult();registerEdits();}
      else d.dirtyInput=true;
      persist();
    }
  };
}
