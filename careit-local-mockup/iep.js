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
  const aiDraftIds=new WeakMap();
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
    root.innerHTML=`<header class="page-header"><div class="iep-title"><h1>월간 계획</h1></div><div class="iep-inline-actions"><a class="button tertiary" href="#/iep?recipient=${index}">학기별 IEP</a><button type="button" class="button secondary" data-iep-action="new">새 계획</button></div></header>
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
      <section class="iep-card"><div class="iep-card-heading"><h2>2. 교육목표</h2><button type="button" class="button tertiary" data-action="iep-ai-help" data-iep-help="goal">목표 함께 정하기</button></div>
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
      ${historyHTML(r)}${sourceHTML(r)}<div data-iep-review-notice></div><div data-iep-goal-choice></div>
      <div class="iep-card iep-action-bar" data-iep-savebar><div><strong data-iep-save-message>${r.confirmed?'저장한 계획이에요':'수정한 내용을 확인하고 저장해 주세요'}</strong></div><button type="button" class="button primary" data-iep-action="save" ${r.confirmed?'disabled':''}>${r.confirmed?'저장 완료':savedPlanId?'변경 내용 저장':'검토 완료하고 저장'}</button></div>`;
    refreshReviewUI();
  }
  function sourceHTML(r){
    const sources=resultSourceIds(r).map(id=>[...SOURCES,...RETIRED_SOURCES].find(source=>source.id===id)).filter(Boolean);
    if(!sources.length)return '';
    return `<details class="iep-card iep-sources"><summary>계획 구성에 참고한 자료</summary><ul>${sources.map(source=>`<li>${source.url?`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>`:esc(source.title)} <span>${esc(source.meta||'')}</span>${source.principle?`<p>${esc(source.principle)}</p>`:''}</li>`).join('')}</ul><p class="iep-help">교육과정 연결과 계획 내용은 작성자가 확인해 주세요.</p></details>`;
  }
  function resultCards(r){
    const fieldHTML=keys=>keys.map(key=>{const s=r.sections.find(s=>s.fields.some(f=>f[0]===key));return resultField(s,s.fields.find(f=>f[0]===key));}).join('');
    const group=(title,keys,{collapsed=false,summary='',review='',help=''}={})=>`<${collapsed?'details':'section'} class="iep-card iep-result-group" ${review?`data-review-group="${review}"`:''}>${collapsed?`<summary><strong>${title}</strong>${summary?`<span class="iep-summary">${esc(summary)}</span>`:''}</summary>`:`<div class="iep-card-heading"><h2>${title}</h2>${review?`<span data-review-label="${review}"></span>`:''}${help?`<button type="button" class="button tertiary" data-action="iep-ai-help" data-iep-help="${help}">케어릿 AI에 요청</button>`:''}</div>`}<div class="iep-result-fields iep-two-col">${fieldHTML(keys)}</div>${review?`<button type="button" class="button tertiary iep-review-button" data-iep-action="reviewed" data-section="${review}" hidden>내용 확인 완료</button>`:''}</${collapsed?'details':'section'}>`;
    return group('현행수준·교육목표',['baseline','strength','monthGoal','semesterGoal','familyRequest','connection'],{collapsed:true,summary:valueOf(r,'monthGoal')||'월 목표 미작성'})+
      group('활동 계획',['activity','content'],{review:'content',help:'activity'})+
      group('진행 방법·교사 지원',['steps','support','participationNeeds','responseSupport'],{review:'method'})+
      group('평가방법·평가초점',['evaluationMethod','criterion','observe'],{review:'evaluation',help:'evaluation'})+
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
    aiContext(kind){
      if(!root?.isConnected||view==='saved')return null;
      const d=draft();if(!aiDraftIds.has(d))aiDraftIds.set(d,crypto.randomUUID());
      const target=kind==='goal'?(view==='form'?'iep-monthGoal':'iep-result-monthGoal'):view==='result'?(kind==='activity'?'iep-result-activity':kind==='evaluation'?'iep-result-evaluationMethod':''):'';
      const control=target&&document.getElementById(target);if(!control)return null;
      return {draftId:aiDraftIds.get(d),recipient:index,target,original:control.value,observation:d.input.observation,goal:d.input.monthGoal,month:JSON.stringify(d.input.month)};
    },
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

/* 학기별 IEP는 기존 월간 계획과 별도로 보관합니다. 외부 AI 호출은 없습니다. */
function createCareitSemesterIEP({state,persist,toast,dialog,escapeHTML:esc,registerEdits,journalRows,reportRecords,reportSummary,currentDate,openTypePicker}) {
  const $=(selector,scope=root)=>scope?.querySelector(selector);
  const $$=(selector,scope=root)=>[...(scope?.querySelectorAll(selector)||[])];
  const uid=()=>crypto.randomUUID();
  const areas=['인지','의사소통','사회정서','운동','적응행동'];
  const previousAreas=['신체운동·건강','의사소통','사회관계','예술경험','자연탐구'];
  const stepNames=[['personal','인적사항'],['placement','배치·지원계획'],['services','관련서비스'],['current','현행수준'],['plan','학기별 IEP'],['meeting','지원팀 회의록'],['assessment','학기별 평가'],['document','종합보고서·내보내기']];
  const stepTitle=id=>{const label=stepNames.find(([key])=>key===id)?.[1]||plan.customSteps?.find(item=>item.id===id)?.name||id;return plan.formSettings?.steps?.[id]||plan.formSettings?.sections?.[`${id}:${label}`]||label;};
  const orderedSteps=()=>{const hidden=plan.formSettings?.hiddenSteps||[],ids=[...stepNames.map(([id])=>id),...(plan.customSteps||[]).map(item=>item.id)].filter(id=>!hidden.includes(id));const saved=plan.formSettings?.stepOrder||[];return [...new Set([...saved.filter(id=>ids.includes(id)),...ids])];};
  const goalLimit=10,domainLimit=10;
  const goal=()=>({id:uid(),text:'',period:'',supportLevel:'',criterion:'',activity:'',method:'',evaluation:'',months:{},observations:[]});
  const newObservation=()=>({id:uid(),month,date:'',situation:'',behavior:'',support:'',evidence:''});
  const observationDrafts=new Map();
  function observationState(g){
    const key=`${g.id}:${month}`;
    if(!observationDrafts.has(key))observationDrafts.set(key,{drafts:[],order:g.observations.filter(item=>Number(item.month)===month).map(item=>item.id)});
    const state=observationDrafts.get(key);
    if(!state.order.length){const draft=newObservation();state.drafts.push(draft);state.order.push(draft.id);}
    return state;
  }
  const domain=name=>({id:uid(),name,strength:'',needs:'',current:'',longGoal:'',goals:[goal()]});
  const planFor=(recipient,year,term)=>({id:uid(),recipient,year,term,domains:areas.map(domain),support:{},meeting:{},references:[],revision:0,savedRevision:null});
  let root,index,plan,section='personal',recordsFrom='personal',domainId,goalId,month,saving=false,formEditing=false,draggedStep=null,dragScrollTimer=null,dragScrollDirection=0,stageObserver=null,builderDragging=null;
  state.iep.semesterPlans ||= [];
  const activeDomain=()=>plan.domains.find(item=>item.id===domainId)||plan.domains[0];
  const activeGoal=()=>activeDomain()?.goals.find(item=>item.id===goalId)||activeDomain()?.goals[0];
  const months=()=>plan.term===1?[3,4,5,6,7,8]:[9,10,11,12,1,2];
  function choose(year,term){
    plan=state.iep.semesterPlans.find(p=>p.recipient===index&&p.year===year&&p.term===term);
    if(!plan){plan=planFor(index,year,term);state.iep.semesterPlans.push(plan);}
    plan.personal ||= {};plan.support ||= {};plan.meeting ||= {};plan.references ||= [];
    const empty=value=>value==null||value===''||(Array.isArray(value)?value.every(empty):typeof value==='object'&&Object.entries(value).every(([key,item])=>key==='id'||empty(item)));
    if(plan.domains.length===previousAreas.length&&plan.domains.every((d,i)=>d.name===previousAreas[i])){
      plan.domains.forEach((d,i)=>{
        if(d.name===areas[i]||plan.domains.some(other=>other!==d&&other.name===areas[i]))return;
        if(d.goals.length===1&&!plan.references.some(ref=>ref.domainId===d.id)&&Object.entries(d).every(([key,value])=>key==='id'||key==='name'||empty(value)))d.name=areas[i];
      });
      areas.forEach(name=>{if(plan.domains.length<domainLimit&&!plan.domains.some(d=>d.name===name))plan.domains.push(domain(name));});
    }
    const existingMotor=plan.domains.find(d=>d.name==='신체운동·건강'),newMotor=plan.domains.find(d=>d.name==='운동');
    if(plan.domains.length===areas.length+1&&existingMotor&&newMotor&&areas.every(name=>plan.domains.filter(d=>d.name===name).length===1)&&newMotor.goals.length===1&&!plan.references.some(ref=>ref.domainId===newMotor.id)&&Object.entries(newMotor).every(([key,value])=>key==='id'||key==='name'||empty(value))){
      existingMotor.name='운동';plan.domains=plan.domains.filter(d=>d!==newMotor);
      plan.domains.sort((a,b)=>areas.indexOf(a.name)-areas.indexOf(b.name));
    }
    state.iep.selectedSemester ||= {};state.iep.selectedSemester[index]={year,term};persist();
    domainId=plan.domains[0]?.id;goalId=activeDomain()?.goals[0]?.id;month=months()[0];
    if(section!=='records'&&!orderedSteps().includes(section))section=orderedSteps()[0];
  }
  const isDirty=()=>!!plan&&plan.revision>0&&plan.revision!==plan.savedRevision;
  function syncSave(){const button=$('[data-iew-action="save"]');if(button)button.disabled=saving||!isDirty();}
  function touch(){plan.revision++;syncSave();persist();}
  async function saveSemester(){
    if(saving)return false;
    if(!isDirty())return true;
    const savingPlan=plan,previous=savingPlan.savedRevision,previousAt=savingPlan.savedAt;
    saving=true;savingPlan.savedRevision=savingPlan.revision;savingPlan.savedAt=new Date().toISOString();syncSave();
    let saved=false;try{saved=await persist();}catch{}
    if(!saved){savingPlan.savedRevision=previous;savingPlan.savedAt=previousAt;}
    saving=false;syncSave();
    if(saved)toast('IEP를 저장했어요.');
    return !!saved;
  }
  const value=(obj,key)=>esc(obj?.[key]||'');
  const fieldSetting=(scope,key)=>plan.formSettings?.fields?.[`${scope}:${key}`]||{};
  const fieldHidden=(scope,key)=>!!fieldSetting(scope,key).hidden;
  const fieldTitle=(scope,key,label)=>fieldHidden(scope,key)?'':fieldSetting(scope,key).title||label;
  const fieldRequired=()=>false;
  const builder=()=>{const settings=plan.formSettings ||= {};const data=settings.builder ||= {};data.sections ||= [];data.fields ||= [];data.sectionOrder ||= {};data.fieldOrder ||= {};data.hiddenSections ||= [];plan.builderValues ||= {};return data;};
  const builderSectionHidden=id=>builder().hiddenSections.includes(id);
  const builderScoped=()=>['current','plan','assessment'].includes(section);
  const builderSlot=step=>['current','plan','assessment'].includes(step)?(activeDomain()?.id||'plan'):'plan';
  const builderValue=item=>plan.builderValues?.[item.id]?.[builderSlot(item.step)]||'';
  const builderParse=value=>{try{return JSON.parse(value);}catch{return null;}};
  function builderDisplay(item,value){
    if(!value)return '';
    const parsed=builderParse(value);
    if(item.type==='choice'&&item.multiple&&Array.isArray(parsed))return parsed.join(', ');
    if((item.type==='time'||item.type==='duration')&&parsed&&typeof parsed==='object'){
      if(item.type==='time')return [parsed.hour||parsed.minute?parsed.period:'',parsed.hour?`${parsed.hour}시`:'',parsed.minute?`${parsed.minute}분`:''].filter(Boolean).join(' ');
      return [['hour','시간'],['minute','분'],['second','초']].map(([key,label])=>parsed[key]!==''&&parsed[key]!=null?`${parsed[key]}${label}`:'').filter(Boolean).join(' ');
    }
    if(item.type==='number'&&item.unit)return `${value} ${item.unit}`;
    return String(value);
  }
  const builderAllowed=item=>!item.domainId||item.domainId===activeDomain()?.id;
  const builderSectionTitle=item=>{const owner=builder().sections.find(row=>`custom:${row.id}`===item.sectionId);if(owner)return owner.title;if(item.sectionId===`builtin:${item.step}:main`)return stepTitle(item.step);const prefix=`builtin:${item.step}:${item.step}:`;if(item.sectionId.startsWith(prefix)){const original=item.sectionId.slice(prefix.length);return plan.formSettings?.sections?.[`${item.step}:${original}`]||original;}return item.sectionTitle||stepTitle(item.step);};
  const editIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
  const deleteIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const fieldEdit=(scope,key,label,required)=>formEditing?`<button type="button" class="iew-form-edit-control" data-iew-action="edit-field" data-iew-scope="${esc(scope)}" data-iew-key="${esc(key)}" data-iew-label="${esc(label)}" data-iew-required="${required}" aria-label="${esc(label)} 항목 설정">${editIcon}</button><button type="button" class="iew-form-edit-control iew-form-delete" data-iew-action="delete-field" data-iew-scope="${esc(scope)}" data-iew-key="${esc(key)}" data-iew-label="${esc(label)}" aria-label="${esc(label)} 항목 삭제">${deleteIcon}</button>`:'';
  const fieldHeader=(id,scope,key,label,required,hideOptional=false)=>`<div class="iew-form-label"><label for="${esc(id)}">${esc(label)}</label>${fieldEdit(scope,key,label,required)}</div>`;
  function dateControl(id,label,saved,attrs,required=false){
    const valid=/^\d{4}-\d{2}-\d{2}$/.test(saved)&&!Number.isNaN(Date.parse(saved))&&new Date(saved).toISOString().slice(0,10)===saved;
    const shown=valid?`${saved.slice(0,4)}년 ${Number(saved.slice(5,7))}월 ${Number(saved.slice(8,10))}일`:saved||'날짜 선택';
    return `<div class="datefield iew-datefield"><input type="hidden" ${attrs} value="${esc(saved)}"><button id="${esc(id)}" type="button" class="datefield-trigger" data-action="date" data-iep-single-date data-value="${esc(saved)}" aria-label="${esc(label)}${required?' (필수)':''}" aria-haspopup="dialog" aria-expanded="false"><span>${esc(shown)}</span><svg viewBox="30 -930 900 900" fill="currentColor" aria-hidden="true"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Z"/></svg></button></div>`;
  }
  function field(label,obj,key,extra='',valueKey=key,type='textarea',placeholder=''){
    const id=`iew-${key}`;
    const scope=extra.match(/data-iew-scope="([^"]+)"/)?.[1],required=fieldRequired(scope,valueKey);
    if(fieldHidden(scope,valueKey))return '';
    label=fieldTitle(scope,valueKey,label);
    const saved=String(obj?.[valueKey]||'');
    if(type==='text'&&/[\r\n]/.test(saved))type='textarea';
    if(type==='birthday')type=/[\r\n]/.test(saved)?'textarea':'birthday';
    const attrs=`${extra} ${required?'aria-required="true"':''}`;
    const hint=placeholder?`placeholder="${esc(placeholder)}"`:'';
    const control=type==='date'?dateControl(id,label,saved,attrs,required):type==='textarea'?`<textarea id="${id}" maxlength="2400" rows="3" ${hint} ${attrs}>${value(obj,valueKey)}</textarea>`:`<input id="${id}" type="${type==='birthday'?'text':type}" ${type==='birthday'?'inputmode="numeric" autocomplete="bday"':type==='text'?'maxlength="2400"':''} ${hint} value="${value(obj,valueKey)}" ${attrs}>`;
    const heading=fieldHeader(id,scope,valueKey,label,required,scope==='personal');
    return `<div class="field iep-field">${heading}${control}</div>`;
  }
  const personalFields=[['sex','성별','sex'],['birth','생년월일','birthday'],['className','학급명','text'],['disability','장애유형','text'],['placement','특수교육 선정유형','text'],['degree','장애 정도','text']];
  const placementFields=[['special','특수학급 참여 계획'],['integrated','통합학급 참여 계획'],['specialTeacher','특수학급 담당 교사','text'],['integratedTeacher','통합학급 담당 교사','text']];
  const supportFields=[['therapy','치료지원 종류'],['therapyDetails','치료지원 기관·일정'],['afterSchool','방과후과정 지원 계획'],['transport','통학지원'],['personnel','지원인력 배치 계획'],['assistive','보조공학'],['family','가족·상담·정보접근']];
  const meetingFields=[['date','회의 날짜','date'],['place','회의 장소','text'],['notes','원문 메모'],['participants','참석자 역할'],['parent','보호자 의견'],['teacher','교사 의견'],['services','관련서비스 의견'],['strength','논의한 강점'],['needs','논의한 지원 요구'],['placement','배치·통합 지원'],['agreement','합의 목표'],['home','가정 연계'],['decisions','결정 사항'],['followup','후속 조치']];
  function contextFields(kind){
    const s=plan.support,m=plan.meeting;
    const fields=(items,obj,scope)=>items.map(([key,label,type,placeholder])=>{
      if(fieldHidden(scope,key))return '';
      const attrs=`data-iew-scope="${scope}" data-iew-key="${key}"`;
      if(type==='sex'&&!/[\r\n]/.test(obj[key]||'')){
        const options=['남성','여성'],saved=obj[key]||'';
        if(saved&&saved!=='기타'&&!options.includes(saved))options.push(saved);
        const title=fieldTitle(scope,key,label),required=fieldRequired(scope,key);
        return `<div class="field iep-field">${fieldHeader('iew-sex',scope,key,title,required,true)}<div class="iew-select"><select id="iew-sex" ${attrs} ${required?'aria-required="true"':''}><option value="">선택해 주세요</option>${saved==='기타'?'<option value="기타" selected hidden>기타</option>':''}${options.map(option=>`<option value="${esc(option)}" ${option===saved?'selected':''}>${esc(option)}</option>`).join('')}</select></div></div>`;
      }
      return field(label,obj,key,attrs,key,type==='sex'?'textarea':type,placeholder);
    }).join('');
    const configs={personal:['인적사항',plan.personal,personalFields,'personal',''],placement:['배치·지원계획',s,placementFields,'support',''],services:['관련서비스',s,supportFields,'support',''],meeting:['지원팀 회의록',m,meetingFields,'meeting','']};
    const [title,obj,items,scope,help]=configs[kind];
    if(kind==='meeting')return `<section class="iep-card"><div class="iep-card-heading"><div><h2 data-iew-step="${kind}">${title}</h2></div></div><div class="iep-two-col">${fields(items.slice(0,4),obj,scope)}</div></section><section class="iep-card"><div class="iep-card-heading"><h2>의견과 논의</h2></div><div class="iep-two-col">${fields(items.slice(4,10),obj,scope)}</div></section><section class="iep-card"><div class="iep-card-heading"><h2>합의와 후속 조치</h2></div><div class="iep-two-col">${fields(items.slice(10),obj,scope)}</div></section>`;
    return `<section class="iep-card"><div class="iep-card-heading"><div><h2 data-iew-step="${kind}">${title}</h2>${help?`<p class="iep-help">${esc(help)}</p>`:''}</div>${['placement','services'].includes(kind)?`<button type="button" class="button tertiary" data-action="iep-ai-help" data-iep-help="${kind}">AI에게 작성 요청</button>`:''}</div><div class="iep-two-col${kind==='personal'?' iew-personal-fields':kind==='placement'?' iew-placement-fields':''}">${fields(items,obj,scope)}</div></section>`;
  }
  function customStepHTML(id){
    const item=plan.customSteps?.find(step=>step.id===id);
    if(!item)return '';
    const scope=`custom:${id}`,content=fieldHidden(scope,'content')?'':`<div class="field iep-field">${fieldHeader('iew-custom-content',scope,'content',fieldTitle(scope,'content','내용'),false)}<textarea id="iew-custom-content" maxlength="2400" rows="3" data-iew-scope="${esc(scope)}" data-iew-step="${esc(id)}" data-iew-key="content">${value(item,'content')}</textarea></div>`;
    return `<section class="iep-card"><div class="iep-card-heading"><h2 data-iew-step="${esc(id)}">${esc(stepTitle(id))}</h2></div>${content}</section>`;
  }
  function observationHTML(observation,single=false){
    const f=(key,label,placeholder='')=>{if(fieldHidden('observation',key))return '';const required=fieldRequired('observation',key,key==='behavior'),id=`iew-observation-${key}-${observation.id}`,attrs=`data-iew-scope="observation" data-iew-observation="${esc(observation.id)}" data-iew-key="${key}"`;label=fieldTitle('observation',key,label);return `<div class="iew-observation-field">${fieldHeader(id,'observation',key,label,required)}<textarea id="${esc(id)}" rows="2" maxlength="1200" ${attrs} ${required?'aria-required="true"':''} placeholder="${esc(placeholder)}">${value(observation,key)}</textarea></div>`;};
    return `<article class="iew-observation">${single?'':`<div class="iew-row iew-observation-header"><strong>관찰 기록</strong><button type="button" class="button danger" data-iew-action="remove-observation" data-iew-id="${esc(observation.id)}">삭제</button></div>`}<div class="iep-two-col">${f('situation','어떤 상황이었나요?')}${f('behavior','실제 행동')}${f('support','제공한 도움')}${f('evidence','근거 또는 메모')}</div></article>`;
  }
  function workspaceHTML(kind){
    const d=activeDomain(),g=activeGoal();if(!d||!g)return '<section class="iep-card">영역을 추가해 주세요.</section>';
    const options=d.goals.length>1?d.goals.map((item,i)=>`<button type="button" class="iew-goal-tab ${item.id===g.id?'active':''}" data-iew-action="goal" data-iew-id="${esc(item.id)}" aria-pressed="${item.id===g.id}">${esc(item.text.trim()||`목표 ${i+1}`)}</button>`).join(''):'';
    const monthsHTML=months().map(n=>`<option value="${n}" ${n===month?'selected':''}>${n}월</option>`).join('');
    const monthly=g.months?.[month]||{};
    const sectionButton=(label,kind)=>`<button type="button" class="button tertiary" data-action="iep-ai-help" data-iep-help="${kind}">${label}</button>`;
    const areasNav=`<aside class="iep-card iew-domains"><div class="iew-row"><h2>영역</h2></div><div class="iew-domain-list">${plan.domains.map(item=>`<div class="iew-domain-row ${item.id===d.id?'active':''}"><button type="button" class="iew-domain ${item.id===d.id?'active':''}" data-iew-action="domain" data-iew-id="${esc(item.id)}" aria-pressed="${item.id===d.id}"><span>${esc(item.name)}</span></button>${formEditing?`<div class="iew-domain-actions"><button type="button" class="iew-form-edit-control" data-iew-action="rename-domain" data-iew-id="${esc(item.id)}" aria-label="${esc(item.name)} 영역 이름 수정">${editIcon}</button><button type="button" class="iew-form-edit-control iew-form-delete" data-iew-action="remove-domain" data-iew-id="${esc(item.id)}" aria-label="${esc(item.name)} 영역 삭제">${deleteIcon}</button></div>`:""}</div>`).join('')}</div><button type="button" class="button secondary iew-add-area" data-iew-action="add-domain">영역 추가</button></aside>`;
    const current=`<section class="iep-card"><div class="iep-card-heading"><h2 data-iew-step="current">${esc(d.name)} · ${esc(stepTitle("current"))}</h2><div class="iep-inline-actions">${sectionButton('AI에게 작성 요청','current')}</div></div><div class="iep-two-col">${field('강점',d,'strength','data-iew-scope="domain" data-iew-key="strength"')}${field('지도점',d,'needs','data-iew-scope="domain" data-iew-key="needs"')}</div></section>`;
    const planning=`<section class="iep-card"><div class="iep-card-heading"><div><h2 data-iew-step="plan">${esc(d.name)} · ${esc(stepTitle("plan"))}</h2></div></div><div class="iew-section-divider">${field('장기목적',d,'longGoal','data-iew-scope="domain" data-iew-key="longGoal"')}</div></section>
      <section class="iep-card"><div class="iep-card-heading"><h2>단기목표</h2><div class="iep-inline-actions"><button type="button" class="button secondary iew-secondary" data-iew-action="add-goal" ${d.goals.length>=goalLimit?'disabled':''}>목표 추가 (${d.goals.length}/${goalLimit})</button>${sectionButton('AI에게 목표 작성 요청','goal')}${options?'<button type="button" class="button danger" data-iew-action="remove-goal">삭제</button>':''}</div></div>${options?`<div class="iew-goals">${options}</div>`:''}<div class="iep-two-col iew-goal-fields">${field('단기목표',g,'goal-text','data-iew-scope="goal" data-iew-key="text"','text')}${field('평가 기준',g,'criterion','data-iew-scope="goal" data-iew-key="criterion"')}</div></section>
      `;
    const observationView=kind==='assessment'?observationState(g):null,singleObservation=observationView?.order.length===1?observationView.order[0]:null;
    const unassigned=kind==='assessment'?g.observations.filter(item=>!months().includes(Number(item.month))):[];
    const assessment=kind==='assessment'?`<section class="iep-card"><div class="iep-card-heading iew-assessment-heading"><h2 data-iew-step="assessment">${esc(d.name)} · ${esc(stepTitle("assessment"))}</h2></div>${options?`<div class="iew-goals">${options}</div>`:`<div class="iew-assessment-goal"><span>단기목표</span><p>${esc(g.text.trim()||'작성한 단기목표가 없어요.')}</p></div>`}</section><section class="iep-card"><div class="iep-card-heading"><h2>평가 계획</h2>${sectionButton('AI에게 평가 계획 작성 요청','assessment')}</div><div class="iep-two-col">${field('평가 방법',g,'assessment-method','data-iew-scope="goal" data-iew-key="evaluation"','evaluation')}${field('평가 기준',g,'assessment-criterion','data-iew-scope="goal" data-iew-key="criterion"','criterion')}${field('평가 기간',g,'assessment-period','data-iew-scope="goal" data-iew-key="period"','period','text')}</div></section><section class="iep-card"><div class="iep-card-heading"><h2>월별 계획과 평가</h2><label class="iew-month"><span class="sr-only">월 선택</span><select data-iew-switch="month">${monthsHTML}</select></label></div><div class="iep-two-col">${field('월 목표',monthly,'monthly-goal','data-iew-scope="month" data-iew-key="goal"','goal')}${field('월 실행계획',monthly,'monthly-plan','data-iew-scope="month" data-iew-key="plan"','plan')}${field('월 평가',monthly,'monthly-evaluation','data-iew-scope="month" data-iew-key="evaluation"','evaluation')}</div></section>
      <section class="iep-card"><div class="iep-card-heading"><h2>${month}월 관찰</h2><div class="iep-inline-actions"><button type="button" class="button secondary iew-secondary" data-iew-action="add-observation">관찰 추가</button>${singleObservation?`<button type="button" class="button danger" data-iew-action="remove-observation" data-iew-id="${esc(singleObservation)}" ${observationView.drafts.some(item=>item.id===singleObservation)?'hidden':''}>삭제</button>`:''}</div></div>${observationView.order.map(id=>{const item=g.observations.find(row=>row.id===id)||observationView.drafts.find(row=>row.id===id);return item?observationHTML(item,!!singleObservation):'';}).join('')}</section>${unassigned.length?`<section class="iep-card"><div class="iep-card-heading"><h2>월 미지정 관찰</h2></div><p class="iep-help iew-unassigned-help">기존 관찰의 월을 선택하면 해당 월로 이동해요.</p>${unassigned.map(item=>`<div class="iew-unassigned"><label class="iew-assign-month"><span>관찰 월${item.date?` · ${esc(item.date)}`:''}</span><select data-iew-assign-month="${esc(item.id)}"><option value="">선택해 주세요</option>${months().map(n=>`<option value="${n}">${n}월</option>`).join('')}</select></label>${observationHTML(item)}</div>`).join('')}</section>`:''}<section class="iep-card"><div class="iep-card-heading"><h2>학기말 평가</h2></div><div class="iep-two-col">${field('영역별 누가기록',d,'cumulative','data-iew-scope="domain" data-iew-key="cumulative"')}${field('학기말 평가 보고',d,'semesterEvaluation','data-iew-scope="domain" data-iew-key="semesterEvaluation"')}</div></section>`:'';
    return `<div class="iew-layout">${areasNav}<div class="iew-content">${kind==='current'?current:kind==='assessment'?assessment:planning}</div></div>`;
  }
  function hash(text){let a=2166136261,b=5381;for(const c of String(text)){const n=c.charCodeAt(0);a=Math.imul(a^n,16777619);b=Math.imul(b^n,33);}return `${a>>>0}-${b>>>0}`;}
  function records(){
    const reports=reportRecords(index).map(item=>{const summary=reportSummary(index,item);return {kind:'report',key:`report:${item.id}`,title:`리포트 · ${item.from} ~ ${item.to}`,meta:`작성일 ${item.generated||'확인 불가'}`,text:`작성일 ${item.generated}${summary?'\n'+summary:'\n확인할 수 있는 분석 내용이 없어요.'}`,summary,fingerprint:hash(JSON.stringify([item.id,item.from,item.to,item.generated,item.version,summary])),href:`#/reports?recipient=${index}&report=${encodeURIComponent(item.id)}&from=${item.from}`};});
    return reports;
  }
  function recordsHTML(){
    const available=records(),attached=(plan.references||[]).filter(ref=>ref.kind==='report');
    const currentGoal=activeGoal(),currentDomain=activeDomain();
    const selected=attached.map(ref=>{
      const record=available.find(item=>item.key===ref.key),changed=record&&record.fingerprint!==ref.fingerprint;
      const linkedDomain=plan.domains.find(item=>item.id===ref.domainId),linkedGoal=linkedDomain?.goals.find(item=>item.id===ref.goalId);
      const location=linkedDomain?`${esc(linkedDomain.name)}${linkedGoal?' · '+esc(linkedGoal.text||'단기목표'):''}`:'계획 전체';
      return `<article class="iew-reference"><div class="iew-linked-row"><div class="iew-linked-copy"><strong>${esc(ref.title.replace(/^리포트 · /,''))}</strong><p class="iep-help iew-linked-meta">${record?`<span>${esc(record.meta)}</span>`:''}<span>${location}</span></p>${!record?'<p class="iep-help">원본이 변경되었거나 삭제되어 확인할 수 없어요</p>':changed?'<p class="iep-help">원본이 변경되었어요. 현재 내용을 확인해 주세요.</p>':''}</div><button type="button" class="button secondary iew-secondary" data-iew-action="detach" data-iew-id="${esc(ref.id)}">연결 해제</button></div>${record?`<details><summary>내용 보기</summary><div class="iew-record-details"><p>${esc(record.summary||'확인할 수 있는 분석 내용이 없어요.')}</p><a href="${esc(record.href)}">원본 화면 열기</a></div></details>`:''}</article>`;
    }).join('');
    const selectable=available.filter(item=>!attached.some(ref=>ref.key===item.key));
    const candidates=selectable.map(item=>`<article class="iew-reference" data-iew-record-type="${item.kind}"><label class="iew-record-choice"><input type="checkbox" data-iew-record="${esc(item.key)}"><span><strong>${esc(item.title.replace(/^리포트 · /,''))}</strong><small>${esc(item.meta)}</small></span></label><details><summary>내용 보기</summary><div class="iew-record-details"><p>${esc(item.summary||'확인할 수 있는 분석 내용이 없어요.')}</p><a href="${esc(item.href)}">원본 화면 열기</a></div></details></article>`).join('');
    return `<section class="iep-card iew-linked-reports"><div class="iep-card-heading"><h2>연결한 리포트</h2></div>${selected||'<p class="iep-help">연결한 리포트가 없어요.</p>'}</section><section class="iep-card iew-report-picker"><div class="iep-card-heading"><h2>리포트 선택</h2><button type="button" class="button primary" data-iew-action="attach" disabled>선택한 기록 연결 <span data-iew-selected-count>0</span></button></div><div class="iew-record-filters"><div class="iew-target"><label for="iew-reference-target">연결할 위치</label><select id="iew-reference-target"><option value="plan">계획 전체</option><option value="goal">${esc(currentDomain?.name||'영역')} · ${esc(currentGoal?.text||'선택한 목표')}</option></select></div><label class="iew-search">검색<input type="search" data-iew-filter="query" placeholder="날짜나 내용 검색"></label></div>${selectable.length?`<div class="iew-record-list-toolbar"><label><input type="checkbox" data-iew-select-all> 표시된 리포트 전체 선택</label><span aria-live="polite"><span data-iew-selected-count>0</span>개 선택</span></div><p class="iep-help iew-hidden-selection" data-iew-hidden-selection hidden>검색으로 가려진 리포트의 선택도 유지돼요.</p><div class="iew-record-list">${candidates}</div><p class="iep-help iew-record-empty" data-iew-no-results hidden>검색 결과가 없어요.</p>`:`<p class="iep-help">${available.length?'모든 리포트가 연결되었어요.':'선택할 수 있는 저장된 리포트가 없어요.'}</p>`}</section>`;
  }
  function documentHTML(){
    const hasValue=value=>value!=null&&String(value).trim()!=='';
    const rows=items=>{const present=items.filter(([label,value,required])=>label&&(required||hasValue(value)));return present.length?`<dl class="iew-report-rows">${present.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd${hasValue(value)?'':' class="iew-report-empty"'}>${esc(hasValue(value)?String(value):'미작성')}</dd></div>`).join('')}</dl>`:'';};
    const visibleStep=id=>orderedSteps().includes(id);
    const included=new Set(),data=builder();
    const addedRows=(sectionId,slot)=>data.fields.filter(item=>item.sectionId===sectionId&&visibleStep(item.step)&&!builderSectionHidden(sectionId)&&!fieldHidden('builder',item.id)&&(!item.domainId||item.domainId===slot)&&hasValue(builderDisplay(item,plan.builderValues?.[item.id]?.[slot]))).map(item=>{included.add(`${item.id}:${slot}`);return [fieldTitle('builder',item.id,item.title),builderDisplay(item,plan.builderValues[item.id][slot])];});
    const goalVisible=visibleStep('plan')&&!builderSectionHidden('builtin:plan:plan:단기목표');
    const assessmentVisible=visibleStep('assessment')&&!builderSectionHidden('builtin:assessment:assessment:평가 계획');
    const monthlyVisible=visibleStep('assessment')&&!builderSectionHidden('builtin:assessment:assessment:월별 계획과 평가');
    const observationVisible=visibleStep('assessment')&&!builderSectionHidden('builtin:assessment:monthly-observation');
    const goalHasContent=g=>[g.text,g.period,g.supportLevel,g.criterion,g.activity,g.method,g.evaluation].some(hasValue)||Object.values(g.months||{}).some(m=>hasValue(m.goal)||hasValue(m.plan)||hasValue(m.evaluation))||g.observations.some(o=>Object.entries(o).some(([key,value])=>key!=='id'&&key!=='month'&&hasValue(value)));
    const domainHasContent=d=>[d.current,d.strength,d.needs,d.longGoal,d.cumulative,d.semesterEvaluation].some(hasValue)||d.goals.some(goalHasContent);
    const started=plan.domains.filter(domainHasContent),empty=plan.domains.filter(d=>!domainHasContent(d));
    const block=(heading,items)=>{const content=rows(items);return content?`<div class="iew-report-block"><h3>${esc(heading)}</h3>${content}</div>`:'';};
    const ds=started.map(d=>{
      const current=visibleStep('current')?block(plan.formSettings?.sections?.['current:현재 모습']||stepTitle('current'),[['현재 수행 모습',d.current],[fieldTitle('domain','strength','강점'),d.strength,fieldRequired('domain','strength')],[fieldTitle('domain','needs','지도점'),d.needs,fieldRequired('domain','needs')],...addedRows('builtin:current:main',d.id)]):'';
      const goalSections=d.goals.map((g,i)=>{
        const order=months(),monthRows=Object.entries(g.months||{}).sort(([a],[b])=>(order.indexOf(Number(a))<0?12:order.indexOf(Number(a)))-(order.indexOf(Number(b))<0?12:order.indexOf(Number(b)))).flatMap(([n,m])=>[[fieldHidden('month','goal')?'':`${n}월 · ${fieldTitle('month','goal','월 목표')}`,m.goal],[fieldHidden('month','plan')?'':`${n}월 · ${fieldTitle('month','plan','월 실행계획')}`,m.plan],[fieldHidden('month','evaluation')?'':`${n}월 · ${fieldTitle('month','evaluation','월 평가')}`,m.evaluation]]);
        const observations=g.observations.map((o,j)=>[`${o.month?`${o.month}월`:'월 미지정'} 관찰 ${j+1}`,[o.date,!fieldHidden('observation','situation')&&o.situation&&`${fieldTitle('observation','situation','어떤 상황이었나요?')}: ${o.situation}`,!fieldHidden('observation','behavior')&&o.behavior&&`${fieldTitle('observation','behavior','실제 행동')}: ${o.behavior}`,!fieldHidden('observation','support')&&o.support&&`${fieldTitle('observation','support','제공한 도움')}: ${o.support}`,!fieldHidden('observation','evidence')&&o.evidence&&`${fieldTitle('observation','evidence','근거 또는 메모')}: ${o.evidence}`].filter(Boolean).join('\n')]);
        const evaluationTitle=plan.formSettings?.sections?.['assessment:평가 계획']||'평가 계획';
        return `<div class="iew-report-goal"><h3>${esc(plan.formSettings?.sections?.['plan:단기목표']||'단기목표')} ${i+1}</h3>${goalVisible?rows([[fieldTitle('goal','text','단기목표'),g.text,fieldRequired('goal','text')],['지원 수준',g.supportLevel]]):''}${visibleStep('plan')?block('교육계획',[['교육내용과 활동',g.activity],['교육방법과 지원',g.method]]):''}${assessmentVisible?block(evaluationTitle,[[fieldTitle('goal','evaluation','평가 방법'),g.evaluation,fieldRequired('goal','evaluation')],[fieldTitle('goal','criterion','평가 기준'),g.criterion,fieldRequired('goal','criterion')],[fieldTitle('goal','period','평가 기간'),g.period,fieldRequired('goal','period')]]):''}${monthlyVisible||observationVisible?block('월별 계획과 관찰',[...(monthlyVisible?monthRows:[]),...(observationVisible?observations:[])]):''}</div>`;
      }).join('');
      const goals=(visibleStep('plan')?block('목표',[[fieldTitle('domain','longGoal','장기목적'),d.longGoal,fieldRequired('domain','longGoal')],...addedRows('builtin:plan:main',d.id)]):'')+((visibleStep('plan')||visibleStep('assessment'))?goalSections:'');
      const evaluation=visibleStep('assessment')&&!builderSectionHidden('builtin:assessment:assessment:학기말 평가')?block('학기말 평가',[[fieldTitle('domain','cumulative','영역별 누가기록'),d.cumulative],[fieldTitle('domain','semesterEvaluation','학기말 평가 보고'),d.semesterEvaluation]]):'';
      return `<section class="iep-card iew-report-section iew-report-domain is-collapsed"><div class="iep-card-heading"><h2>${esc(d.name)}</h2><div class="iep-inline-actions"><button type="button" class="button secondary iew-secondary" data-iew-action="copy-domain" data-iew-id="${esc(d.id)}">영역 내용 복사</button><button type="button" class="iew-report-toggle" data-iew-action="toggle-report" aria-expanded="false" aria-label="${esc(d.name)} 내용 펼치기">펼치기 <span aria-hidden="true">⌄</span></button></div></div><div class="iew-report-body">${current}${goals}${evaluation}</div></section>`;
    }).join('')+(empty.length?`<section class="iep-card iew-report-section iew-empty-domains"><h2>미작성 영역</h2><p class="iep-help">${empty.map(d=>esc(d.name)).join(' · ')}</p></section>`:'');
    const labels={sex:'성별',birth:'생년월일',className:'학급명',disability:'장애유형',degree:'장애 정도',special:'특수학급 참여 계획',specialTeacher:'특수학급 담당 교사',integrated:'통합학급 참여 계획',integratedTeacher:'통합학급 담당 교사',therapy:'치료지원 종류',therapyDetails:'치료지원 기관·일정',afterSchool:'방과후과정 지원 계획',transport:'통학지원',personnel:'지원인력 배치 계획',assistive:'보조공학',family:'가족·상담·정보접근',notes:'원문 메모',date:'회의 날짜',place:'회의 장소',participants:'참석자 역할',parent:'보호자 의견',teacher:'교사 의견',services:'관련서비스 의견',strength:'논의한 강점',needs:'논의한 지원 요구',agreement:'합의 목표',home:'가정 연계',decisions:'결정 사항',followup:'후속 조치'};
    const groups=[[stepTitle('personal'),visibleStep('personal')?plan.personal:{},'특수교육 선정유형','personal'],['배치와 지원·관련서비스',Object.fromEntries(Object.entries(plan.support).filter(([key])=>(placementFields.some(([id])=>id===key)?visibleStep('placement'):visibleStep('services')))),'선정·배치 영역','support'],[stepTitle('meeting'),visibleStep('meeting')?plan.meeting:{},'배치·통합 지원','meeting']].map(([label,items,placement,scope])=>{const extra=scope==='personal'?addedRows('builtin:personal:main','plan'):scope==='support'?[...addedRows('builtin:placement:main','plan'),...addedRows('builtin:services:main','plan')]:addedRows('builtin:meeting:main','plan');const content=rows([...Object.entries(items).filter(([key])=>scope!=='meeting'||(!meetingFields.slice(4,10).some(([id])=>id===key)||!builderSectionHidden('builtin:meeting:meeting:의견과 논의'))&&(!meetingFields.slice(10).some(([id])=>id===key)||!builderSectionHidden('builtin:meeting:meeting:합의와 후속 조치'))).map(([key,value])=>[fieldTitle(scope,key,key==='placement'?placement:labels[key]||key),value,fieldRequired(scope,key)]),...extra]);return content?`<section class="iep-card iew-report-section"><div class="iep-card-heading"><h2>${esc(label)}</h2></div>${content}</section>`:'';}).join('');
    const available=records(),reportReferences=plan.references.filter(ref=>ref.kind==='report'),refs=reportReferences.length?`<section class="iep-card iew-report-section"><div class="iep-card-heading"><h2>참고 리포트</h2></div><dl class="iew-report-rows">${reportReferences.map(ref=>{const source=available.find(item=>item.key===ref.key),status=!source?'원본을 확인할 수 없음':source.fingerprint!==ref.fingerprint?'원본 변경됨 · 확인 필요':'연결됨';return `<div><dt>${esc(ref.title)}</dt><dd>${esc(status)}${source?`<span class="iew-report-link"> · <a href="${esc(source.href)}">원본 보기</a></span>`:''}</dd></div>`;}).join('')}</dl></section>`:'';
    const custom=orderedSteps().map(id=>plan.customSteps?.find(step=>step.id===id)).filter(item=>item&&!fieldHidden(`custom:${item.id}`,'content')&&hasValue(item.content)).map(item=>`<section class="iep-card iew-report-section"><div class="iep-card-heading"><h2>${esc(stepTitle(item.id))}</h2></div>${rows([[fieldTitle(`custom:${item.id}`,'content','내용'),item.content]])}</section>`).join('');
    const addedGroups=new Map();
    for(const item of data.fields){
      if(item.step==='document'||!visibleStep(item.step)||builderSectionHidden(item.sectionId)||fieldHidden('builder',item.id))continue;
      const owner=data.sections.find(row=>`custom:${row.id}`===item.sectionId);if(owner?.hidden)continue;
      const domains=['current','plan','assessment'].includes(item.step)?plan.domains:[{id:'plan',name:''}];
      for(const domain of domains){if((item.domainId&&item.domainId!==domain.id)||(owner?.domainId&&owner.domainId!==domain.id))continue;
        const content=builderDisplay(item,plan.builderValues?.[item.id]?.[domain.id]);if(!hasValue(content)||included.has(`${item.id}:${domain.id}`))continue;
        const key=`${item.sectionId}:${domain.id}`,heading=[domain.name,builderSectionTitle(item)].filter(Boolean).join(' · ');
        if(!addedGroups.has(key))addedGroups.set(key,{heading,items:[]});addedGroups.get(key).items.push([fieldTitle('builder',item.id,item.title),content]);
      }
    }
    const added=Array.from(addedGroups.values(),group=>`<section class="iep-card iew-report-section"><div class="iep-card-heading"><h2>${esc(group.heading)}</h2></div>${rows(group.items)}</section>`).join('');
    return `<section class="iep-card iew-document-view"><div class="iep-card-heading"><div><h2 data-iew-step="document">종합보고서·내보내기</h2><p class="iep-help">${esc(state.recipients[index].name)} · ${plan.year}년 ${plan.term}학기</p></div><div class="iep-inline-actions"><button type="button" class="button secondary iew-secondary" data-iew-action="download">HTML 내려받기</button><button type="button" class="button primary" data-iew-action="print">인쇄 · PDF 저장</button></div></div></section>${groups}${ds}${custom}${added}${refs}<div id="iew-document-builder"></div>`;
  }
  function setupStageScrolling(bar){
    const nav=bar.closest('.iew-stage-nav'),arrows=nav.querySelectorAll('.iew-stage-arrow');
    const update=()=>{
      if(!nav.isConnected){stageObserver?.disconnect();return;}
      const addWidth=nav.querySelector('.iew-add-step')?.offsetWidth||0,overflow=bar.scrollWidth>nav.clientWidth-addWidth+1;
      arrows.forEach(button=>{button.hidden=!overflow;});
      arrows[0].disabled=bar.scrollLeft<=1;
      arrows[1].disabled=bar.scrollLeft+bar.clientWidth>=bar.scrollWidth-1;
    };
    bar.addEventListener('scroll',update,{passive:true});
    stageObserver=new ResizeObserver(update);stageObserver.observe(nav);stageObserver.observe(bar);update();
  }
  function shell(){
    if(!root?.isConnected)return;
    stageObserver?.disconnect();
    const availableYears=[...new Set([plan.year-1,plan.year,plan.year+1,...state.iep.semesterPlans.filter(p=>p.recipient===index).map(p=>p.year)])].sort((a,b)=>a-b);
    const previousScroll=$('.iew-tabs')?.scrollLeft||0,previousGoalScroll=$('.iew-goals')?.scrollLeft||0;
    const tabs=orderedSteps().map(id=>[id,stepTitle(id)]);
    const currentStep=tabs.findIndex(([id])=>id===(section==='records'?recordsFrom:section));
    const returnLabel=tabs.find(([id])=>id===recordsFrom)?.[1]||'인적사항';
    root.innerHTML=`<header class="page-header"><div class="iep-title"><h1>IEP</h1></div></header><section class="iep-card iew-toolbar"><div class="field iep-field"><span>관리대상</span><div class="dropdown"><button type="button" class="dropdown-trigger" data-options="recipients" aria-label="관리대상" aria-haspopup="listbox" aria-expanded="false"><span>${esc(state.recipients[index].name)}</span></button></div></div><div class="field iep-field"><label for="iew-year">학년도</label><div class="iew-select"><select id="iew-year" data-iew-switch="year">${availableYears.map(y=>`<option value="${y}" ${y===plan.year?'selected':''}>${y}년</option>`).join('')}</select></div></div><div class="field iep-field"><label for="iew-term">학기</label><div class="iew-select"><select id="iew-term" data-iew-switch="term"><option value="1" ${plan.term===1?'selected':''}>1학기</option><option value="2" ${plan.term===2?'selected':''}>2학기</option></select></div></div><div class="iew-save"><div class="iew-toolbar-actions"><button type="button" class="button secondary iew-secondary" data-iew-action="section" data-iew-id="records">리포트 연결${plan.references.filter(ref=>ref.kind==='report').length?' '+plan.references.filter(ref=>ref.kind==='report').length:''}</button><button type="button" class="button primary" data-iew-action="save" ${saving||!isDirty()?'disabled':''}>저장</button></div></div></section><div class="iew-stage-bar"><div class="iew-stage-nav"><button type="button" class="iew-stage-arrow" data-iew-action="scroll-steps" data-iew-direction="-1" aria-label="이전 단계 보기" hidden><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4 6 8l4 4"/></svg></button><div class="record-tabs iew-tabs" aria-label="IEP 단계">${tabs.map(([id,label],i)=>`<button type="button" data-iew-action="section" data-iew-id="${esc(id)}" data-iew-reached="${i<=currentStep}" aria-pressed="${i===currentStep}" ${formEditing?'draggable="true" title="끌어서 순서 변경 · Alt와 방향키로 이동"':''}>${formEditing?'<span class="iew-step-handle" aria-hidden="true"><svg viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3h10M3 7h10"/></svg></span>':''}${i+1}. ${esc(label)}</button>`).join('')}</div>${formEditing?'<button type="button" class="iew-add-step" data-iew-action="add-step" aria-label="단계 추가" title="단계 추가"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg></button>':''}<button type="button" class="iew-stage-arrow" data-iew-action="scroll-steps" data-iew-direction="1" aria-label="다음 단계 보기" hidden><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg></button></div><div class="iew-stage-actions"><button type="button" class="button ${formEditing?'primary':'secondary'}" data-iew-action="toggle-form-edit">${formEditing?'완료':'양식 편집'}</button></div></div><div id="iew-content">${['plan','current','assessment'].includes(section)?workspaceHTML(section):['personal','placement','services','meeting'].includes(section)?contextFields(section):section==='records'?`<button type="button" class="button tertiary iew-record-back" data-iew-action="section" data-iew-id="${recordsFrom}">← ${esc(returnLabel)}</button>${recordsHTML()}`:section==='document'?documentHTML():customStepHTML(section)}</div>`;
    decorateFormHeadings();decorateBuilder();registerEdits();enhanceSelects();
    const tabBar=$('.iew-tabs'),activeTab=$('button[aria-pressed="true"]',tabBar);tabBar.scrollLeft=previousScroll;
    setupStageScrolling(tabBar);
    if(activeTab){const bar=tabBar.getBoundingClientRect(),tab=activeTab.getBoundingClientRect();if(tab.right>bar.right)tabBar.scrollLeft+=tab.right-bar.right;else if(tab.left<bar.left)tabBar.scrollLeft-=bar.left-tab.left;}
    const goalBar=$('.iew-goals'),activeGoalTab=$('button[aria-pressed="true"]',goalBar);
    if(goalBar&&activeGoalTab){goalBar.scrollLeft=previousGoalScroll;const bar=goalBar.getBoundingClientRect(),tab=activeGoalTab.getBoundingClientRect();if(tab.right>bar.right)goalBar.scrollLeft+=tab.right-bar.right;else if(tab.left<bar.left)goalBar.scrollLeft-=bar.left-tab.left;}
  }
  function decorateFormHeadings(){
    root.classList.toggle('iew-form-editing',formEditing);
    const selectedName=activeDomain()?.name;
    $$('#iew-content .iep-card h2, #iew-content .iep-card h3').forEach(heading=>{
      if(heading.dataset.iewStep){
        const id=heading.dataset.iewStep,title=stepTitle(id);
        heading.textContent=title;
        if(id==='document')return;
        heading.dataset.iewHeadingStep=id;
        if(formEditing){const button=document.createElement('button');button.type='button';button.className='iew-form-edit-control';button.dataset.iewAction='edit-step';button.dataset.iewStep=id;button.dataset.iewLabel=title;button.setAttribute('aria-label',`${title} 제목 수정`);button.innerHTML=editIcon;heading.append(' ',button);
          const header=heading.closest('.iep-card-heading');if(header){const remove=document.createElement('button');remove.type='button';remove.className='iew-form-edit-control iew-form-delete iew-stage-delete';remove.dataset.iewAction='delete-step';remove.dataset.iewStep=id;remove.dataset.iewLabel=title;remove.setAttribute('aria-label',`${title} 단계 삭제`);remove.disabled=orderedSteps().length<=1;remove.innerHTML=deleteIcon;header.append(remove);}}
        return;
      }
      if(heading.closest('.iew-domains, .iew-report-domain, .iew-empty-domains')||heading.textContent.includes(selectedName||'\u0000'))return;
      const original=heading.textContent.trim();if(!original)return;
      const key=`${section}:${original}`,title=plan.formSettings?.sections?.[key]||original;
      heading.dataset.iewHeadingKey=key;
      heading.textContent=title;
      if(formEditing){const button=document.createElement('button');button.type='button';button.className='iew-form-edit-control';button.dataset.iewAction='edit-heading';button.dataset.iewKey=key;button.dataset.iewLabel=title;button.setAttribute('aria-label',`${title} 제목 수정`);button.innerHTML=editIcon;heading.append(' ',button);}
    });
  }
  function builderFieldHTML(item){
    const scope='builder',key=item.id,label=fieldTitle(scope,key,item.title),id=`iew-builder-${item.id}`,saved=builderValue(item),attrs=`data-iew-scope="builder" data-iew-key="${esc(item.id)}"`;
    if(!label)return '';
    let control;
    if(item.type==='long'||(item.type==='text'&&item.textSize!=='short'))control=`<textarea id="${esc(id)}" rows="3" maxlength="2400" ${attrs}>${esc(saved)}</textarea>`;
    else if(item.type==='date')control=dateControl(id,label,saved,attrs);
    else if(item.type==='choice'&&item.choiceStyle==='chips'){
      const selected=item.multiple?(Array.isArray(builderParse(saved))?builderParse(saved):[]):saved?[saved]:[],choices=[...new Set([...item.options,...selected])];
      control=`<div class="journal-choice-chips iew-builder-choice" role="group" aria-label="${esc(label)}">${choices.map((option,i)=>`<label><input class="sr-only" type="${item.multiple?'checkbox':'radio'}" name="${esc(id)}" value="${esc(option)}" ${attrs} ${selected.includes(option)?'checked':''}><span>${esc(option)}</span></label>`).join('')}</div>`;
    }
    else if(item.type==='choice')control=`<div class="iew-select"><select id="${esc(id)}" ${attrs}><option value="">선택해 주세요</option>${saved&&!item.options.includes(saved)?`<option value="${esc(saved)}" selected>${esc(saved)}</option>`:''}${item.options.map(option=>`<option value="${esc(option)}" ${option===saved?'selected':''}>${esc(option)}</option>`).join('')}</select></div>`;
    else if(item.type==='time'||item.type==='duration'){
      const value=builderParse(saved)||{},time=item.type==='time',parts=time?[['hour','시',1,12],['minute','분',0,59]]:[['hour','시간',0,null],['minute','분',0,59],['second','초',0,59]];
      const period=time?`<div class="iew-select"><select id="${esc(id)}" ${attrs} data-builder-part="period" aria-label="${esc(label)} 오전 또는 오후"><option ${value.period!=='오후'?'selected':''}>오전</option><option ${value.period==='오후'?'selected':''}>오후</option></select></div>`:'';
      control=`<div class="iew-builder-composite ${time?'timefield-parts':'quick-check-duration-row'}">${period}${parts.map(([part,unit,min,max])=>`<label class="quick-check-duration-part"><input type="number" inputmode="numeric" step="1" min="${min}" ${max==null?'':`max="${max}"`} ${attrs} data-builder-part="${part}" aria-label="${esc(label)} ${unit}" value="${esc(value[part]??'')}"><span aria-hidden="true">${unit}</span></label>`).join('')}</div>`;
    }
    else if(item.type==='number')control=`<div class="quick-check-number-control iew-builder-number"><input id="${esc(id)}" type="number" step="any" inputmode="decimal" ${attrs} value="${esc(saved)}">${item.unit?`<span class="quick-check-unit">${esc(item.unit)}</span>`:''}</div>`;
    else if(item.type==='scale'){
      const min=Number.isInteger(item.min)?item.min:1,max=Number.isInteger(item.max)?item.max:5;
      const previous=saved&&(Number(saved)<min||Number(saved)>max)?`<p class="iep-help">기존 값: ${esc(saved)}</p>`:'';
      control=`<div class="quick-check-slider"><div class="quick-check-slider-ticks">${Array.from({length:max-min+1},(_,i)=>`<button type="button" data-iew-action="builder-scale" data-builder-id="${esc(item.id)}" data-builder-value="${min+i}" aria-label="${esc(label)} ${min+i}" aria-pressed="${saved===String(min+i)}">${min+i}</button>`).join('')}</div>${previous}${item.scaleStart||item.scaleEnd?`<div class="quick-check-scale-labels"><span>${esc(item.scaleStart||'')}</span><span>${esc(item.scaleEnd||'')}</span></div>`:''}</div>`;
    }
    else control=`<input id="${esc(id)}" type="text" maxlength="2400" ${attrs} value="${esc(saved)}">`;
    return `<div class="field iep-field iew-builder-item" data-builder-item="custom:${esc(item.id)}">${fieldHeader(id,scope,key,label,false)}${control}<span class="iew-builder-print-value">${esc(builderDisplay(item,saved))}</span></div>`;
  }
  function builderMoveControls(kind,id,label){
    return `<span class="iew-builder-move" draggable="true" data-builder-drag="${kind}" data-builder-id="${esc(id)}" title="끌어서 순서 변경"><button type="button" data-iew-action="builder-move" data-builder-kind="${kind}" data-builder-id="${esc(id)}" data-builder-direction="-1" aria-label="${esc(label)} 위로 이동">↑</button><button type="button" data-iew-action="builder-move" data-builder-kind="${kind}" data-builder-id="${esc(id)}" data-builder-direction="1" aria-label="${esc(label)} 아래로 이동">↓</button></span>`;
  }
  function decorateBuilder(){
    if(section==='records')return;
    const host=section==='document'?$('#iew-document-builder'):$('#iew-content .iew-content')||$('#iew-content');if(!host)return;
    const data=builder();let cards=Array.from(host.children).filter(el=>el.matches('.iep-card'));
    cards.forEach((card,i)=>{const heading=card.querySelector('h2');let part=heading?.dataset.iewStep?'main':heading?.dataset.iewHeadingKey||heading?.textContent.trim()||String(i);if(/^(?:assessment:)?\d+월 관찰/.test(part))part='monthly-observation';card.dataset.builderSection=`builtin:${section}:${part}`;});
    cards=cards.filter(card=>{if(!builderSectionHidden(card.dataset.builderSection))return true;card.remove();return false;});
    for(const item of data.sections.filter(item=>item.step===section&&!item.hidden&&builderAllowed(item))){
      const card=document.createElement('section');card.className='iep-card iew-builder-section';card.dataset.builderSection=`custom:${item.id}`;
      card.innerHTML=`<div class="iep-card-heading"><h2>${esc(item.title)}${formEditing?` <button type="button" class="iew-form-edit-control" data-iew-action="edit-builder-section" data-builder-id="${esc(item.id)}" aria-label="${esc(item.title)} 제목 수정">${editIcon}</button>`:''}</h2>${formEditing?`<button type="button" class="iew-form-edit-control iew-form-delete" data-iew-action="delete-builder-section" data-builder-id="${esc(item.id)}" aria-label="${esc(item.title)} 섹션 삭제">${deleteIcon}</button>`:''}</div><div class="iep-two-col"></div>`;
      host.append(card);cards.push(card);
    }
    const sectionOrder=data.sectionOrder[section]||[],rank=id=>{const n=sectionOrder.indexOf(id);return n<0?Number.MAX_SAFE_INTEGER:n;};
    cards.sort((a,b)=>rank(a.dataset.builderSection)-rank(b.dataset.builderSection));cards.forEach(card=>host.append(card));
    cards.forEach(card=>{
      const id=card.dataset.builderSection;
      const sectionHeading=card.querySelector('h2');card.dataset.builderTitle=sectionHeading?.dataset.iewStep?stepTitle(section):sectionHeading?[...sectionHeading.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim():stepTitle(section);
      let grid=card.querySelector(':scope > .iep-two-col');
      if(!grid){grid=document.createElement('div');grid.className='iep-two-col iew-builder-grid';card.append(grid);}
      const existing=Array.from(grid.children).filter(el=>el.matches('.iep-field,.iew-observation-field'));
      existing.forEach((el,i)=>{const input=el.querySelector('[data-iew-scope][data-iew-key]');el.dataset.builderItem=input?`builtin:${input.dataset.iewScope}:${input.dataset.iewKey}`:`builtin:${id}:${i}`;});
      data.fields.filter(item=>item.sectionId===id&&!fieldHidden('builder',item.id)&&builderAllowed(item)).forEach(item=>grid.insertAdjacentHTML('beforeend',builderFieldHTML(item)));
      const items=Array.from(grid.children).filter(el=>el.dataset.builderItem),order=data.fieldOrder[id]||[],itemRank=key=>{const n=order.indexOf(key);return n<0?Number.MAX_SAFE_INTEGER:n;};
      items.sort((a,b)=>itemRank(a.dataset.builderItem)-itemRank(b.dataset.builderItem));items.forEach(item=>grid.append(item));
      if(formEditing){
        items.forEach(item=>{const header=item.querySelector('.iew-form-label'),label=header?.querySelector('label')?.textContent.trim()||'항목';if(header)header.insertAdjacentHTML('afterbegin',builderMoveControls('field',item.dataset.builderItem,label));});
        const heading=card.querySelector('.iep-card-heading');if(heading&&cards.length>1)heading.insertAdjacentHTML('afterbegin',builderMoveControls('section',id,card.dataset.builderTitle||'섹션'));
        if(heading&&id.startsWith('builtin:')&&!heading.querySelector('[data-iew-step]'))heading.insertAdjacentHTML('beforeend',`<button type="button" class="iew-form-edit-control iew-form-delete iew-stage-delete" data-iew-action="delete-builtin-section" data-builder-section="${esc(id)}" data-builder-title="${esc(card.dataset.builderTitle)}" aria-label="${esc(card.dataset.builderTitle)} 섹션 삭제">${deleteIcon}</button>`);
        card.insertAdjacentHTML('beforeend',`<button type="button" class="iew-builder-add" data-iew-action="add-builder-field" data-builder-section="${esc(id)}" data-builder-title="${esc(card.dataset.builderTitle)}">+ 항목 추가</button>`);
      }
    });
    if(formEditing)host.insertAdjacentHTML('beforeend','<button type="button" class="iew-builder-add iew-builder-add-section" data-iew-action="add-builder-section">+ 섹션 추가</button>');
  }
  const builderTypes=[['choice','선택형','정해 둔 항목 중에서 선택'],['text','텍스트','한 줄 또는 여러 줄 입력'],['time','시각','몇 시인지 입력'],['duration','시간 길이','시간·분·초 입력'],['number','숫자','횟수나 양 입력'],['scale','척도','교사가 정한 단계 선택'],['date','날짜','날짜 선택']];
  function builderSettingsHTML(item={},editing=false){
    const textSize=item.type==='short'?'short':item.type==='long'?'long':item.textSize||'long';
    return `<div class="iew-builder-settings" data-builder-settings="text"><fieldset class="iew-builder-scope"><legend>입력칸 크기</legend><div class="choice-mode quick-check-mode"><label><input class="sr-only" type="radio" name="iew-builder-text-size" value="short" ${textSize==='short'?'checked':''}><span>짧은 글</span></label><label><input class="sr-only" type="radio" name="iew-builder-text-size" value="long" ${textSize==='long'?'checked':''}><span>긴 글</span></label></div></fieldset></div>
      <div class="iew-builder-settings" data-builder-settings="choice"><label><span>선택지</span><textarea id="iew-builder-options" rows="3" placeholder="선택지를 한 줄씩 입력해 주세요">${esc((item.options||[]).join('\n'))}</textarea></label>${editing?'':`<fieldset class="iew-builder-scope"><legend>선택 방식</legend><div class="choice-mode quick-check-mode"><label><input class="sr-only" type="radio" name="iew-builder-choice-mode" value="single" checked><span>하나만 선택</span></label><label><input class="sr-only" type="radio" name="iew-builder-choice-mode" value="multiple"><span>여러 개 선택</span></label></div></fieldset>`}</div>
      <div class="iew-builder-settings" data-builder-settings="number"><label><span>단위</span><input id="iew-builder-unit" maxlength="10" value="${esc(item.unit||'')}"></label></div>
      <div class="iew-builder-settings" data-builder-settings="scale"><div class="iew-builder-scale-settings"><label><span>최솟값</span><input id="iew-builder-min" type="number" step="1" value="${esc(item.min??1)}"></label><label><span>최댓값</span><input id="iew-builder-max" type="number" step="1" value="${esc(item.max??5)}"></label><label><span>낮은 단계 설명</span><input id="iew-builder-scale-start" maxlength="30" value="${esc(item.scaleStart||'')}"></label><label><span>높은 단계 설명</span><input id="iew-builder-scale-end" maxlength="30" value="${esc(item.scaleEnd||'')}"></label></div><p class="iep-help">척도는 2~11단계로 설정해 주세요.</p></div>`;
  }
  function builderSettings(modal,type,minChoices=2){
    const text=type==='short'||type==='long'?'text':type;
    modal.querySelectorAll('[data-builder-settings]').forEach(row=>row.hidden=row.dataset.builderSettings!==text);
    const choices=[...new Set((modal.querySelector('#iew-builder-options')?.value||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean))];
    const minInput=modal.querySelector('#iew-builder-min'),maxInput=modal.querySelector('#iew-builder-max'),min=Number(minInput?.value),max=Number(maxInput?.value);
    return {type:text,textSize:modal.querySelector('[name="iew-builder-text-size"]:checked')?.value||'long',options:choices,multiple:modal.querySelector('[name="iew-builder-choice-mode"]:checked')?.value==='multiple',unit:modal.querySelector('#iew-builder-unit')?.value.trim()||'',min,max,scaleStart:modal.querySelector('#iew-builder-scale-start')?.value.trim()||'',scaleEnd:modal.querySelector('#iew-builder-scale-end')?.value.trim()||'',valid:(text!=='choice'||choices.length>=minChoices)&&(text!=='scale'||(minInput?.value!==''&&maxInput?.value!==''&&Number.isInteger(min)&&Number.isInteger(max)&&max-min>=1&&max-min<=10))};
  }
  function applyBuilderSettings(item,settings){
    if(settings.type==='text'){item.type='text';item.textSize=settings.textSize;}
    if(settings.type==='choice')item.options=settings.options;
    if(settings.type==='number')item.unit=settings.unit;
    if(settings.type==='scale'){item.min=settings.min;item.max=settings.max;item.scaleStart=settings.scaleStart;item.scaleEnd=settings.scaleEnd;}
  }
  function editFormName(kind,key,label,required){
    const field=kind==='fields';
    const customField=field&&key.startsWith('builder:')?builder().fields.find(item=>`builder:${item.id}`===key):null;
    const options=customField?builderSettingsHTML(customField,true):'';
    const html=`<div class="mockup-dialog-fields"><label><span class="sr-only">${field?'항목 이름':'이름'}</span><input id="iew-form-name" maxlength="60" value="${esc(label)}"></label>${options}${field&&!customField?`<p class="iep-help">같은 항목이 다른 단계에 있으면 함께 적용돼요.</p>`:''}</div>`;
    dialog(field?'항목 설정':'이름 수정',html,'저장',()=>{
      const name=document.getElementById('iew-form-name')?.value.trim();
      if(!name){toast('이름을 입력해 주세요.');return;}
      if(customField){const updated=builderSettings(document.getElementById('mockup-dialog'),customField.type,1);if(!updated.valid)return;applyBuilderSettings(customField,updated);}
      const settings=plan.formSettings ||= {};settings[kind] ||= {};
      settings[kind][key]=field?{...settings[kind][key],title:name}:name;
      if(kind==='steps'){const original=stepNames.find(([id])=>id===key)?.[1];if(original&&settings.sections)delete settings.sections[`${key}:${original}`];}
      touch();shell();
    });
    if(customField){const modal=document.getElementById('mockup-dialog'),confirm=modal.querySelector('[data-action="confirm-dialog"]'),name=modal.querySelector('#iew-form-name');const validate=()=>{const settings=builderSettings(modal,customField.type,1);confirm.disabled=!name.value.trim()||!settings.valid;};modal.querySelectorAll('input,textarea').forEach(input=>{input.addEventListener('input',validate);input.addEventListener('change',validate);});validate();}
  }
  function confirmFormDelete(kind,key,label){
    const subject=kind==='steps'?'단계':'항목';
    dialog(`${subject}를 삭제할까요?`,`<p>‘${esc(label)}’ ${subject}이 이 계획의 화면과 산출물에서 제외돼요. 기존 내용은 보관돼요.</p>`,'삭제',()=>{
      const settings=plan.formSettings ||= {};
      if(kind==='steps'){
        const order=orderedSteps(),position=order.indexOf(key);if(position<0||order.length<=1)return;
        (settings.hiddenSteps ||= []).push(key);const remaining=orderedSteps();section=remaining[Math.min(position,remaining.length-1)];
      }else{settings.fields ||= {};settings.fields[key]={...settings.fields[key],hidden:true};}
      touch();shell();toast(`${subject}을 삭제했어요.`);
    },true);
  }
  function scopePicker(){return builderScoped()?`<fieldset class="iew-builder-scope"><legend>적용할 영역</legend><div class="choice-mode quick-check-mode"><label><input class="sr-only" type="radio" name="iew-builder-scope" value="all" checked><span>모든 영역</span></label><label><input class="sr-only" type="radio" name="iew-builder-scope" value="one"><span>${esc(activeDomain()?.name||'현재 영역')}만</span></label></div></fieldset>`:'';}
  function addBuilderSection(){
    const target=section;
    dialog('섹션 추가',`<div class="mockup-dialog-fields"><label><span class="sr-only">섹션 이름</span><input id="iew-builder-name" maxlength="60" placeholder="섹션 이름"></label>${scopePicker()}</div>`,'추가',()=>{
      const title=document.getElementById('iew-builder-name')?.value.trim();if(!title){toast('섹션 이름을 입력해 주세요.');return;}
      const domainId=document.querySelector('[name="iew-builder-scope"]:checked')?.value==='one'?activeDomain()?.id:null;
      builder().sections.push({id:uid(),step:target,title,domainId});touch();shell();
    });
    const modal=document.getElementById('mockup-dialog'),name=modal.querySelector('#iew-builder-name'),confirm=modal.querySelector('[data-action="confirm-dialog"]');
    const validate=()=>{confirm.disabled=!name.value.trim();};name.addEventListener('input',validate);validate();name.focus();
  }
  function addBuilderField(sectionId,sectionTitle){
    const target=section,owner=builder().sections.find(item=>`custom:${item.id}`===sectionId);
    const picker=owner?.domainId?'':scopePicker();
    dialog('항목 추가',`<div class="mockup-dialog-fields"><label><span class="sr-only">항목 이름</span><input id="iew-builder-name" maxlength="60" placeholder="항목 이름"></label><label><span>입력 방식</span><button id="iew-builder-type-button" class="dropdown-trigger iew-builder-type-trigger" type="button" aria-haspopup="dialog"><span>텍스트</span></button><input type="hidden" id="iew-builder-type" value="text"></label>${builderSettingsHTML()}${picker}</div>`,'추가',()=>{
      const title=document.getElementById('iew-builder-name')?.value.trim(),type=document.getElementById('iew-builder-type')?.value||'text',settings=builderSettings(document.getElementById('mockup-dialog'),type);
      if(!title||!settings.valid)return;
      const domainId=owner?.domainId||(document.querySelector('[name="iew-builder-scope"]:checked')?.value==='one'?activeDomain()?.id:null);
      const item={id:uid(),step:target,sectionId,sectionTitle,title,type,options:[],domainId};applyBuilderSettings(item,settings);if(type==='choice'){item.multiple=settings.multiple;item.choiceStyle='chips';}builder().fields.push(item);touch();shell();
    });
    const modal=document.getElementById('mockup-dialog'),name=modal.querySelector('#iew-builder-name'),confirm=modal.querySelector('[data-action="confirm-dialog"]');
    const validate=()=>{const type=modal.querySelector('#iew-builder-type')?.value||'text',settings=builderSettings(modal,type);confirm.disabled=!name.value.trim()||!settings.valid;};
    modal.querySelectorAll('input,textarea').forEach(input=>{input.addEventListener('input',validate);input.addEventListener('change',validate);});modal.querySelector('#iew-builder-type-button').addEventListener('click',()=>{const current=modal.querySelector('#iew-builder-type').value,label=builderTypes.find(type=>type[0]===current)?.[1]||'텍스트';openTypePicker({selected:label,onSelect:selected=>{const type=builderTypes.find(item=>item[1]===selected);if(!type)return;modal.querySelector('#iew-builder-type').value=type[0];modal.querySelector('#iew-builder-type-button span').textContent=selected==='시간 길이'?'소요 시간':selected;validate();}});});validate();name.focus();
  }
  function moveBuilder(button){
    const kind=button.dataset.builderKind,id=button.dataset.builderId,direction=Number(button.dataset.builderDirection),data=builder();
    let items,key,orders;
    if(kind==='section'){const host=button.closest('.iep-card')?.parentElement;items=Array.from(host?.children||[]).filter(el=>el.dataset.builderSection);key=section;orders=data.sectionOrder;}
    else {const grid=button.closest('[data-builder-item]')?.parentElement;items=Array.from(grid?.children||[]).filter(el=>el.dataset.builderItem);key=grid?.closest('[data-builder-section]')?.dataset.builderSection;orders=data.fieldOrder;}
    if(!key)return;const values=items.map(item=>kind==='section'?item.dataset.builderSection:item.dataset.builderItem),index=values.indexOf(id),next=index+direction;if(index<0||next<0||next>=values.length)return;
    [values[index],values[next]]=[values[next],values[index]];orders[key]=values;touch();shell();
    const candidates=$$('[data-iew-action="builder-move"]');candidates.find(item=>item.dataset.builderId===id&&item.dataset.builderDirection===String(direction))?.focus();
  }
  function builderDragStart(e){
    const grip=e.target.closest('[data-builder-drag]');if(!formEditing||!grip)return;
    builderDragging={kind:grip.dataset.builderDrag,id:grip.dataset.builderId};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',builderDragging.id);
  }
  function builderDragOver(e){
    if(!builderDragging)return;const target=e.target.closest(builderDragging.kind==='section'?'[data-builder-section]':'[data-builder-item]');if(!target)return;
    const source=$$('[data-builder-drag]').find(item=>item.dataset.builderDrag===builderDragging.kind&&item.dataset.builderId===builderDragging.id)?.closest(builderDragging.kind==='section'?'[data-builder-section]':'[data-builder-item]');
    if(!source||source===target||source.parentElement!==target.parentElement)return;e.preventDefault();e.dataTransfer.dropEffect='move';
  }
  function builderDrop(e){
    if(!builderDragging)return;const {kind,id}=builderDragging,target=e.target.closest(kind==='section'?'[data-builder-section]':'[data-builder-item]');
    const source=$$('[data-builder-drag]').find(item=>item.dataset.builderDrag===kind&&item.dataset.builderId===id)?.closest(kind==='section'?'[data-builder-section]':'[data-builder-item]');
    builderDragging=null;if(!source||!target||source===target||source.parentElement!==target.parentElement)return;e.preventDefault();
    const parent=source.parentElement,items=Array.from(parent.children).filter(item=>kind==='section'?item.dataset.builderSection:item.dataset.builderItem),values=items.map(item=>kind==='section'?item.dataset.builderSection:item.dataset.builderItem),from=values.indexOf(id),destination=kind==='section'?target.dataset.builderSection:target.dataset.builderItem;
    values.splice(from,1);const after=e.clientY>=target.getBoundingClientRect().top+target.offsetHeight/2;values.splice(values.indexOf(destination)+(after?1:0),0,id);
    const data=builder(),key=kind==='section'?section:parent.closest('[data-builder-section]')?.dataset.builderSection;if(!key)return;(kind==='section'?data.sectionOrder:data.fieldOrder)[key]=values;touch();shell();
  }
  function enhanceSelects(){
    $$('select').forEach((select,i)=>{
      if(!select.id)select.id=`iew-select-${i}`;
      const label=$(`label[for="${select.id}"]`)||select.closest('label');
      const name=label?.childNodes[0]?.textContent.trim()||'항목 선택';
      const wrapper=document.createElement('div');wrapper.className='dropdown iew-custom-dropdown';
      const trigger=document.createElement('button');trigger.type='button';trigger.className='dropdown-trigger';trigger.dataset.options='iep-select';trigger.dataset.iepSelect=select.id;trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',name);
      const text=document.createElement('span');text.textContent=select.selectedOptions[0]?.textContent||'선택해 주세요';trigger.append(text);
      select.before(wrapper);wrapper.append(select,trigger);select.hidden=true;
    });
  }
  function edit(e){
    if(document.body.classList.contains('mockup-editing'))return;
    if(e.target.dataset.iewFilter){filterRecords();return;}
    if(e.target.hasAttribute('data-iew-select-all')){$$('[data-iew-record-type]:not([hidden]) [data-iew-record]').forEach(box=>box.checked=e.target.checked);syncRecordSelection();return;}
    if(e.target.dataset.iewRecord){syncRecordSelection();return;}
    const el=e.target,scope=el.dataset.iewScope,key=el.dataset.iewKey;if(!scope||!key)return;
    if(scope==='builder'){
      const item=builder().fields.find(field=>field.id===key);if(!item)return;const wrapper=el.closest('.iew-builder-item');let value=el.value;
      if(el.dataset.builderPart){const parts=Object.fromEntries(Array.from(wrapper.querySelectorAll('[data-builder-part]'),input=>[input.dataset.builderPart,input.value]));value=Object.entries(parts).some(([part,text])=>part!=='period'&&text!=='')?JSON.stringify(parts):'';}
      else if(item.type==='choice'&&item.choiceStyle==='chips'){const selected=Array.from(wrapper.querySelectorAll('.iew-builder-choice input:checked'),input=>input.value);value=item.multiple?(selected.length?JSON.stringify(selected):''):(selected[0]||'');}
      const values=((plan.builderValues ||= {})[key] ||= {}),slot=builderSlot(item.step);if((values[slot]||'')===value)return;values[slot]=value;const print=wrapper?.querySelector('.iew-builder-print-value');if(print)print.textContent=builderDisplay(item,value);touch();return;
    }
    const d=activeDomain(),g=activeGoal();let object;
    if(scope==='domain')object=d;else if(scope==='goal')object=g;else if(scope.startsWith('custom:'))object=plan.customSteps?.find(item=>item.id===el.dataset.iewStep);else if(scope==='personal'||scope==='support'||scope==='meeting')object=plan[scope];
    else if(scope==='month'){g.months ||= {};object=g.months[month] ||= {};}
    else if(scope==='observation'){
      object=g.observations.find(item=>item.id===el.dataset.iewObservation);
      if(!object&&el.value.trim()){
        const state=observationState(g),draft=state.drafts.find(item=>item.id===el.dataset.iewObservation);
        if(draft){const position=state.order.indexOf(draft.id),savedBefore=state.order.slice(0,position).filter(id=>g.observations.some(item=>item.id===id)).length;object=draft;g.observations.splice(savedBefore,0,draft);state.drafts=state.drafts.filter(item=>item!==draft);const remove=$$('[data-iew-action="remove-observation"]').find(button=>button.dataset.iewId===draft.id);if(remove)remove.hidden=false;}
      }
    }
    if(!object)return;
    if(scope==='personal'&&key==='birth'&&/^\d{8}$/.test(el.value))el.value=el.value.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
    object[key]=el.value;
    if(scope==='goal'&&key==='text'){$$('.iew-goal-tab').find(button=>button.dataset.iewId===g.id)?.replaceChildren(document.createTextNode(g.text.trim()||`목표 ${d.goals.indexOf(g)+1}`));}
    touch();
  }
  function change(e){
    if(e.target.dataset.iewScope==='builder'&&['radio','checkbox'].includes(e.target.type)){edit(e);return;}
    if(e.target.dataset.iewAssignMonth){const g=activeGoal(),item=g?.observations.find(row=>row.id===e.target.dataset.iewAssignMonth),selected=Number(e.target.value);if(item&&months().includes(selected)){item.month=selected;observationDrafts.delete(`${g.id}:${selected}`);touch();shell();}return;}
    if(e.target.dataset.iewFilter){filterRecords();return;}
    const kind=e.target.dataset.iewSwitch;if(!kind)return;
    if(kind==='month'){month=Number(e.target.value);shell();return;}
    const year=kind==='year'?Number(e.target.value):plan.year,term=kind==='term'?Number(e.target.value):plan.term;
    if(Number.isInteger(year)&&year>=1900&&year<=2100&&[1,2].includes(term)){choose(year,term);shell();}
  }
  function filterRecords(){
    const kind=$('[data-iew-filter="type"]')?.value||'all',query=($('[data-iew-filter="query"]')?.value||'').trim().toLocaleLowerCase();
    $$('[data-iew-record-type]').forEach(card=>{card.hidden=(kind!=='all'&&card.dataset.iewRecordType!==kind)||!!query&&!card.textContent.toLocaleLowerCase().includes(query);});
    const empty=$('[data-iew-no-results]');if(empty)empty.hidden=$$('[data-iew-record-type]:not([hidden])').length>0;
    syncRecordSelection();
  }
  function syncRecordSelection(){
    const checked=$$('[data-iew-record]:checked').length,visible=$$('[data-iew-record-type]:not([hidden]) [data-iew-record]'),selected=visible.filter(box=>box.checked).length;
    $$('[data-iew-selected-count]').forEach(count=>count.textContent=String(checked));
    const note=$('[data-iew-hidden-selection]');if(note)note.hidden=checked===selected;
    const button=$('[data-iew-action="attach"]');if(button)button.disabled=!checked;
    const all=$('[data-iew-select-all]');if(all){all.checked=visible.length>0&&selected===visible.length;all.indeterminate=selected>0&&selected<visible.length;all.disabled=!visible.length;}
  }
  function moveStep(id,target,after=false){
    const order=orderedSteps(),from=order.indexOf(id),to=order.indexOf(target);
    if(from<0||to<0||from===to)return false;
    order.splice(from,1);const destination=order.indexOf(target)+(after?1:0);order.splice(destination,0,id);
    if(order.every((value,i)=>value===orderedSteps()[i]))return false;
    (plan.formSettings ||= {}).stepOrder=order;touch();shell();return true;
  }
  function startStepDrag(e){
    const button=e.target.closest('.iew-tabs [data-iew-action="section"]');
    if(!formEditing||!button)return;
    draggedStep=button.dataset.iewId;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedStep);button.classList.add('iew-step-dragging');
  }
  function stopStepScroll(){if(dragScrollTimer)clearInterval(dragScrollTimer);dragScrollTimer=null;dragScrollDirection=0;}
  function overStep(e){
    const bar=e.target.closest('.iew-tabs');
    if(!formEditing||!draggedStep||!bar){stopStepScroll();return;}
    e.preventDefault();const rect=bar.getBoundingClientRect(),direction=e.clientX<rect.left+40?-1:e.clientX>rect.right-40?1:0;
    if(direction!==dragScrollDirection){stopStepScroll();dragScrollDirection=direction;if(direction)dragScrollTimer=setInterval(()=>{if(bar.isConnected)bar.scrollLeft+=direction*12;else stopStepScroll();},30);}
    const button=e.target.closest('.iew-tabs [data-iew-action="section"]');
    if(!button||button.dataset.iewId===draggedStep)return;
    e.dataTransfer.dropEffect='move';
    $$('.iew-step-drop-before,.iew-step-drop-after').forEach(item=>item.classList.remove('iew-step-drop-before','iew-step-drop-after'));
    button.classList.add(e.clientX<button.getBoundingClientRect().left+button.offsetWidth/2?'iew-step-drop-before':'iew-step-drop-after');
  }
  function dropStep(e){
    stopStepScroll();
    const button=e.target.closest('.iew-tabs [data-iew-action="section"]');
    if(!formEditing||!draggedStep||!button)return;
    e.preventDefault();const id=draggedStep;draggedStep=null;moveStep(id,button.dataset.iewId,e.clientX>=button.getBoundingClientRect().left+button.offsetWidth/2);
    $$('.iew-step-dragging,.iew-step-drop-before,.iew-step-drop-after').forEach(item=>item.classList.remove('iew-step-dragging','iew-step-drop-before','iew-step-drop-after'));
  }
  function stepKeydown(e){
    const button=e.target.closest('.iew-tabs [data-iew-action="section"]');
    if(!formEditing||!button||!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key))return;
    const order=orderedSteps(),id=button.dataset.iewId,i=order.indexOf(id),next=order[i+(e.key==='ArrowLeft'?-1:1)];
    if(!next)return;e.preventDefault();if(moveStep(id,next,e.key==='ArrowRight')){$$('.iew-tabs [data-iew-action="section"]').find(item=>item.dataset.iewId===id)?.focus();toast('단계 순서를 바꿨어요.');}
  }
  async function click(e){
    if(document.body.classList.contains('mockup-editing'))return;
    const button=e.target.closest('[data-iew-action]');if(!button)return;
    const action=button.dataset.iewAction,id=button.dataset.iewId,d=activeDomain(),g=activeGoal();
    if(action==='toggle-form-edit'){formEditing=!formEditing;shell();}
    else if(action==='builder-scale'){const item=builder().fields.find(field=>field.id===button.dataset.builderId);if(item){const key=builderSlot(item.step),values=(plan.builderValues[item.id] ||= {}),value=button.dataset.builderValue;values[key]=values[key]===value?'':value;touch();shell();}}
    else if(action==='add-builder-section'&&formEditing)addBuilderSection();
    else if(action==='add-builder-field'&&formEditing)addBuilderField(button.dataset.builderSection,button.dataset.builderTitle);
    else if(action==='builder-move'&&formEditing)moveBuilder(button);
    else if(action==='edit-builder-section'&&formEditing){const item=builder().sections.find(item=>item.id===button.dataset.builderId);if(item)dialog('이름 수정',`<div class="mockup-dialog-fields"><label><span class="sr-only">이름</span><input id="iew-builder-name" maxlength="60" value="${esc(item.title)}"></label></div>`,'저장',()=>{const title=document.getElementById('iew-builder-name')?.value.trim();if(!title){toast('이름을 입력해 주세요.');return;}item.title=title;touch();shell();});}
    else if(action==='delete-builder-section'&&formEditing){const item=builder().sections.find(item=>item.id===button.dataset.builderId);if(item)dialog('섹션을 삭제할까요?',`<p>‘${esc(item.title)}’ 섹션과 항목이 화면과 산출물에서 제외돼요. 기존 내용은 보관돼요.</p>`,'삭제',()=>{item.hidden=true;touch();shell();},true);}
    else if(action==='delete-builtin-section'&&formEditing){const id=button.dataset.builderSection,title=button.dataset.builderTitle;dialog('섹션을 삭제할까요?',`<p>‘${esc(title)}’ 섹션과 항목이 화면과 산출물에서 제외돼요. 기존 내용은 보관돼요.</p>`,'삭제',()=>{if(!builder().hiddenSections.includes(id))builder().hiddenSections.push(id);touch();shell();},true);}
    else if(action==='scroll-steps'){$('.iew-tabs')?.scrollBy({left:Number(button.dataset.iewDirection)*260,behavior:'smooth'});}
    else if(action==='add-step'){
      if(!formEditing)return;
      dialog('단계 추가','<div class="mockup-dialog-fields"><label><span class="sr-only">단계 이름</span><input id="iew-new-step-name" maxlength="60" placeholder="단계 이름"></label></div>','추가',()=>{
        const name=document.getElementById('iew-new-step-name')?.value.trim();if(!name){toast('단계 이름을 입력해 주세요.');return;}
        const order=orderedSteps(),item={id:`custom-${uid()}`,name,content:''};(plan.customSteps ||= []).push(item);(plan.formSettings ||= {}).stepOrder=[...order,item.id];section=item.id;touch();shell();
      });
    }
    else if(action==='edit-step'){
      if(button.dataset.iewStep&&button.dataset.iewStep!=='document')editFormName('steps',button.dataset.iewStep,button.dataset.iewLabel);
    }
    else if(action==='edit-heading')editFormName('sections',button.dataset.iewKey,button.dataset.iewLabel);
    else if(action==='edit-field')editFormName('fields',`${button.dataset.iewScope}:${button.dataset.iewKey}`,button.dataset.iewLabel,button.dataset.iewRequired==='true');
    else if(action==='delete-field'&&formEditing)confirmFormDelete('fields',`${button.dataset.iewScope}:${button.dataset.iewKey}`,button.dataset.iewLabel);
    else if(action==='delete-step'&&formEditing&&!button.disabled&&button.dataset.iewStep!=='document')confirmFormDelete('steps',button.dataset.iewStep,button.dataset.iewLabel);
    else if(action==='section'){if(id==='records'&&section!=='records')recordsFrom=section;section=id;shell();}
    else if(action==='review-missing'){
      const selectedDomain=button.dataset.iewDomain?plan.domains.find(item=>item.id===button.dataset.iewDomain):activeDomain();if(!selectedDomain)return;
      domainId=selectedDomain.id;goalId=selectedDomain.goals.find(item=>item.id===button.dataset.iewGoal)?.id||selectedDomain.goals[0]?.id;section=button.dataset.iewSection;
      const observation=activeGoal()?.observations.find(item=>button.dataset.iewFocus===`iew-observation-behavior-${item.id}`);if(months().includes(Number(observation?.month)))month=Number(observation.month);shell();
      document.getElementById(button.dataset.iewFocus)?.focus();
    }
    else if(action==='toggle-report'){
      const card=button.closest('.iew-report-domain'),collapsed=card.classList.toggle('is-collapsed');
      button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',`${card.querySelector('h2').textContent} 내용 ${collapsed?'펼치기':'접기'}`);button.innerHTML=`${collapsed?'펼치기':'접기'} <span aria-hidden="true">${collapsed?'⌄':'⌃'}</span>`;
    }
    else if(action==='domain'){domainId=id;goalId=activeDomain()?.goals[0]?.id;shell();}
    else if(action==='goal'){goalId=id;shell();}
    else if(action==='add-goal'){if(d.goals.length>=goalLimit){toast(`영역별 단기목표는 최대 ${goalLimit}개예요.`);return;}const item=goal();d.goals.push(item);goalId=item.id;touch();shell();$('#iew-goal-text')?.focus();}
    else if(action==='add-domain'){
      if(plan.domains.length>=domainLimit){toast(`영역은 최대 ${domainLimit}개까지 추가할 수 있어요.`);return;}
      dialog('영역 추가',`<div class="mockup-dialog-fields"><label><span class="sr-only">영역 이름</span><input id="iew-domain-name" maxlength="40" placeholder="영역 이름"></label></div>`,'추가',()=>{
        const name=document.getElementById('iew-domain-name')?.value.trim();if(!name)return;
        const item=domain(name);plan.domains.push(item);domainId=item.id;goalId=item.goals[0].id;touch();shell();
      });
      const modal=document.getElementById('mockup-dialog'),name=modal.querySelector('#iew-domain-name'),confirm=modal.querySelector('[data-action="confirm-dialog"]');
      const validate=()=>{confirm.disabled=!name.value.trim();};name.addEventListener('input',validate);validate();name.focus();
    }
    else if(action==='rename-domain'){
      const target=plan.domains.find(item=>item.id===id);if(!target)return;
      dialog('영역 이름 수정',`<div class="mockup-dialog-fields"><label><span class="sr-only">영역 이름</span><input id="iew-domain-name" maxlength="40" value="${esc(target.name)}"></label></div>`,'저장',()=>{const name=document.getElementById('iew-domain-name')?.value.trim();if(!name){toast('영역 이름을 입력해 주세요.');return;}target.name=name;touch();shell();});
    }
    else if(action==='remove-domain'){
      const target=plan.domains.find(item=>item.id===id);if(!target)return;
      if(plan.domains.length<=1){toast('영역을 하나 이상 남겨 주세요.');return;}
      dialog('영역을 삭제할까요?',`<p>${esc(target.name)}의 목표와 관찰도 함께 삭제돼요. 연결한 기록은 계획 전체에 남아요.</p>`,'삭제',()=>{plan.references.forEach(ref=>{if(ref.domainId===target.id){delete ref.domainId;delete ref.goalId;}});plan.domains=plan.domains.filter(item=>item!==target);if(domainId===target.id){domainId=plan.domains[0].id;goalId=plan.domains[0].goals[0]?.id;}touch();shell();},true);
    }
    else if(action==='remove-goal'){
      if(d.goals.length===1){toast('단기목표를 하나 이상 남겨 주세요.');return;}
      dialog('목표를 삭제할까요?','<p>이 목표의 관찰 기록도 함께 삭제돼요. 연결한 기록은 계획 전체에 남아요.</p>','삭제',()=>{const removedIndex=d.goals.indexOf(g);plan.references.forEach(ref=>{if(ref.goalId===g.id){delete ref.domainId;delete ref.goalId;}});d.goals=d.goals.filter(item=>item!==g);goalId=d.goals[Math.min(removedIndex,d.goals.length-1)].id;touch();shell();},true);
    }
    else if(action==='add-observation'){const state=observationState(g),draft=newObservation();state.drafts.push(draft);state.order.push(draft.id);shell();}
    else if(action==='remove-observation'){
      const state=observationState(g),draft=state.drafts.find(item=>item.id===id);
      if(draft){state.drafts=state.drafts.filter(item=>item!==draft);state.order=state.order.filter(item=>item!==id);shell();}
      else dialog('관찰을 삭제할까요?','<p>이 목표에 작성한 관찰 기록이 삭제돼요.</p>','삭제',()=>{g.observations=g.observations.filter(item=>item.id!==id);state.order=state.order.filter(item=>item!==id);touch();shell();},true);
    }
    else if(action==='attach'){
      const keys=$$('[data-iew-record]:checked').map(el=>el.dataset.iewRecord),available=records(),target=$('#iew-reference-target')?.value;
      if(!keys.length){toast('연결할 기록을 선택해 주세요.');return;}
      const selected=keys.map(key=>available.find(item=>item.key===key)).filter(Boolean);
      if(selected.length!==keys.length){toast('기록이 바뀌었어요. 다시 확인해 주세요.');shell();return;}
      let added=0;for(const item of selected)if(!plan.references.some(ref=>ref.kind==='report'&&ref.key===item.key)){plan.references.push({id:uid(),key:item.key,kind:item.kind,title:item.title,fingerprint:item.fingerprint,...(target==='goal'?{domainId:d.id,goalId:g.id}:{})});added++;}
      if(!added){toast('이미 연결된 리포트예요.');return;}
      touch();shell();toast('선택한 기록을 연결했어요.');
    }
    else if(action==='detach'){plan.references=plan.references.filter(ref=>ref.id!==id);touch();shell();toast('기록 연결을 해제했어요.');}
    else if(action==='save')await saveSemester();
    else if(action==='copy-domain'){const item=plan.domains.find(domain=>domain.id===id),body=button.closest('.iew-report-domain')?.querySelector('.iew-report-body');if(!item||!body)return;const lines=[item.name,...Array.from(body.querySelectorAll('h3,.iew-report-rows>div'),node=>node.matches('h3')?node.textContent.trim():`${node.querySelector('dt')?.textContent.trim()}: ${node.querySelector('dd')?.textContent.trim()}`)];try{await navigator.clipboard.writeText(lines.join('\n'));toast('영역 내용을 복사했어요.');}catch{toast('복사하지 못했어요. 내용을 직접 선택해 주세요.');}}
    else if(action==='download'){
      const content=$('#iew-content').cloneNode(true);
      content.querySelectorAll('#iew-document-builder [data-builder-item^="custom:"]').forEach(node=>{const id=node.dataset.builderItem.slice(7),item=builder().fields.find(field=>field.id===id),value=item?builderDisplay(item,builderValue(item)):'';if(!item||!value){node.remove();return;}const dl=document.createElement('dl'),row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dl.className='iew-report-rows';dt.textContent=fieldTitle('builder',id,item.title);dd.textContent=value;row.append(dt,dd);dl.append(row);node.replaceWith(dl);});
      content.querySelectorAll('button,.iew-download-hint,.iew-review-summary,.iew-report-link').forEach(el=>el.remove());content.querySelectorAll('.is-collapsed').forEach(el=>el.classList.remove('is-collapsed'));
      const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>IEP 계획서</title><style>body{font:16px/1.7 sans-serif;max-width:900px;margin:40px auto;padding:0 20px}section{margin:28px 0}h2{font-size:20px}h3{font-size:16px;margin:24px 0 8px}.iew-report-rows{margin:0}.iew-report-rows>div{display:grid;grid-template-columns:160px 1fr;gap:16px;padding:10px 0;border-bottom:1px solid #ddd}dt{font-weight:600}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.iew-report-empty,.iep-help{color:#666}@media(max-width:540px){.iew-report-rows>div{grid-template-columns:1fr;gap:2px}}</style></head><body>${content.innerHTML}</body></html>`;
      const url=URL.createObjectURL(new Blob(['\ufeff'+html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`케어릿-IEP-${plan.year}-${plan.term}학기.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('계획서를 내려받았어요.');
    }
    else if(action==='print')window.print();
  }
  function proposeFormChange(request){
    if(!root?.isConnected||!plan||!/바꿔|바꾸|변경|수정|추가/.test(request))return null;
    const changes=[],escapePattern=text=>Array.from(text,ch=>'.*+?^${}()|[]\\'.includes(ch)?String.fromCharCode(92)+ch:ch).join('');
    if(/추가/.test(request)){
      for(const id of orderedSteps()){
        if(id==='document')continue;
        const name=stepTitle(id),match=request.match(new RegExp(escapePattern(name)+'(?:\\s*단계)?(?:에|에다|에다가)\\s+(.+?)\\s*(?:항목)?(?:을|를)?\\s*추가'));
        if(!match)continue;
        let title=match[1].replace(/(?:항목)?(?:을|를)\s*$/,'').trim();
        const scoped=['current','plan','assessment'].includes(id),one=/현재\s*영역/.test(request),all=/모든\s*영역/.test(request);
        if(scoped&&!one&&!all)return {error:'모든 영역에 추가할지 현재 영역에만 추가할지 알려 주세요.'};
        if(scoped&&one&&id!==section)return {error:'현재 영역에 추가하려면 해당 단계를 먼저 열어 주세요.'};
        title=title.replace(/^(?:모든|현재)\s*영역(?:에|의)?\s*/,'').trim();
        if(!title||title.length>60)return {error:'추가할 항목 이름을 알려 주세요.'};
        if(/선택형|선택지/.test(request))return {error:'선택 항목은 양식 편집에서 선택지를 함께 입력해 주세요.'};
        const type=/날짜|생년월일/.test(title)?'date':/긴\s*글/.test(request)?'long':'short';
        changes.push({kind:'add-field',key:id,before:name,after:title,type,domainId:one?activeDomain()?.id:null});break;
      }
    }
    const step=request.match(/(\d+)\s*(?:번|단계)(?:\s*(?:단계|탭))?\s*(?:이름|제목)?(?:을|를)?\s*["'“]?([^"'”,，\n]{1,60}?)["'”]?\s*(?:으로|로)\s*(?:바꿔|바꾸|변경|수정)/);
    if(step){const id=orderedSteps()[Number(step[1])-1],title=step[2].trim();if(id==='document')return {error:'종합보고서·내보내기 단계의 이름은 변경할 수 없어요.'};if(id&&title&&title.length<=60)changes.push({kind:'steps',key:id,before:stepTitle(id),after:title});}
    const fieldDefs=[
      ...personalFields.map(([key,label])=>['personal',key,label]),...placementFields.map(([key,label])=>['support',key,label]),...supportFields.map(([key,label])=>['support',key,label]),...meetingFields.map(([key,label])=>['meeting',key,label]),
      ['domain','strength','강점'],['domain','needs','지도점'],['domain','longGoal','장기목적'],['domain','cumulative','영역별 누가기록'],['domain','semesterEvaluation','학기말 평가 보고'],
      ['goal','text','단기목표'],['goal','criterion','평가 기준'],['goal','evaluation','평가 방법'],['goal','period','평가 기간'],
      ['month','goal','월 목표'],['month','plan','월 실행계획'],['month','evaluation','월 평가'],
      ['observation','situation','어떤 상황이었나요?'],['observation','behavior','실제 행동'],['observation','support','제공한 도움'],['observation','evidence','근거 또는 메모']
    ];
    for(const [scope,key,original] of fieldDefs){
      const label=fieldTitle(scope,key,original);if(!label)continue;
      const prefix=escapePattern(label)+"[\\s\"'“”]*(?:을|를|은|는)?\\s*";
      const rename=request.match(new RegExp(prefix+'(?:이름(?:을|를)?\\s*)?[\"\'“]?([^\"\'”,，\\n]{1,60}?)[\"\'”]?\\s*(?:으로|로)\\s*(?:바꿔|바꾸|변경|수정)'));
      const title=rename?.[1]?.trim();
      if(title&&title!=='필수'&&title!=='선택')changes.push({kind:'fields',key:`${scope}:${key}`,before:label,after:title});
    }
    for(const d of plan.domains){
      const match=request.match(new RegExp(escapePattern(d.name)+'\\s*영역(?:의)?\\s*(?:이름)?(?:을|를)?\\s*[\"\'“]?([^\"\'”,，\\n]{1,40}?)[\"\'”]?\\s*(?:으로|로)\\s*(?:바꿔|바꾸|변경|수정)'));
      if(match?.[1]?.trim())changes.push({kind:'domain',key:d.id,before:d.name,after:match[1].trim()});
    }
    $$('[data-iew-heading-key], [data-iew-heading-step]').forEach(heading=>{
      const id=heading.dataset.iewHeadingStep;
      const label=id?stepTitle(id):[...heading.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim();
      if(!label)return;
      const match=request.match(new RegExp(escapePattern(label)+'\\s*(?:제목|이름)(?:을|를)?\\s*[\"\'“]?([^\"\'”,，\\n]{1,60}?)[\"\'”]?\\s*(?:으로|로)\\s*(?:바꿔|바꾸|변경|수정)'));
      if(match?.[1]?.trim()&&!changes.some(item=>id&&item.kind==='steps'&&item.key===id))changes.push({kind:id?'steps':'sections',key:id||heading.dataset.iewHeadingKey,before:label,after:match[1].trim()});
    });
    if(!changes.length)return null;
    const unique=new Set(changes.map(item=>`${item.kind}:${item.key}`));
    if(unique.size!==changes.length||changes.some((item,i)=>changes.some((other,j)=>i!==j&&item.kind==='fields'&&other.kind==='fields'&&item.before===other.before&&item.key!==other.key)))return {error:'같은 이름의 항목이 여러 개예요. 변경할 단계를 포함해서 다시 알려 주세요.'};
    return {id:uid(),planId:plan.id,revision:plan.revision,changes};
  }
  function applyFormProposal(proposal){
    if(!root?.isConnected||!proposal||plan.id!==proposal.planId||plan.revision!==proposal.revision)return false;
    if(proposal.changes.some(item=>!item.after||item.after.length>60||(item.kind==='steps'&&item.key==='document')||(item.kind==='domain'&&!plan.domains.some(d=>d.id===item.key))))return false;
    const settings=plan.formSettings ||= {};
    for(const item of proposal.changes){
      if(item.kind==='domain')plan.domains.find(d=>d.id===item.key).name=item.after;
      else if(item.kind==='add-field'){if(!orderedSteps().includes(item.key))return false;builder().fields.push({id:uid(),step:item.key,sectionId:`builtin:${item.key}:main`,sectionTitle:stepTitle(item.key),title:item.after,type:item.type,options:[],domainId:item.domainId||null});}
      else {settings[item.kind] ||= {};settings[item.kind][item.key]=item.kind==='fields'?{...settings[item.kind][item.key],title:item.after}:item.after;}
    }
    touch();shell();return true;
  }
  return {
    mount(element,recipient){root=element;index=recipient;const date=currentDate().split('-').map(Number),term=date[1]>=3&&date[1]<=8?1:2,year=date[1]<=2?date[0]-1:date[0],selected=state.iep.selectedSemester?.[index];choose(selected?.year||year,selected?.term||term);section=orderedSteps()[0];recordsFrom=section;root.addEventListener('input',edit);root.addEventListener('change',change);root.addEventListener('click',click);root.addEventListener('dragstart',startStepDrag);root.addEventListener('dragstart',builderDragStart);root.addEventListener('dragover',overStep);root.addEventListener('dragover',builderDragOver);root.addEventListener('drop',dropStep);root.addEventListener('drop',builderDrop);root.addEventListener('dragend',()=>{stopStepScroll();draggedStep=null;builderDragging=null;$$('.iew-step-dragging,.iew-step-drop-before,.iew-step-drop-after').forEach(item=>item.classList.remove('iew-step-dragging','iew-step-drop-before','iew-step-drop-after'));});root.addEventListener('keydown',stepKeydown);shell();},
    isDirty(){return isDirty();},
    save(){return saveSemester();},
    proposeFormChange,
    applyFormProposal,
    assistanceContext(){
      if(!root?.isConnected||!['placement','services','current','plan','assessment'].includes(section))return null;
      const d=activeDomain(),g=activeGoal(),available=section==='current'||section==='plan'?records():[];
      const refs=section==='current'||section==='plan'?plan.references.filter(ref=>ref.kind==='report'&&(!ref.domainId||ref.domainId===d?.id)&&(!ref.goalId||ref.goalId===g?.id)):[];
      const sources=refs.map(ref=>{const item=available.find(row=>row.key===ref.key);return item&&item.fingerprint===ref.fingerprint?{title:item.title,summary:(item.summary||'').slice(0,500),summaryTruncated:(item.summary||'').length>500}:null;}).filter(Boolean);
      const visible=(scope,object)=>Object.fromEntries(Object.entries(object||{}).filter(([key])=>!fieldHidden(scope,key)));
      const support=visible('support',plan.support),steps=orderedSteps();
      for(const [key] of placementFields)if(!steps.includes('placement'))delete support[key];
      for(const [key] of supportFields)if(!steps.includes('services'))delete support[key];
      const domain=d?visible('domain',{name:d.name,strength:d.strength,needs:d.needs,current:d.current,longGoal:d.longGoal}):null;
      if(domain&&!steps.includes('current')){delete domain.strength;delete domain.needs;delete domain.current;}
      if(domain&&!steps.includes('plan'))delete domain.longGoal;
      const goal=g?visible('goal',{text:g.text,period:g.period,supportLevel:g.supportLevel,criterion:g.criterion,activity:g.activity,method:g.method,evaluation:g.evaluation}):null;
      if(goal&&!steps.includes('plan')){delete goal.text;delete goal.supportLevel;delete goal.activity;delete goal.method;}
      if(goal&&(!steps.includes('plan')||builderSectionHidden('builtin:plan:plan:단기목표'))){delete goal.text;delete goal.supportLevel;}
      if(goal&&(!steps.includes('assessment')||builderSectionHidden('builtin:assessment:assessment:평가 계획'))){delete goal.period;delete goal.evaluation;}
      if(goal&&builderSectionHidden('builtin:plan:plan:단기목표')&&builderSectionHidden('builtin:assessment:assessment:평가 계획'))delete goal.criterion;
      const added=builder().fields.filter(item=>steps.includes(item.step)&&!builderSectionHidden(item.sectionId)&&!fieldHidden('builder',item.id)&&builderAllowed(item)&&!builder().sections.find(owner=>`custom:${owner.id}`===item.sectionId)?.hidden).map(item=>({step:stepTitle(item.step),section:builderSectionTitle(item),name:fieldTitle('builder',item.id,item.title),value:builderDisplay(item,builderValue(item))}));
      return {selection:`${plan.id}:${section}:${d?.id||''}:${g?.id||''}`,revision:plan.revision,section,year:plan.year,term:plan.term,
        personal:section==='assessment'||!steps.includes('personal')?{}:visible('personal',plan.personal),support:section==='assessment'?{}:support,domain,goal,addedFields:added,
        sources:sources.slice(0,26),omittedSources:Math.max(0,sources.length-26),unavailableSources:refs.length-sources.length};
    },
    aiContext(kind){
      if(!root?.isConnected||section!=='plan')return null;
      const d=activeDomain(),g=activeGoal(),target={goal:'iew-goal-text',activity:'iew-activity',evaluation:'iew-evaluation',education:'iew-activity'}[kind],control=document.getElementById(target);
      if(!control||!d||!g)return null;
      const targets=kind==='education'?['iew-activity','iew-method','iew-evaluation']:null;
      if(targets?.some(id=>!document.getElementById(id)))return null;
      const available=records(),seen=new Set(),sources=plan.references.filter(ref=>ref.kind==='report'&&(!ref.goalId||ref.goalId===g.id)).map(ref=>{const record=available.find(item=>item.key===ref.key);if(!record||record.fingerprint!==ref.fingerprint||seen.has(ref.key))return null;seen.add(ref.key);return {kind:record.kind,title:record.title,text:(record.summary||'').slice(0,500)};}).filter(Boolean);
      return {draftId:`${plan.id}:${d.id}:${g.id}`,recipient:index,target,original:control.value,...(targets?{targets,originals:targets.map(id=>document.getElementById(id).value)}:{}),observation:orderedSteps().includes('current')?(d.current||''):'',goal:fieldHidden('goal','text')||builderSectionHidden('builtin:plan:plan:단기목표')?'':g.text,month:`${plan.year}-${plan.term}`,sources};
    }
  };
}
