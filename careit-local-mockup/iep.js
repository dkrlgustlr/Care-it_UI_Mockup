/* IEP 실행 계획 목업. 법령·고시의 구성 원칙 + 교사 입력 + 자체 작성 규칙을 사용합니다.
 * 모델 호출, 웹 검색, 기존 일지 분석은 하지 않습니다. */
'use strict';
function createCareitIEP({state,persist,toast,dialog,escapeHTML:esc,registerEdits,ageBands}) {
  const $=(s,r=root)=>r.querySelector(s);
  const $$=(s,r=root)=>[...r.querySelectorAll(s)];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const INPUT_FIELDS={semesterGoal:'semesterGoal',monthGoal:'monthGoal',baseline:'observation',strength:'strength',familyRequest:'familyRequest',participationNeeds:'participationNeeds'};
  // 계획 구성에 사용할 입력을 명시적으로 제한합니다. 대상 구분명·기존 메모·일지 원문은 읽지 않습니다.
  const PLANNING_LABELS={ageBand:'연령대',semesterGoal:'기존 IEP 목표',monthGoal:'월 목표',observation:'목표 관련 관찰',strength:'흥미와 강점',familyRequest:'보호자의 교육적 요청',participationNeeds:'활동 참여·안전 지원'};
  const OPTIONAL_CONTEXT_FIELDS=['familyRequest','participationNeeds'];
  const REQUIRED_FIELDS=['baseline','monthGoal','activity','content','support','evaluationMethod','criterion'];
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
  let root,index=0,view='form',documentView=false,savedPlanId=null;
  state.iep ||= {drafts:{},plans:[]};
  state.iep.savedDrafts ||= {};
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
    if(!ageBands.includes(result.ageBand))result.ageBand='';
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
  const fmt=date=>date?date.replaceAll('-','.'):'날짜 선택';
  const period=r=>r.from&&r.to?`${fmt(r.from)} ~ ${fmt(r.to)}`:'날짜 선택';
  const labelHTML=label=>esc(label.replace(' · 선택',' (선택)')).replace(/ \(선택\)$/, ' <span class="iep-optional">(선택)</span>');
  function field(key,label,{required=false,rows=3,placeholder='',help=''}={}) {
    const id=`iep-${key}`;
    return `<div class="field iep-field"><label for="${id}">${labelHTML(label)}${required?'<span class="iep-required"> (필수)</span>':''}</label><textarea id="${id}" name="${key}" rows="${rows}" maxlength="1200" ${required?'required':''} ${help?`aria-describedby="${id}-help"`:''} placeholder="${esc(placeholder)}">${esc(draft().input[key])}</textarea>${help?`<p id="${id}-help" class="iep-help">${help}</p>`:''}</div>`;
  }
  function rangeField(key,label) {return `<div class="field iep-field"><span id="iep-${key}-label">${label}</span><div class="datefield"><button type="button" class="datefield-trigger" data-action="date" data-date-range="iep-${key}" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="iep-${key}-label iep-${key}-value"><span id="iep-${key}-value">${period(draft().input[key])}</span>${calendar}</button></div></div>`;}
  function shell() {
    const count=state.iep.plans.filter(p=>p.recipient===index).length;
    root.innerHTML=`<header class="page-header"><div class="iep-title"><h1>IEP</h1><span class="workflow-badge">월간 실행 계획</span></div><button type="button" class="button secondary" data-iep-action="new">새 계획</button></header>
      <div class="iep-tabs-row"><div class="record-tabs" aria-label="IEP 화면"><button type="button" data-iep-action="workspace" aria-pressed="${!inSavedTab()}">계획 작성</button><button type="button" data-iep-action="saved" aria-pressed="${inSavedTab()}">저장한 계획 <span>${count}</span></button></div></div>
      <section class="iep-card iep-recipient-bar ${view==='saved'?'':'iep-recipient-bar--period'}" aria-label="IEP 대상 및 기간"><div class="field iep-field"><span>관리대상</span><div class="dropdown"><button type="button" class="dropdown-trigger" data-options="recipients" aria-label="관리대상" aria-haspopup="listbox" aria-expanded="false"><span>${esc(state.recipients[index].name)}</span></button></div></div><div class="field iep-field"><span id="iep-age-label">연령대</span><div class="dropdown"><button id="iep-age-band" type="button" class="dropdown-trigger" data-options="recipient-age-band" data-iep-age data-value="${esc(state.recipients[index].ageBand||'')}" aria-labelledby="iep-age-label iep-age-value" aria-haspopup="listbox" aria-expanded="false"><span id="iep-age-value">${esc(state.recipients[index].ageBand||'연령대 선택')}</span></button></div></div>${view==='saved'?'':rangeField('month','월 계획 기간')}</section>
      <div id="iep-content"></div>`;
    if(view==='saved')renderSaved();else if(view==='result'&&draft().result)renderResult();else renderForm();
    registerEdits();
  }
  function renderForm() {
    const d=draft();
    $('#iep-content').innerHTML=`<form id="iep-form">
      ${savedPlanId?'<div class="iep-card-heading"><h2>저장한 계획 수정</h2></div>':''}

      <section class="iep-card"><div class="iep-card-heading"><h2>1. 현행수준</h2>${savedPlanId?'':'<button type="button" class="button tertiary" data-iep-action="example">예시 불러오기</button>'}</div><div class="iep-two-col">${field('observation','목표와 관련된 현재 수행 모습',{required:true,placeholder:'예: 도움 요청 그림을 보여 주면 그림을 가리켜요.'})}${field('strength','흥미와 강점 (선택)',{placeholder:'예: 자동차 놀이를 좋아하고, 익숙한 그림으로 원하는 것을 표현해요.'})}</div><details class="iep-optional-context" ${d.input.familyRequest||d.input.participationNeeds?'open':''}><summary>목표에 필요한 추가 정보 <span class="iep-optional">(선택)</span></summary><p class="iep-help">목표나 지원을 바꾸는 내용이 있을 때만 입력해요.</p><div class="iep-two-col">${field('familyRequest','보호자의 교육적 요청',{rows:2,placeholder:'예: 가정에서도 그림으로 도움을 요청해 보길 원함',help:'보호자 이름·연락처·가족사는 적지 않아요.'})}${field('participationNeeds','활동 참여·안전에 필요한 지원',{rows:2,placeholder:'예: 앉아서 참여할 수 있는 자리 마련, 소음이 적은 공간 사용',help:'활동에 필요한 조치만 적어요. 진단서·검사보고서는 받지 않아요.'})}</div></details></section>
      <section class="iep-card"><div class="iep-card-heading"><h2>2. 교육목표</h2></div>
        <div class="iep-two-col">${field('monthGoal','월 목표',{required:true,placeholder:'이번 달에 길러 갈 기능이나 참여 모습'})}${field('semesterGoal','연결할 기존 IEP 목표 (선택)',{placeholder:'이미 정한 학기 또는 장기 목표가 있으면 입력해 주세요.'})}</div>
      </section>
      <div class="iep-card iep-action-bar"><div><strong>현행수준과 목표를 바탕으로 계획을 제안해요</strong><p id="iep-error" class="iep-error" role="alert" hidden></p></div><button type="submit" class="button primary">${d.result?'변경 내용 반영':'AI 계획 제안 받기'}</button></div>
    </form>`;
  }
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
    return `<div class="iep-result-field" data-field-key="${key}"><label for="${id}">${labelHTML(label)}</label><textarea id="${id}" rows="${value.length>160?6:3}" maxlength="2400" data-iep-section="${section.key}" data-iep-field="${key}" placeholder="${placeholder}">${esc(value)}</textarea></div>`;
  }
  function planTable(r) {
    return `<table class="iep-plan-table"><caption>개별화교육 실행 계획 · ${esc(state.recipients[index].name)}</caption><colgroup><col class="iep-table-section"><col class="iep-table-label"><col></colgroup><thead><tr><th scope="col">구분</th><th scope="col">항목</th><th scope="col">계획 및 기록</th></tr></thead>${r.sections.map((s,n)=>{const fields=s.fields.filter(f=>!OPTIONAL_CONTEXT_FIELDS.includes(f[0])||f[2]);return `<tbody>${fields.map((f,j)=>`<tr>${j===0?`<th scope="rowgroup" rowspan="${fields.length}">${n+1}. ${s.title}</th>`:''}<th scope="row">${labelHTML(f[1])}</th><td>${esc(f[2]||EMPTY_LABELS[f[0]]||'미입력')}</td></tr>`).join('')}</tbody>`;}).join('')}</table>`;
  }
  function renderResult() {
    const d=draft(),r=d.result;
    $('#iep-content').innerHTML=`
      <section class="iep-card iep-result-header"><div><div class="iep-card-heading"><h2>${esc(state.recipients[index].name)}의 월간 계획</h2><span class="workflow-badge" data-iep-status>${r.confirmed?'검토 완료':savedPlanId?'수정 중':'초안 검토'}</span>${r.proposalMode==='mockup'?'<span class="workflow-badge">제안 예시</span>':r.example?'<span class="workflow-badge">예시</span>':''}</div><p class="iep-help">${period(r.input.month)}</p><p class="iep-help">작성 당시 연령대 · ${esc(r.input.ageBand||'미기록')}</p></div><div class="iep-inline-actions"><button type="button" class="button tertiary" data-iep-action="edit-input">입력 수정</button><button type="button" class="button tertiary" data-iep-action="document">${documentView?'카드로 보기':'계획서 보기'}</button><button type="button" class="button tertiary" data-iep-action="download">계획서 내려받기</button></div></section>
      ${r.migrated?'<p class="iep-demo-note">기존 내용을 새 양식으로 옮겼어요. 추가된 항목을 확인한 뒤 다시 검토 완료해 주세요.</p>':''}
      ${documentView?`<section class="iep-card"><div class="iep-card-heading"><h2>계획서 미리보기</h2><span class="iep-help">HTML 문서 · 인쇄 시 PDF 저장 가능</span></div><div class="iep-table-scroll" tabindex="0" role="region" aria-label="IEP 계획서 표">${planTable(r)}</div></section>`:`${r.sections.map((s,n)=>`<section class="iep-card" id="iep-section-${s.key}"><div class="iep-card-heading"><h2>${n+1}. ${s.title}</h2></div>${s.key==='review'?'<p class="iep-help iep-before-fields">실제 관찰은 활동 후에 적어요. 아래 다음 계획은 관찰 결과에 따라 선택할 검토안이에요.</p>':''}<div class="iep-result-fields ${['present','content','evaluation'].includes(s.key)?'iep-two-col':''}">${s.fields.map(f=>resultField(s,f)).join('')}</div></section>`).join('')}`}
      <div class="iep-card iep-action-bar" data-iep-savebar ${savedPlanId&&r.confirmed?'hidden':''}><div><strong>${savedPlanId?'수정한 내용을 저장해 주세요':'교사 검토 후 저장해 주세요'}</strong><p class="iep-help">아이에게 맞는 목표·지원·평가 방법인지 확인해요. 학교의 공식 IEP 확정 절차는 별도로 진행해요.</p></div><button type="button" class="button primary" data-iep-action="save" ${r.confirmed?'disabled':''}>${savedPlanId?'변경 내용 저장':'검토 완료하고 저장'}</button></div>`;
  }
  function renderSaved() {
    const plans=state.iep.plans.filter(p=>p.recipient===index);
    $('#iep-content').innerHTML=plans.length?`<div class="iep-saved-list">${plans.map(p=>`<article class="iep-card iep-saved-card"><div><div class="iep-card-heading"><h2>${period(p.result.input.month)} 월간 계획</h2><span class="workflow-badge">${state.iep.savedDrafts[p.id]?.dirtyInput||state.iep.savedDrafts[p.id]?.result?.confirmed===false?'수정 중':p.result.confirmed?'검토 완료':'양식 검토 필요'}</span></div><p>${esc(valueOf(p.result,'monthGoal'))}</p><span class="iep-help">${p.result.example?'목업 예시 · ':''}${esc(new Date(p.updatedAt).toLocaleDateString('ko-KR'))} 저장</span></div><button type="button" class="button tertiary" data-iep-action="open" data-plan-id="${p.id}">계획 보기</button></article>`).join('')}</div>`:`<section class="iep-card iep-empty"><h2>저장한 계획이 없어요</h2><p class="iep-help">월 목표를 입력하고 검토한 계획을 저장해 보세요.</p><button type="button" class="button primary" data-iep-action="workspace">계획 작성하기</button></section>`;
  }
  function periodError(i) {
    if(!i.month.from||!i.month.to)return '월 계획 기간을 선택해 주세요.';
    if(i.month.from>i.month.to)return '종료일은 시작일 이후로 선택해 주세요.';
    if(i.month.from.slice(0,7)!==i.month.to.slice(0,7))return '월 계획 기간은 같은 달 안에서 선택해 주세요.';
    return '';
  }
  function createPlan(event) {
    event.preventDefault();
    const i=draft().input,error=$('#iep-error');
    const fail=message=>{error.hidden=false;error.textContent=message;error.scrollIntoView({block:'nearest'});};
    if(!ageBands.includes(state.recipients[index].ageBand)){fail('대상의 연령대를 선택해 주세요. 생년월일은 필요하지 않아요.');$('#iep-age-band').setAttribute('aria-invalid','true');$('#iep-age-band').focus();return;}
    const rangeError=periodError(i);if(rangeError)return fail(rangeError);
    for(const key of ['monthGoal','observation']) {
      if(!i[key].trim()){fail('필수 항목에 내용을 입력해 주세요.');$(`[name="${key}"]`).focus();return;}
    }
    const d=draft(),previous=d.result,next=buildResult();
    // 이전 3~6번 입력은 복구용으로만 보존하며 새 제안 입력에는 포함하지 않습니다.
    const legacyKeys=['nuri','context','educationContent','materials','support','evaluationMethod','criterion'];
    const legacyInput=Object.fromEntries(legacyKeys.filter(key=>d.input[key]).map(key=>[key,d.input[key]]));
    if(previous?.legacyInput||Object.keys(legacyInput).length)next.legacyInput=previous?.legacyInput||legacyInput;
    // 직접 편집한 연결 문장은 입력 수정을 반영할 때도 보존합니다.
    next.editedFields=previous?.editedFields||[];
    for(const s of next.sections)for(const f of s.fields){
      if(!INPUT_FIELDS[f[0]]&&next.editedFields.includes(f[0]))f[2]=valueOf(previous,f[0]);
      if(f[0]==='evaluationResult'&&previous&&valueOf(previous,f[0]))f[2]=valueOf(previous,f[0]);
    }
    if(next.editedFields.some(key=>!INPUT_FIELDS[key]))next.previousSourceIds=previous?.previousSourceIds||(legacyResult(previous)?resultSourceIds(previous):[]);
    d.input=clone(next.input);d.result=next;d.dirtyInput=false;documentView=false;view='result';persist();shell();focusHeading();toast(previous?'변경한 입력을 계획에 반영했어요.':'계획 제안 예시를 만들었어요. 모든 내용을 바로 수정할 수 있어요.');
  }
  function savePlan() {
    const d=draft(),r=d.result;
    const rangeError=periodError(r.input);if(rangeError){toast(rangeError);$('[data-date-range="iep-month"]').focus();return;}
    const missing=REQUIRED_FIELDS.find(key=>!valueOf(r,key).trim());
    if(missing){documentView=false;renderResult();$(`#iep-result-${missing}`).focus();toast('계획의 필수 내용을 입력해 주세요.');return;}
    r.confirmed=true;r.migrated=false;
    const previous=state.iep.plans.find(p=>p.id===d.savedId);
    const item={id:previous?.id||crypto.randomUUID(),recipient:index,result:clone(r),updatedAt:new Date().toISOString()};
    if(previous)Object.assign(previous,item);else state.iep.plans.unshift(item);
    if(!savedPlanId)state.iep.drafts[index]=blank();
    state.iep.savedDrafts[item.id]={example:r.example,input:clone(r.input),result:clone(r),savedId:item.id};
    savedPlanId=item.id;view='result';persist();shell();focusHeading();toast('저장한 계획에 보관했어요.');
  }
  function download() {
    const r=draft().result;
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
    else if(action==='open'){
      const p=state.iep.plans.find(p=>p.id===b.dataset.planId&&p.recipient===index);if(!p)return;
      openSavedPlan(p);persist();shell();focusHeading();
    }
  }
  function input(event) {
    if(document.body.classList.contains('mockup-editing'))return;
    const el=event.target,d=draft();
    if(el.closest('#iep-form')&&el.name){d.input[el.name]=el.value;d.dirtyInput=true;persist();}
    if(el.dataset.iepField){
      const section=d.result.sections.find(s=>s.key===el.dataset.iepSection),field=section.fields.find(f=>f[0]===el.dataset.iepField);
      field[2]=el.value;d.result.confirmed=false;
      d.result.editedFields ||= [];if(!d.result.editedFields.includes(field[0]))d.result.editedFields.push(field[0]);
      if(INPUT_FIELDS[field[0]]){d.input[INPUT_FIELDS[field[0]]]=el.value;d.result.input[INPUT_FIELDS[field[0]]]=el.value;}
      $('[data-iep-status]').textContent=savedPlanId?'수정 중':'초안 검토';
      $('[data-iep-savebar]').hidden=false;
      const b=$('[data-iep-action="save"]');b.disabled=false;b.textContent=savedPlanId?'변경 내용 저장':'검토 완료하고 저장';
      $('.iep-action-bar strong').textContent=savedPlanId?'수정한 내용을 저장해 주세요':'교사 검토 후 저장해 주세요';persist();
    }
  }
  return {
    mount(element,recipient) {
      root=element;index=recipient;
      if(savedPlanId&&!state.iep.plans.some(p=>p.id===savedPlanId&&p.recipient===index)){savedPlanId=null;view='saved';}
      // 이전 버전에서 작성 탭에 남아 있던 저장본·수정 중 사본을 옮깁니다.
      const old=workspaceDraft(),saved=state.iep.plans.find(p=>p.id===old.savedId&&p.recipient===index);
      if(saved){state.iep.savedDrafts[saved.id] ||= clone(old);state.iep.drafts[index]=blank();openSavedPlan(saved);persist();}
      view=view==='saved'?'saved':draft().result&&!draft().dirtyInput?'result':'form';shell();root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('submit',createPlan);
    },
    getRange(key){return draft().input[key];},
    setAgeBand(value){
      if(!ageBands.includes(value)||state.recipients[index].ageBand===value)return;
      state.recipients[index].ageBand=value;
      const error=$('#iep-error');if(error?.textContent.startsWith('대상의 연령대'))error.hidden=true;
      if(view!=='saved'){
        const d=draft();d.input.ageBand=value;
        if(view==='result'&&d.result){d.result.input.ageBand=value;d.result.confirmed=false;renderResult();registerEdits();}
        else d.dirtyInput=true;
      }
      persist();
    },
    commitRange(key){
      const d=draft();$(`#iep-${key}-value`).textContent=period(d.input[key]);
      if(view==='result'&&d.result){d.result.input[key]=clone(d.input[key]);d.result.confirmed=false;renderResult();registerEdits();}
      else d.dirtyInput=true;
      persist();
    }
  };
}
