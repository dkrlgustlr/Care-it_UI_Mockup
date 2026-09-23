/* UI 동작과 샘플 데이터. 서버 요청 없이 이 브라우저 안에서만 실행됩니다. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const embedded = JSON.parse($('#saved-design').textContent || '{}');
  const STORAGE = 'careit-ui-mockup-20260923-v1' + (embedded.exportId ? '-'+embedded.exportId : '');
  let state = {...embedded};
  try { state = {...state, ...JSON.parse(localStorage.getItem(STORAGE) || '{}')}; } catch {}
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
  const TODAY = '2026-09-23'; // 원본 화면의 기준일. 목업 날짜를 일관되게 유지합니다.
  state.recipients ||= [
    {name:'산책 샘플', count:11, date:'2026/09/10', active:true, memo:''},
    {name:'그림책 샘플', count:8, date:'2026/09/10', active:true, memo:''},
    {name:'테스트용 9.14', count:1, date:'2026/09/14', active:true, memo:''},
    {name:'이지훈', count:1, date:'2026/09/13', active:false, memo:''}
  ];
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
  let route = '/', params = new URLSearchParams(), recipient = 0, detailRecipient = 0, recordTab = 'journals';
  const recordRange = {from:'', to:''};
  const reportRange = {from:'2026-09-11', to:'2026-09-17'};
  let editingRecipient = null, editing = false, toastTimer, activePopupTrigger;
  const persist = () => { try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch { $('.mockup-editor-status').textContent = '자동 저장을 사용할 수 없습니다. 수정본 HTML 저장을 눌러 주세요.'; } };
  function toast(message) { clearTimeout(toastTimer); const el = $('#mockup-toast'); el.textContent = message; el.hidden = false; toastTimer = setTimeout(() => el.hidden = true, 3200); }
  let confirmAction;
  function dialog(title, html, confirmLabel, onConfirm, danger=false) {
    closePopups();
    const modal=$('#mockup-dialog');
    $('#mockup-dialog-title').textContent=title; $('#mockup-dialog-body').innerHTML=html;
    $('.dialog-actions',modal).innerHTML=`<button type="button" class="button secondary" data-action="close-dialog">${confirmLabel?'취소':'닫기'}</button>${confirmLabel?`<button type="button" class="button ${danger?'danger':'primary'}" data-action="confirm-dialog">${escapeHTML(confirmLabel)}</button>`:''}`;
    confirmAction=onConfirm;
    if(!modal.open)modal.showModal();
  }
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
  function routeTo(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function render() {
    if(location.hash==='#main-content'){ $('#main-content').focus(); return; }
    closePopups();
    $$('dialog[open]').forEach(x => x.close());
    const hash = location.hash.slice(1) || '/';
    [route] = hash.split('?'); params = new URLSearchParams(hash.split('?')[1] || '');
    recipient = Math.max(0, Math.min(state.recipients.length - 1, Number(params.get('recipient') || 0)));
    const template = $$('template[data-path]').find(x => x.dataset.path === route);
    if (!template) { dialog('화면 범위 안내', '<p>이 페이지는 이번 목업에 포함되지 않았습니다. 주요 메뉴 화면에서 작업해 주세요.</p>'); return; }
    $('#screen').replaceChildren(template.content.cloneNode(true));
    $$('.sidebar nav a').forEach(a => { const current = a.dataset.route === route || (a.dataset.route === '/settings' && route.startsWith('/settings/')); a.classList.toggle('active', current); if (current) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    $$('[data-options="recipients"] span', $('#screen')).forEach(x => x.textContent = state.recipients[recipient].name);
    if (route === '/journals/new') prepareJournal();
    if (route === '/records') { updateRecordFilters(); renderRecords(); }
    if (route === '/recipients') renderRecipients();
    if (route === '/plans') $$('.pricing-features li').forEach(li => li.insertAdjacentHTML('afterbegin','<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'));
    if (route === '/notifications' && state.notificationsRead) { $$('.notification-list .unread').forEach(x => x.classList.remove('unread')); $$('[data-action="read-notification"]').forEach(x => x.remove()); }
    if (route === '/settings/configuration') prepareConfiguration();
    if (route === '/settings') prepareSettings();
    if (route === '/reports') {
      $('[data-options="report-templates"] span').textContent=state.reportTemplates[recipient]||'초등 교육과정 기반 · 3~6학년';
      if(params.get('report')==='sample')Object.assign(reportRange,{from:'2026-08-28',to:'2026-09-03'});
      updateReportPeriod();
    }
    if (matchMedia('(max-width:1023px)').matches) { $('.app-layout').classList.add('mockup-nav-collapsed'); $('.nav-open-button').hidden=false; }
    registerEdits(); window.scrollTo(0,0); requestAnimationFrame(scaleReports);
  }
  function prepareJournal() {
    $('[data-quick-checks]').innerHTML = getQuickChecks().map((q,i)=>q.active?quickPreview(q,i,false):'').join('');
    const config = state.configuration[recipient];
    if(config) $$('.journal-inline-title-input').forEach((el,i) => el.value=config[i]||el.value);
    const editIndex = params.get('entry');
    let draft = state.drafts[recipient] || {};
    if(editIndex===null&&state.draftDates[recipient]){const date=state.draftDates[recipient];$('[data-action="date"]').dataset.value=date;$('[data-action="date"] span').textContent=formatDate(date);}
    if (editIndex !== null) {
      const row = journalRows()[Number(editIndex)];
      if (row) {
        draft = row.values || {'journal-raw':row[2]};
        $('.page-header h1').textContent = '일지 수정';
        $('[data-action="date"] span').textContent = formatDate(row[0]);
        $('[data-action="date"]').dataset.value = row[0];
      }
    }
    $$('input[id], textarea[id]', $('#screen')).forEach(el => {
      if (draft[el.id] !== undefined) { if (el.type==='radio'||el.type==='checkbox') el.checked=draft[el.id]; else el.value=draft[el.id]; }
      updateCounter(el);
    });
    $$('.journal-inline-title-input', $('#screen')).forEach(input => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'journal-title-edit';
      button.dataset.action = 'edit-journal-title';
      button.setAttribute('aria-label', input.getAttribute('aria-label') + ' 수정');
      button.setAttribute('aria-controls', input.id);
      button.title = '제목 수정';
      button.append($('#journal-title-edit-icon').content.cloneNode(true));
      input.after(button);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
          e.preventDefault();
          input.blur();
        }
      });
    });
  }
  function updateCounter(el) {
    const counter = el.id ? document.getElementById(el.id + '-limit') : null;
    if (counter && el.maxLength > 0) counter.textContent = `${el.value.length}/${el.maxLength}자`;
    if (el.classList.contains('journal-inline-title-input')) el.parentElement.querySelector('.journal-title-limit').textContent = `${el.value.length}/12자`;
  }
  function captureDraft() {
    const values = {}; $$('input[id],textarea[id]', $('#screen')).forEach(el => values[el.id] = (el.type==='radio'||el.type==='checkbox') ? el.checked : el.value);
    state.drafts[recipient] = values; state.draftDates[recipient]=$('[data-action="date"]')?.dataset.value||TODAY;persist(); return values;
  }
  function journalRows() {
    let original = recipient===0 ? originalJournalRows : recipient===1 ? [['2026-09-22','9월 22일 (화)','[합성 QA 2026-09-22 상태 안내] 서버 버퍼 저장 완료 안내 검증입니다. 실제 돌봄 기록이 아닙니다.']] : recipient===2 ? [['2026-09-14','9월 14일 (월)',$('#page-home').content.querySelectorAll('.latest-journal-copy')[2].textContent]] : [];
    return [...state.savedJournals.filter(x => x.recipient===recipient).map(x => Object.assign([x.date,formatShortDate(x.date),x.text], {values:x.values})), ...original];
  }
  function renderRecords() {
    const list = $('[data-record-list]');
    $$('.record-tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.recordTab===recordTab));
    if (recordTab==='journals') {
      list.innerHTML = journalRows().map((row,i)=>`<a class="record-row journal-row" data-date="${row[0]}" href="#/journals/new?recipient=${recipient}&entry=${i}"><time datetime="${row[0]}">${row[1]}</time><div><strong>저장됨</strong><p>${escapeHTML(row[2])}</p></div></a>`).join('');
    } else if (recordTab==='reports') {
      list.innerHTML = state.reportRemoved?.[recipient]?'<section class="empty-state"><h2>저장된 리포트가 없어요</h2></section>':'<a class="record-row" data-date="2026-09-20" href="#/reports?recipient='+recipient+'&report=sample"><time datetime="2026-09-20">9월 20일 (일)</time><div><strong>8월 28일 (금) – 9월 3일 (목) 주간 리포트</strong><p>주간 리포트 · 생성 9월 20일 (일)</p></div><span class="button tertiary">보기</span></a>';
    } else {
      list.innerHTML=state.trash.map((item,i)=>item.recipient===recipient?`<article class="mockup-trash-row" data-date="${escapeHTML(item.date)}"><div><strong>${escapeHTML(item.title)}</strong><p>${formatDate(item.date)}에 삭제 · 30일 동안 복원 가능</p></div><div class="mockup-trash-actions"><button type="button" class="button secondary" data-action="restore-trash" data-index="${i}">복원</button><button type="button" class="button danger-soft" data-action="delete-trash" data-index="${i}">완전삭제</button></div></article>`:'').join('')||'<section class="empty-state"><h2>휴지통이 비어 있어요</h2><p>삭제한 일지와 리포트는 이곳에서 확인할 수 있어요.</p></section>';
    }
    list.setAttribute('aria-label',recordTab==='reports'?'리포트 목록':recordTab==='trash'?'휴지통 목록':'일지 목록');
    if($('[data-date]',list))list.insertAdjacentHTML('afterbegin','<section class="empty-state" data-filter-empty hidden><h2>선택한 기간에 기록이 없어요</h2><p>기간을 변경하거나 초기화해 주세요.</p></section>');
    filterRecords();
    registerEdits();
  }
  function updateRecordFilters() {
    const button=$('.records-date-filter [data-date-range]');
    button.querySelector('span').textContent=recordRange.from?`${recordRange.from.replaceAll('-','.')} ~ ${recordRange.to.replaceAll('-','.')}`:'날짜 선택';
    button.setAttribute('aria-description',recordRange.from?`${formatDate(recordRange.from)}부터 ${formatDate(recordRange.to)}까지`:'시작 날짜와 종료 날짜를 차례로 선택하세요.');
    $('[data-action="reset-record-dates"]').disabled=!recordRange.from&&!recordRange.to;
  }
  function filterRecords() {
    const {from,to}=recordRange, rows=$$('[data-record-list] [data-date]');
    rows.forEach(el => el.hidden = !!((from&&el.dataset.date<from)||(to&&el.dataset.date>to)));
    const empty=$('[data-filter-empty]');if(empty)empty.hidden=rows.some(el=>!el.hidden);
  }
  function reportDays() {
    return reportRange.from&&reportRange.to?new Set(journalRows().filter(row=>row[0]>=reportRange.from&&row[0]<=reportRange.to).map(row=>row[0])).size:0;
  }
  function isSampleReportPeriod() { return reportRange.from==='2026-08-28'&&reportRange.to==='2026-09-03'; }
  function updateReportPeriod() {
    const {from,to}=reportRange,days=reportDays(),button=$('[data-date-range="report"]');
    button.querySelector('span').textContent=from?`${from.replaceAll('-','.')} ~ ${to.replaceAll('-','.')}`:'날짜 선택';
    button.setAttribute('aria-description',from?`${formatDate(from)}부터 ${formatDate(to)}까지`:'시작 날짜와 종료 날짜를 차례로 선택하세요.');
    $('.report-recipient-change button').disabled=days<3;
    $('.report-generation-status').textContent=!from?'달력에서 리포트의 시작일과 종료일을 선택해 주세요.':days>=3?`선택한 기간의 저장 기록은 ${days}일이에요. 생성 기준 3일을 충족해 리포트를 생성할 수 있어요.`:`서로 다른 날짜의 저장 기록이 ${days}일이라 생성 기준 3일을 채우지 못했어요.`;
    if(isSampleReportPeriod()&&!state.reportRemoved?.[recipient])showStoredReport();
    else $('.reports-layout').innerHTML='<section class="empty-state"><h2>선택한 기간의 리포트가 없어요</h2><p>다른 기간을 선택하거나 새 리포트를 생성해 주세요.</p></section>';
    requestAnimationFrame(scaleReports);
  }
  function renderRecipients() {
    $('[data-recipient-grid]').innerHTML = state.recipients.map((r,i)=>r.deleted?'':`<article class="recipient-card card${r.active?'':' is-inactive'}"><header><div><h2>${escapeHTML(r.name)}</h2></div>${r.active?'':'<span class="recipient-card-status">비활성화</span>'}</header><dl><div><dt>저장한 일지</dt><dd>${r.count}건</dd></div><div><dt>퀵체크 항목</dt><dd>${getQuickChecks(i).filter(q=>q.active).length}개</dd></div><div><dt>기록 시작</dt><dd>${r.date}</dd></div></dl><button class="button secondary recipient-detail-button" type="button" data-detail="${i}">상세 보기</button></article>`).join('');
    registerEdits();
  }
  function showRecipient(index) {
    detailRecipient = index; const r = state.recipients[index];
    $('#recipient-detail-title').textContent = r.name+' 상세'; $('[data-detail-count]').textContent = r.count+'건';
    $$('.recipient-detail-overview-stats dd')[1].textContent=getQuickChecks(index).filter(q=>q.active).length+'개';
    $('[data-detail-active]').textContent = r.active?'활성화':'비활성화';
    $('[data-detail-date]').textContent = formatDate(r.date.replaceAll('/','-')); $('[data-detail-memo]').textContent = r.memo || '—';
    $('[data-action="toggle-recipient"]').textContent = r.active?'비활성화':'다시 활성화';
    $('#recipient-dialog a').href = '#/settings/configuration?recipient='+index;
    $('#recipient-dialog').showModal(); registerEdits();
  }
  function formatDate(value) { const [y,m,d] = value.split('-'); return `${y}년 ${Number(m)}월 ${Number(d)}일`; }
  function formatShortDate(value) { const [y,m,d] = value.split('-'); return `${Number(m)}월 ${Number(d)}일 (${'일월화수목금토'[new Date(Number(y),Number(m)-1,Number(d)).getDay()]})`; }
  let popupPanel=null, popupReposition=null;
  const iconCheck='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
  const iconPrev='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const iconNext='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const reportTemplates=['누리과정 · 3~5세','초등 교육과정 기반 · 1~2학년','초등 교육과정 기반 · 3~6학년'];
  const quickTypes=['선택형','숫자','척도','텍스트','시간 길이','시각'];
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
    let choices=[];
    if(kind==='recipients')choices=state.recipients.flatMap((r,i)=>r.active&&!r.deleted?[{label:r.name,value:i}]:[]);
    else if(kind==='report-templates'||kind==='score-templates')choices=reportTemplates.map((label,value)=>({label,value}));
    else if(kind==='quick-type')choices=quickTypes.map((label,value)=>({label,value}));
    else if(kind==='saved-journals')choices=journalRows().map((x,i)=>({label:x[1],description:'저장됨',value:i}));
    const menu=document.createElement('div');menu.className='mockup-listbox';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',button.getAttribute('aria-label')||'항목 선택');
    menu.style.minWidth=`${Math.min(Math.max(button.getBoundingClientRect().width,240),window.innerWidth-16)}px`;
    choices.forEach((choice,i)=>{
      const selected=kind==='recipients'?choice.value===recipient:kind==='saved-journals'?String(choice.value)===params.get('entry'):choice.label===button.textContent.trim();
      const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.setAttribute('aria-selected',selected);option.tabIndex=selected?0:-1;
      if(kind==='report-templates'&&choice.value===1){option.disabled=true;choice.description='문항 수 보완 필요';}
      option.innerHTML=`<span class="mockup-option-copy"><span>${escapeHTML(choice.label)}</span>${choice.description?`<small>${escapeHTML(choice.description)}</small>`:''}</span>${selected?iconCheck:'<span class="mockup-check-space"></span>'}`;
      option.addEventListener('click',()=>{
        closePopups(true);
        if(kind==='recipients') {
          if(route==='/journals/new')captureDraft();
          const change=()=>{params.set('recipient',choice.value);params.delete('entry');params.delete('report');routeTo('#'+route+'?'+params);};
          if(configurationDirty())confirmDiscard(change,'이동하면 저장하지 않은 변경이 사라집니다.');else change();
        }else if(kind==='saved-journals')routeTo(`#/journals/new?recipient=${recipient}&entry=${choice.value}`);
        else if(kind==='report-templates')dialog('채점 기준을 바꿀까요?','<p>선택한 템플릿의 기본 영역명과 문항으로 저장한 뒤 새 리포트에 적용해요. 기존 리포트는 바뀌지 않아요.</p>','저장하고 적용',()=>{state.reportTemplates[recipient]=choice.label;persist();button.querySelector('span').textContent=choice.label;});
        else if(kind==='quick-type'){readQuickDraft();quickDraft.type=choice.label;drawQuickEditor();}
        else if(kind==='score-templates')dialog('채점 기준을 바꿀까요?','<p>현재 편집 중인 영역명과 문항을 선택한 템플릿의 기본 내용으로 바꿔요.</p>','바꾸기',()=>{scoreDraft=scoreSeed(choice.value);drawScoring();});
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
    const activeRange=isReportRange?reportRange:recordRange;
    const commitRange=(from,to)=>{
      Object.assign(activeRange,{from,to});
      closePopups(true);
      if(isReportRange){
        params.delete('report');
        history.replaceState(null,'','#'+route+(params.size?'?'+params:''));
        updateReportPeriod();registerEdits();
      }else {updateRecordFilters();filterRecords();}
    };
    const value=button.dataset.value||'';
    let rangeFrom=activeRange.from,rangeTo=activeRange.to,selectingEnd=false;
    const max=TODAY;
    let initialDate=(isRange?rangeFrom:value)||TODAY;
    if(initialDate>max)initialDate=max;
    let [year,month]=initialDate.split('-').map(Number);month--;
    const popup=document.createElement('div');popup.className='datefield-panel mockup-date-popup'+(isRange?' mockup-date-range':'');popup.setAttribute('role','dialog');popup.setAttribute('aria-label',isRange?'날짜 기간 선택':`${button.getAttribute('aria-label')||'날짜'} 선택`);
    const dateKey=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const allowed=date=>date<=max;
    const paintRange=(preview='')=>{
      if(!isRange)return;
      const end=selectingEnd?(preview>=rangeFrom?preview:rangeFrom):rangeTo;
      $$('[data-date]',popup).forEach(day=>{
        const date=day.dataset.date,inRange=!!rangeFrom&&date>=rangeFrom&&date<=(end||rangeFrom);
        day.classList.toggle('is-in-range',inRange);
        day.classList.toggle('is-range-start',date===rangeFrom);
        day.classList.toggle('is-range-end',!!rangeFrom&&date===(end||rangeFrom));
        day.setAttribute('aria-pressed',String(inRange));
      });
    };
    const pick=date=>{
      if(!allowed(date))return;
      if(isRange){
        if(!selectingEnd||date<rangeFrom){rangeFrom=date;rangeTo='';selectingEnd=true;draw(date);return;}
        commitRange(rangeFrom,date);return;
      }
      else {button.dataset.value=date;button.querySelector('span').textContent=formatDate(date);}
      closePopups(true);filterRecords();
      if(route==='/journals/new'){captureDraft();$('[data-draft-status]').textContent='이 브라우저에 임시 저장했어요.';}
    };
    const draw=(focusDate)=>{
      const days=new Date(year,month+1,0).getDate(),offset=new Date(year,month,1).getDay();
      const nextFirst=dateKey(new Date(year,month+1,1).getFullYear(),new Date(year,month+1,1).getMonth(),1);
      const rangeHeader=isRange?`<p class="date-range-prompt" role="status">${selectingEnd?'종료 날짜를 선택해 주세요.':'시작 날짜를 선택해 주세요.'}</p><p class="date-range-summary">${rangeFrom?`${formatDate(rangeFrom)} → ${rangeTo?formatDate(rangeTo):'종료일 선택'}`:'시작일 → 종료일 순서로 선택해 주세요.'}</p>`:'';
      popup.innerHTML=`${rangeHeader}<div class="datefield-head"><button type="button" aria-label="이전 달">${iconPrev}</button><strong aria-live="polite">${year}년 ${month+1}월</strong><button type="button" aria-label="다음 달" ${nextFirst>max?'disabled':''}>${iconNext}</button></div><div class="datefield-grid" role="group" aria-label="${year}년 ${month+1}월">${[...'일월화수목금토'].map(x=>`<span class="datefield-weekday" aria-hidden="true">${x}</span>`).join('')}${'<span aria-hidden="true"></span>'.repeat(offset)}${Array.from({length:days},(_,i)=>{const date=dateKey(year,month,i+1);return `<button type="button" class="datefield-day${date===value?' is-picked':''}${date===TODAY?' is-today':''}" data-date="${date}" aria-label="${formatDate(date)}" aria-pressed="${date===value}" ${date===TODAY?'aria-current="date"':''} ${allowed(date)?'':'disabled'} tabindex="-1">${i+1}</button>`;}).join('')}</div>${isRange?'<button type="button" class="button tertiary" data-clear-date>날짜 지우기</button>':'<button type="button" class="datefield-today">오늘로</button>'}`;
      $('.datefield-head [aria-label="이전 달"]',popup).onclick=()=>{month--;if(month<0){month=11;year--;}draw();};
      $('.datefield-head [aria-label="다음 달"]',popup).onclick=()=>{month++;if(month>11){month=0;year++;}draw();};
      $$('[data-date]',popup).forEach(b=>b.onclick=()=>pick(b.dataset.date));
      $('.datefield-today',popup)?.addEventListener('click',()=>pick(TODAY));
      $('[data-clear-date]',popup)?.addEventListener('click',()=>commitRange('',''));
      paintRange(focusDate);
      const focus=$(`[data-date="${focusDate||initialDate}"]:not(:disabled)`,popup)||$('[data-date]:not(:disabled)',popup);
      if(focus){focus.tabIndex=0;if(popup.isConnected)focus.focus();}
      popupReposition?.();
    };
    draw();attachPopup(button,popup);$('[data-date][tabindex="0"]',popup)?.focus();
    popup.addEventListener('pointerover',e=>{const day=e.target.closest('.datefield-day');if(selectingEnd&&day&&!day.disabled)paintRange(day.dataset.date);});
    popup.addEventListener('pointerleave',()=>{if(selectingEnd)paintRange();});
    popup.addEventListener('keydown',e=>{
      const current=e.target.dataset.date;
      if(current&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)){
        e.preventDefault();const [y,m,d]=current.split('-').map(Number);const next=new Date(y,m-1,d);
        if(e.key==='PageUp'||e.key==='PageDown'){const step=e.key==='PageUp'?-1:1;next.setDate(1);next.setMonth(next.getMonth()+step);next.setDate(Math.min(d,new Date(next.getFullYear(),next.getMonth()+1,0).getDate()));}
        else next.setDate(d+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-next.getDay(),End:6-next.getDay()})[e.key]);
        const key=dateKey(next.getFullYear(),next.getMonth(),next.getDate());if(!allowed(key))return;year=next.getFullYear();month=next.getMonth();draw(key);
      }
      if(e.key==='Tab'){const nodes=$$('button:not(:disabled)',popup).filter(b=>b.tabIndex>=0);const i=nodes.indexOf(document.activeElement);if((e.shiftKey&&i===0)||(!e.shiftKey&&i===nodes.length-1)){e.preventDefault();closePopups(true);}}
    });
  }
  function saveJournal() {
    const values=captureDraft(); const text=Object.entries(values).filter(([id,v])=>id.startsWith('journal-')&&!id.includes('field-label')&&typeof v==='string'&&v.trim()).map(([,v])=>v).join('\n');
    if(!text.trim()){toast('메모를 입력해 주세요.');$('#journal-raw').focus();return;}
    const date=$('[data-action="date"]').dataset.value||'2026-09-23';
    const existing=state.savedJournals.find(x=>x.recipient===recipient&&x.date===date);
    if(existing)Object.assign(existing,{text,values});else{state.savedJournals.unshift({recipient,date,text,values});state.recipients[recipient].count++;}
    persist();toast('이 브라우저에 일지를 저장했어요. 실제 서비스에는 반영되지 않아요.');routeTo('#/records?recipient='+recipient);
  }
  function exportHTML() {
    if(document.querySelector('script[src]')){toast('careit-mockup.html 단일 파일을 열면 수정본을 한 파일로 저장할 수 있어요.');return;}
    state.css=$('#mockup-css').value;applyDesign();persist();
    const clone=document.documentElement.cloneNode(true);
    clone.querySelector('#saved-design').textContent=JSON.stringify({...state,exportId:Date.now().toString(36)}).replace(/</g,'\\u003c');
    clone.querySelector('#screen').innerHTML='';
    clone.querySelector('#mockup-panel').setAttribute('hidden','');clone.querySelector('#mockup-toggle').setAttribute('aria-expanded','false');clone.querySelector('#mockup-toast').setAttribute('hidden','');
    clone.querySelector('body').classList.remove('mockup-editing');clone.querySelector('#mockup-edit-mode').removeAttribute('checked');
    clone.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));
    clone.querySelectorAll('dialog').forEach(el=>el.removeAttribute('open'));
    clone.querySelectorAll('[aria-expanded="true"][data-options],[aria-expanded="true"][data-action="date"]').forEach(el=>{el.setAttribute('aria-expanded','false');el.removeAttribute('aria-controls');});
    clone.querySelectorAll('.mockup-popup,#quick-dialog,#scoring-dialog,#consent-dialog').forEach(el=>el.remove());
    const blob=new Blob(['<!doctype html>\n'+clone.outerHTML],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='careit-mockup-edited.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('수정본 HTML을 저장했어요. 이 파일 하나를 전달하면 됩니다.');
  }
  document.addEventListener('click',e=>{
    const editable=e.target.closest('[contenteditable="true"]'); if(editing&&editable){e.preventDefault();return;}
    if(e.composedPath().some(el=>el.classList?.contains('mockup-popup')))return;
    const policy=e.target.closest('a[href="#/privacy"],a[href="#/terms"]');
    if(policy){e.preventDefault();dialog(policy.textContent,'<p>법적 문서 본문은 이번 UI 목업에 포함하지 않았습니다. 실제 서비스의 최신 문서를 확인해 주세요.</p>');return;}
    const navigation=e.target.closest('a[href^="#/"]');
    if(navigation&&configurationDirty()){e.preventDefault();confirmDiscard(()=>{configSnapshot=JSON.stringify($$('#configuration-form input').map(x=>x.value));routeTo(navigation.getAttribute('href'));},'이동하면 저장하지 않은 변경이 사라집니다.');return;}
    const option=e.target.closest('[data-options]');if(option){dropdown(option);return;}
    if(!e.target.closest('.dropdown,.datefield,.mockup-popup'))closePopups();
    const detail=e.target.closest('[data-detail]');if(detail){showRecipient(Number(detail.dataset.detail));return;}
    const tab=e.target.closest('[data-record-tab]');if(tab){recordTab=tab.dataset.recordTab;renderRecords();return;}
    const button=e.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action;
    if(handlePopupAction(action,button,e))return;
    if(action==='edit-journal-title'){const input=document.getElementById(button.getAttribute('aria-controls'));input.focus();input.select();}
    else if(action==='reset-record-dates'){recordRange.from='';recordRange.to='';updateRecordFilters();filterRecords();}
    else if(action==='sidebar'){const collapsed=$('.app-layout').classList.toggle('mockup-nav-collapsed');$('.nav-open-button').hidden=!collapsed;}
    else if(action==='theme'){const dark=document.body.dataset.theme!=='dark';document.body.dataset.theme=dark?'dark':'light';button.setAttribute('aria-label',dark?'라이트 모드로 변경':'다크 모드로 변경');}
    else if(action==='date')datePicker(button);
    else if(action==='close-editor'){$('#mockup-panel').hidden=true;$('#mockup-toggle').setAttribute('aria-expanded','false');setEditMode(false);}
    else if(action==='apply-css'){state.css=$('#mockup-css').value;applyDesign();persist();toast('CSS를 적용했어요.');}
    else if(action==='export-html')exportHTML();
    else if(action==='close-dialog')$('#mockup-dialog').close();
    else if(action==='save-journal')saveJournal();
    else if(action==='add-recipient'){editingRecipient=null;$('.recipient-form-card').hidden=false;$('#recipient-form').reset();$('#recipient-form-title').textContent='관리대상 추가하기';$('#recipient-form button[type=submit]').textContent='추가하기';$('#recipient-name').focus();}
    else if(action==='cancel-recipient')$('.recipient-form-card').hidden=true;
    else if(action==='close-recipient')$('#recipient-dialog').close();
    else if(action==='edit-recipient'){editingRecipient=detailRecipient;$('#recipient-dialog').close();$('.recipient-form-card').hidden=false;$('#recipient-name').value=state.recipients[detailRecipient].name;$('#recipient-memo').value=state.recipients[detailRecipient].memo;$('#recipient-form-title').textContent='관리대상 정보 수정';$('#recipient-form button[type=submit]').textContent='저장';$('#recipient-name').focus();}
    else if(action==='read-notification'){button.closest('li').classList.remove('unread');button.remove();}
    else if(action==='read-all'){state.notificationsRead=true;persist();$$('.notification-list .unread').forEach(x=>x.classList.remove('unread'));$$('[data-action="read-notification"]').forEach(x=>x.remove());}
    else if(action==='print-report')window.print();
    else if(action==='word-report')dialog('Word 다운로드','<p>이 목업은 UI 검토용입니다. 문서 생성은 연결되지 않았습니다. 인쇄 버튼에서 PDF로 저장할 수 있어요.</p>');
  });
  document.addEventListener('submit',e=>{
    e.preventDefault();
    if(e.target.id==='quick-edit-form'){saveQuick();return;}
    if(e.target.id==='score-edit-form'){saveScoring();return;}
    if(e.target.id==='configuration-form'){const values=$$('input',e.target).map(x=>x.value.trim());if(values.some(x=>!x)){toast('영역 이름을 모두 입력해 주세요.');return;}dialog('일지 영역 이름을 바꿀까요?','<p>이미 저장된 일지는 그때 이름 그대로 남아요.</p>','바꾸기',()=>{state.configuration[recipient]=values;persist();prepareConfiguration();toast('일지 영역 이름을 저장했어요.');});return;}
    if(e.target.id!=='recipient-form')return;
    const name=$('#recipient-name').value.trim();if(!name){$('#recipient-name').focus();return;}
    const memo=$('#recipient-memo').value;
    if(editingRecipient!==null)Object.assign(state.recipients[editingRecipient],{name,memo});else state.recipients.push({name,memo,count:0,date:'2026/09/23',active:true});
    persist();$('.recipient-form-card').hidden=true;renderRecipients();toast('이 브라우저에 관리대상을 저장했어요.');
  });
  document.addEventListener('input',e=>{
    const el=e.target;
    if(el.dataset.editKey&&editing){state.edits[el.dataset.editKey]=el.textContent;persist();return;}
    updateCounter(el);
    if(route==='/journals/new'&&el.closest('#screen')){captureDraft();$('[data-draft-status]').textContent='이 브라우저에 임시 저장했어요.';}
  });
  document.addEventListener('change',e=>{if(route==='/journals/new'&&e.target.closest('[data-quick-checks]'))captureDraft();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(popupPanel){e.preventDefault();e.stopImmediatePropagation();closePopups(true);return;}if(editing){setEditMode(false);toast('문구 편집을 마쳤어요.');}}},true);
  $('#mockup-toggle').addEventListener('click',()=>{const panel=$('#mockup-panel');panel.hidden=!panel.hidden;$('#mockup-toggle').setAttribute('aria-expanded',String(!panel.hidden));});
  $('#mockup-edit-mode').addEventListener('change',e=>setEditMode(e.target.checked));
  $('#mockup-color').addEventListener('input',e=>{state.color=e.target.value;applyDesign();persist();});
  $('#mockup-radius').addEventListener('input',e=>{state.radius=Number(e.target.value);applyDesign();persist();});
  window.addEventListener('hashchange',render);window.addEventListener('resize',scaleReports);
  matchMedia('(max-width:1023px)').addEventListener('change', e => { $('.app-layout').classList.toggle('mockup-nav-collapsed',e.matches);$('.nav-open-button').hidden=!e.matches; });
  function scaleReports(){ const viewport=$('.configured-report-viewport');if(!viewport)return;const pages=$('.configured-report-pages');const scale=Math.min(1,viewport.clientWidth/794);pages.style.setProperty('--configured-report-scale',scale); }
  function prepareConfiguration(){
    $('[data-config-recipient]').textContent=state.recipients[recipient].name;
    const labels=state.configuration[recipient]||['자유 메모','사회 · 정서','학습 · 활동','건강 · 안전','특이사항'];
    $('[data-config-labels]').innerHTML=labels.map((label,i)=>`<div class="field"><span class="field-heading"><label for="configuration-label-${i}">${i+1}번째 이름</label> <small class="field-limit" id="configuration-label-${i}-limit">${label.length}/12자</small></span><input id="configuration-label-${i}" maxlength="12" aria-describedby="configuration-label-${i}-limit" value="${escapeHTML(label)}"></div>`).join('');
    $('[data-config-quick]').innerHTML=getQuickChecks().map((q,i)=>`<article class="configuration-card"><header><div><strong>${escapeHTML(q.name)}</strong><span>${q.active?'일지에 표시 중':'일지에서 숨김'}</span></div><div><button class="button tertiary" type="button" data-action="edit-quick-check" data-index="${i}">편집</button></div></header><div class="journal-quick-checks configuration-preview">${quickPreview(q,i,true)}</div></article>`).join('');
    configSnapshot=JSON.stringify(labels);
  }
  let configSnapshot='',quickDraft=null,quickIndex=null,quickSnapshot='',scoreDraft=null,scoreSnapshot='';
  const copy=value=>JSON.parse(JSON.stringify(value));
  function getQuickChecks(index=recipient){
    return state.quickChecks[index]||quickFields.map(([name,choices],i)=>({name,type:'선택형',multiple:i===4,active:true,choices:choices.map(name=>({name,active:true})),min:'',max:'',unit:'',maxLength:500}));
  }
  function quickPreview(q,i,preview){
    const prefix=preview?'preview':'quick',id=`${prefix}-${i}`;
    const attrs=`id="${id}" aria-label="${escapeHTML(q.name)}"`;
    let input='';
    if(q.type==='선택형')input=`<div class="journal-choice-chips" style="--chip-cols:2">${q.choices.filter(c=>c.active).map((c,j)=>`<label><input class="sr-only" type="${q.multiple?'checkbox':'radio'}" name="${id}" id="${id}-${j}" value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</label>`).join('')}</div>`;
    else if(q.type==='텍스트')input=`<textarea ${attrs} rows="3" maxlength="${q.maxLength||500}" placeholder="내용을 입력해 주세요"></textarea>`;
    else if(q.type==='척도') {const min=Number(q.min||1),max=Number(q.max||5);input=`<div class="journal-choice-chips" style="--chip-cols:${Math.min(max-min+1,5)}">${Array.from({length:Math.max(1,Math.min(11,max-min+1))},(_,j)=>`<label><input class="sr-only" type="radio" name="${id}" id="${id}-${j}">${min+j}</label>`).join('')}</div>`;}
    else input=`<div class="mockup-quick-number"><input ${attrs} type="${q.type==='시각'?'time':'number'}" ${q.type==='숫자'||q.type==='시간 길이'?`min="${q.min||0}" ${q.max!==''?`max="${q.max}"`:''}`:''} placeholder="입력">${q.unit?`<span>${escapeHTML(q.unit)}</span>`:q.type==='시간 길이'?'<span>분</span>':''}</div>`;
    return `<fieldset class="quick-check-field"><legend><span>${escapeHTML(q.name)}</span>${q.multiple&&q.type==='선택형'?'<span class="field-limit">여러 개 선택</span>':''}</legend>${input}</fieldset>`;
  }
  function configurationDirty(){return route==='/settings/configuration'&&$('#configuration-form')&&JSON.stringify($$('#configuration-form input').map(x=>x.value))!==configSnapshot;}
  function confirmDiscard(callback,message='닫으면 저장하지 않은 변경이 사라집니다.') {dialog('저장하지 않은 변경을 버릴까요?',`<p>${escapeHTML(message)}</p>`,'버리고 닫기',callback);}
  function editorDialog(id,className,title,body){
    closePopups();let el=document.getElementById(id);
    if(!el){el=document.createElement('dialog');el.id=id;document.body.append(el);el.addEventListener('cancel',e=>{e.preventDefault();closeEditorDialog(id);});}
    el.className=className;el.setAttribute('aria-labelledby',id+'-title');
    el.innerHTML=`<header class="${id==='consent-dialog'?'mockup-consent-header':className+'-header'}"><div><h2 id="${id}-title">${title}</h2>${id==='scoring-dialog'?'<p>변경한 기준은 새로 생성하는 리포트부터 적용돼요. 기존 리포트는 바뀌지 않아요.</p>':''}</div><button type="button" class="button tertiary" data-action="close-modal" data-modal="${id}">닫기</button></header>${body}`;
    if(!el.open)el.showModal();else if(!el.contains(document.activeElement))$('button',el)?.focus();return el;
  }
  function closeEditorDialog(id){
    closePopups();const modal=document.getElementById(id);
    let dirty=false;
    if(id==='quick-dialog'){readQuickDraft();dirty=JSON.stringify(quickDraft)!==quickSnapshot;}
    if(id==='scoring-dialog'){readScoreDraft();dirty=JSON.stringify(scoreDraft)!==scoreSnapshot;}
    if(dirty)confirmDiscard(()=>modal.close());else modal.close();
  }
  function openQuickEditor(index=null){
    quickIndex=index;quickDraft=copy(index===null?{name:'',type:'선택형',multiple:false,active:true,choices:[],min:'',max:'',unit:'',maxLength:500}:getQuickChecks()[index]);
    quickSnapshot=JSON.stringify(quickDraft);drawQuickEditor();
  }
  function readQuickDraft(){
    const form=$('#quick-edit-form');if(!form)return;
    quickDraft.name=$('#quick-name').value;quickDraft.multiple=$('#quick-multiple')?.checked||false;
    for(const key of ['min','max','unit','maxLength'])if($('#quick-'+key))quickDraft[key]=$('#quick-'+key).value;
    $$('[data-choice-input]',form).forEach(el=>quickDraft.choices[Number(el.dataset.choiceInput)].name=el.value);
  }
  function drawQuickEditor(){
    const q=quickDraft;
    const field=(key,label,type='text',maxLength)=>`<div class="field"><span class="field-heading"><label for="quick-${key}">${label}</label>${maxLength?`<small class="field-limit" id="quick-${key}-limit">${String(q[key]||'').length}/${maxLength}자</small>`:''}</span><input id="quick-${key}" type="${type}" ${maxLength?`maxlength="${maxLength}" aria-describedby="quick-${key}-limit"`:''} value="${escapeHTML(q[key]??'')}" ${key==='name'?'required placeholder="예: 기분"':''}></div>`;
    let extra=q.type==='선택형'?`<fieldset class="choice-mode"><legend>선택 방식</legend><label><input type="radio" name="quick-mode" ${!q.multiple?'checked':''}> 하나만 선택</label><label><input type="radio" id="quick-multiple" name="quick-mode" ${q.multiple?'checked':''}> 여러 개 선택</label></fieldset>`:q.type==='숫자'||q.type==='척도'?field('min',q.type==='척도'?'최솟값 (기본 1)':'최솟값','number')+field('max',q.type==='척도'?'최댓값 (기본 5, 눈금 11칸까지)':'최댓값','number')+(q.type==='숫자'?field('unit','단위','text',10):''):q.type==='텍스트'?field('maxLength','최대 글자 수','number'):'';
    const options=q.type==='선택형'?`<section class="quick-check-options"><h3>선택 항목</h3><ul>${q.choices.map((c,i)=>`<li class="${c.active?'':'is-inactive'}"><span>${escapeHTML(c.name)}</span><small>${c.active?'켜짐':'꺼짐'}</small><div><button class="inline-button" type="button" data-action="quick-option-edit" data-index="${i}">고치기</button><button class="inline-button" type="button" data-action="quick-option-toggle" data-index="${i}">${c.active?'끄기':'켜기'}</button></div></li>`).join('')}</ul><button class="button tertiary" type="button" data-action="quick-option-add">+ 항목 추가</button><div data-quick-option-editor></div></section>`:'';
    editorDialog('quick-dialog','configuration-dialog',quickIndex===null?'퀵체크 직접 만들기':'퀵체크 편집',`<div class="configuration-dialog-body"><section class="quick-check-view quick-check-detail">${quickIndex!==null?`<header class="quick-check-detail-header"><span class="quick-check-type">${q.type}</span><h2>${escapeHTML(q.name)}</h2><p>${q.active?'일지 화면에 표시 중':'일지 화면에서 숨김'}</p><button class="button tertiary" type="button" data-action="quick-toggle">일지 화면에서 ${q.active?'끄기':'켜기'}</button></header>`:''}<form class="quick-check-form" id="quick-edit-form"><h2>섹션 설정</h2><div class="quick-check-form-grid">${field('name','섹션 이름','text',30)}<div class="field"><label>입력 방식</label><div class="dropdown"><button class="dropdown-trigger" type="button" data-options="quick-type" aria-label="입력 유형" aria-haspopup="listbox" aria-expanded="false"><span>${q.type}</span></button></div></div>${extra}</div>${options}<p class="mockup-quick-help" role="status" data-quick-error></p><div class="quick-check-form-actions"><button type="button" class="button secondary" data-action="close-modal" data-modal="quick-dialog">취소</button><button class="button primary" type="submit">${quickIndex===null?'섹션 추가':'변경 저장'}</button></div></form></section></div>`);
  }
  function quickOptionEditor(index){
    readQuickDraft();const target=$('[data-quick-option-editor]');
    target.innerHTML=`<div class="mockup-quick-option-form"><input id="quick-option-name" aria-label="선택 항목 이름" maxlength="30" value="${escapeHTML(index===null?'':quickDraft.choices[index].name)}" placeholder="항목 이름"><button type="button" class="button primary" data-action="quick-option-save" data-index="${index??''}">${index===null?'추가':'저장'}</button><button type="button" class="button secondary" data-action="quick-option-cancel">취소</button></div>`;$('#quick-option-name').focus();
  }
  function saveQuick(){
    readQuickDraft();const q=quickDraft; q.name=q.name.trim();let error='';
    if(!q.name)error='섹션 이름을 입력해 주세요.';
    else if(q.type==='선택형'&&!q.choices.some(c=>c.active))error='선택 항목을 하나 이상 추가하거나 켜 주세요.';
    else if(['숫자','척도'].includes(q.type)&&q.min!==''&&q.max!==''&&Number(q.min)>Number(q.max))error='최댓값은 최솟값보다 크거나 같아야 해요.';
    else if(q.type==='척도'&&(!Number.isInteger(Number(q.min||1))||!Number.isInteger(Number(q.max||5))||Number(q.max||5)<Number(q.min||1)||Number(q.max||5)-Number(q.min||1)>10))error='척도는 최솟값부터 최댓값까지 정수로, 눈금 11칸 이내로 설정해 주세요.';
    else if(q.type==='텍스트'&&(!Number.isInteger(Number(q.maxLength))||q.maxLength<1||q.maxLength>2000))error='최대 글자 수는 1~2000 사이의 정수로 설정해 주세요.';
    if(error){$('[data-quick-error]').textContent=error;return;}
    const items=copy(getQuickChecks());if(quickIndex===null)items.push(copy(q));else items[quickIndex]=copy(q);
    state.quickChecks[recipient]=items;persist();$('#quick-dialog').close();prepareConfiguration();toast('퀵체크를 저장했어요.');
  }
  function scoreSeed(template=2){
    const base=REPORT_AREAS.map(a=>({name:a[0],questions:[...a[4]]}));
    if(template<2)return {title:reportTemplates[template],domains:copy(SCORE_TEMPLATE_DOMAINS[template])};
    return {title:reportTemplates[2],domains:base};
  }
  function openScoring(){scoreDraft=copy(state.scoring[detailRecipient]||scoreSeed());scoreSnapshot=JSON.stringify(scoreDraft);drawScoring();}
  function readScoreDraft(){
    if(!$('#score-edit-form'))return;
    scoreDraft.title=$('#score-template-title').value;
    scoreDraft.domains.forEach((domain,i)=>{domain.name=$('#score-domain-title-'+i).value;domain.questions=$$(`[data-score-question="${i}"]`).map(el=>el.value);});
  }
  function drawScoring(){
    const domains=scoreDraft.domains,total=domains.reduce((n,d)=>n+d.questions.length,0);
    const card=(d,i)=>`<article class="score-domain-card"><div class="score-domain-head"><div class="score-domain-field"><label class="sr-only" for="score-domain-title-${i}">${i+1}번째 영역명</label><input id="score-domain-title-${i}" maxlength="40" value="${escapeHTML(d.name)}" aria-describedby="score-domain-title-${i}-limit"></div><span class="field-limit score-domain-limit" id="score-domain-title-${i}-limit">${d.name.length}/40자</span><button type="button" class="score-domain-delete icon-button" data-action="score-delete-domain" data-index="${i}" aria-label="${escapeHTML(d.name)} 영역 삭제"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12ZM8 9h8v10H8V9Zm7.5-5-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div><details class="score-domain-details" open><summary><span>${d.questions.length}문항</span></summary><ol class="score-question-list">${d.questions.map((q,j)=>`<li><span>${j+1}</span><div><label class="sr-only" for="score-question-${i}-${j}">${escapeHTML(d.name)} ${j+1}번 문항</label><textarea id="score-question-${i}-${j}" data-score-question="${i}" maxlength="80" rows="2" aria-describedby="score-question-${i}-${j}-limit">${escapeHTML(q)}</textarea><small class="field-limit score-input-limit" id="score-question-${i}-${j}-limit">${q.length}/80자</small></div><button class="button tertiary" type="button" data-action="score-delete-question" data-index="${i}" data-question="${j}" aria-label="${escapeHTML(d.name)} ${j+1}번 문항 삭제">삭제</button></li>`).join('')}</ol><button class="score-question-add" type="button" data-action="score-add-question" data-index="${i}" ${d.questions.length>=15?'disabled':''}>맞춤 문항 추가 (${d.questions.length}/15)</button></details></article>`;
    editorDialog('scoring-dialog','score-criteria-dialog','리포트 채점 문항',`<form id="score-edit-form"><div class="score-criteria-summary"><div class="score-template-title-field"><label class="sr-only" for="score-template-title">템플릿 이름</label><input id="score-template-title" maxlength="40" value="${escapeHTML(scoreDraft.title)}" aria-describedby="score-template-title-limit"><small class="field-limit score-input-limit" id="score-template-title-limit">${scoreDraft.title.length}/40자</small></div><strong>현재 문항 <span>${total}개</span></strong><div class="score-criteria-help"><button type="button" data-action="score-help" aria-label="리포트 사용 기준 도움말" aria-expanded="false" aria-controls="score-help"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg></button><p id="score-help" role="tooltip">영역당 최대 15문항, 문항당 80자예요. 저장은 초안으로 가능하고, 리포트는 영역 3~5개와 영역별 문항 5개 이상이 필요해요.</p></div></div><div class="score-criteria-body"><div class="score-criteria-list">${[0,1].map(col=>`<div class="score-domain-column">${domains.map((d,i)=>i%2===col?card(d,i):'').join('')}</div>`).join('')}</div><button type="button" class="button secondary mockup-score-add" data-action="score-add-domain" ${domains.length>=5?'disabled':''}>+ 영역 추가 (${domains.length}/5)</button></div><footer class="score-criteria-dialog-footer"><div class="score-template-actions"><div class="score-template-control"><label class="score-template-label">템플릿 변경</label><div class="dropdown"><button type="button" class="dropdown-trigger" data-options="score-templates" aria-label="채점 기준 템플릿" aria-haspopup="listbox" aria-expanded="false"><span>${escapeHTML(scoreDraft.title)}</span></button></div></div><button class="button tertiary" type="button" data-action="score-reset">초기화</button></div><div class="score-criteria-save"><p class="score-criteria-save-status" role="status" data-score-status></p><button class="button primary" type="submit">저장</button></div></footer></form>`);
  }
  function saveScoring(){
    readScoreDraft();if(!scoreDraft.title.trim()){$('[data-score-status]').textContent='템플릿 이름을 입력해 주세요.';$('#score-template-title').focus();return;}
    state.scoring[detailRecipient]=copy(scoreDraft);state.reportTemplates[detailRecipient]=scoreDraft.title;persist();scoreSnapshot=JSON.stringify(scoreDraft);
    $('[data-score-status]').textContent='저장했어요. 새 리포트부터 적용돼요.';
  }
  function prepareSettings(){
    const list=$('.inactive-recipient-list');
    if(list)list.innerHTML=state.recipients.map((r,i)=>!r.active&&!r.deleted?`<li><strong>${escapeHTML(r.name)}</strong><div class="inactive-recipient-actions"><button type="button" class="button primary" data-action="reactivate" data-index="${i}">다시 활성화</button><button type="button" class="button danger-soft" data-action="account-preview" data-index="${i}">완전삭제</button></div></li>`:'').join('')||'<li>비활성화된 관리대상이 없어요.</li>';
    const consent=$('[data-action="ai-consent"]');
    if(consent){consent.textContent=state.aiConsent?'동의 철회':'안내 문구 보고 동의하기';$('dd',consent.closest('section')).textContent=state.aiConsent?'동의함':'안내 문구가 바뀌어 다시 동의가 필요해요';}
  }
  function openConsent(){
    const modal=editorDialog('consent-dialog','confirm-dialog consent-dialog','AI 기능을 쓰기 전에 알려드려요',`<p>일지 내용을 AI 서비스로 보내 문장을 다듬고, 한 주의 기록을 채점·요약한 리포트를 만들어요. 동의하지 않아도 일지를 직접 쓰고 저장할 수 있어요.</p><p class="mockup-preview-note">로컬 목업의 동의 화면 예시예요. 외부 전송이나 실제 동의 등록은 일어나지 않아요.</p><fieldset class="consent-items"><legend>내용을 확인하고 선택해 주세요</legend><div class="consent-item"><input type="checkbox" id="consent-data"><div><label for="consent-data">AI 처리를 위한 일지 내용 전송에 동의해요</label><p>작성한 메모와 기록 내용이 구글의 AI 서비스로 전송되어 처리돼요.</p></div></div><div class="consent-item"><input type="checkbox" id="consent-check"><div><label for="consent-check">AI 결과를 확인한 뒤 사용해요</label><p>AI 결과는 틀릴 수 있어요. 저장하기 전에 내용을 확인해 주세요.</p></div></div></fieldset><div class="dialog-actions"><button type="button" class="button secondary" data-action="close-modal" data-modal="consent-dialog">직접 쓸게요</button><button type="button" class="button primary" data-action="accept-consent" disabled>동의하고 켜기</button></div>`);
    modal.addEventListener('change',()=>{$('[data-action="accept-consent"]',modal).disabled=!$$('.consent-items input',modal).every(x=>x.checked);});
  }
  function accountDialog(button){
    const label=button.textContent.trim(),isSession=!!button.closest('.session-list'),all=label==='다른 기기 모두 로그아웃';
    let title='로그아웃할까요?',message='현재 브라우저에 보관된 로그인 세션이 삭제됩니다.',confirm='로그아웃';
    if(button.getAttribute('aria-label')?.includes('세션')||isSession){title='선택한 기기에서 로그아웃할까요?';message='선택한 기기의 로그인이 즉시 해제돼요.';}
    if(all){title='다른 기기에서 모두 로그아웃할까요?';message='현재 브라우저를 제외한 모든 기기의 로그인이 해제돼요.';}
    if(label==='계정 탈퇴'){title='계정 탈퇴를 신청할까요?';message='모든 기기에서 즉시 로그아웃되고 다시 로그인할 수 없어요. 기록은 30일 후 완전히 삭제돼요.';confirm='탈퇴 신청';}
    if(label==='완전삭제'){const name=state.recipients[Number(button.dataset.index)]?.name||'이지훈';title=`「${name}」 관리대상을 완전삭제할까요?`;message=`「${name}」의 관리대상 정보·일지(휴지통 포함)·리포트·퀵체크·템플릿이 모두 삭제되고 복원할 수 없어요. 백업본은 기존 보관 기간이 지나면 삭제돼요.`;confirm='완전삭제';}
    dialog(title,`<p>${escapeHTML(message)}</p>`,confirm,()=>{
      if(label==='완전삭제'){state.recipients[Number(button.dataset.index)].deleted=true;persist();prepareSettings();}
      else if(button.getAttribute('aria-label')?.includes('세션'))button.closest('li')?.remove();
      else if(all)$$('.session-list li').filter(li=>!$('.session-badge',li)).forEach(li=>li.remove());
      toast('목업에서 확인했어요. 실제 계정과 데이터는 변경되지 않아요.');
    },true);
  }
  function handlePopupAction(action,button,e){
    if(action==='confirm-dialog'){const callback=confirmAction;confirmAction=null;$('#mockup-dialog').close();callback?.();}
    else if(action==='close-modal')closeEditorDialog(button.dataset.modal);
    else if(action==='new-quick-check')openQuickEditor();
    else if(action==='edit-quick-check')openQuickEditor(Number(button.dataset.index));
    else if(action==='quick-toggle'){readQuickDraft();quickDraft.active=!quickDraft.active;drawQuickEditor();}
    else if(action==='quick-option-add')quickOptionEditor(null);
    else if(action==='quick-option-edit')quickOptionEditor(Number(button.dataset.index));
    else if(action==='quick-option-toggle'){readQuickDraft();const item=quickDraft.choices[Number(button.dataset.index)];item.active=!item.active;drawQuickEditor();}
    else if(action==='quick-option-cancel')$('[data-quick-option-editor]').replaceChildren();
    else if(action==='quick-option-save'){
      const input=$('#quick-option-name'),name=input.value.trim();if(!name){input.focus();return true;}
      if(quickDraft.choices.some((c,i)=>c.name===name&&String(i)!==button.dataset.index)){input.setCustomValidity('같은 이름의 항목이 있어요.');input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return true;}
      readQuickDraft();if(button.dataset.index==='')quickDraft.choices.push({name,active:true});else quickDraft.choices[Number(button.dataset.index)].name=name;drawQuickEditor();
    }
    else if(action==='scoring')openScoring();
    else if(action==='score-help')button.setAttribute('aria-expanded',button.getAttribute('aria-expanded')!=='true');
    else if(action==='score-reset')dialog('채점 문항을 초기화할까요?','<p>영역명과 문항을 기본 템플릿으로 되돌려요. 저장 전까지 기존 기준은 유지돼요.</p>','초기화',()=>{scoreDraft=scoreSeed();drawScoring();});
    else if(action==='score-add-domain'){readScoreDraft();scoreDraft.domains.push({name:'새 영역',questions:[]});drawScoring();$('#score-domain-title-'+(scoreDraft.domains.length-1)).focus();}
    else if(action==='score-delete-domain'){readScoreDraft();const i=Number(button.dataset.index);dialog('영역을 삭제할까요?',`<p>「${escapeHTML(scoreDraft.domains[i].name)}」의 문항도 함께 삭제돼요.</p>`,'삭제',()=>{scoreDraft.domains.splice(i,1);drawScoring();},true);}
    else if(action==='score-add-question'){readScoreDraft();const i=Number(button.dataset.index);scoreDraft.domains[i].questions.push('');drawScoring();$(`#score-question-${i}-${scoreDraft.domains[i].questions.length-1}`).focus();}
    else if(action==='score-delete-question'){readScoreDraft();scoreDraft.domains[Number(button.dataset.index)].questions.splice(Number(button.dataset.question),1);drawScoring();}
    else if(action==='ai-consent'){
      if(state.aiConsent)dialog('AI 기능 동의를 철회할까요?','<p>이제 일지 내용이 외부로 전송되지 않아요. 문장 다듬기·주간 리포트 생성이 함께 꺼져요. 이미 다듬어 저장한 일지는 그대로 남고, 언제든 다시 동의할 수 있어요.</p>','철회',()=>{state.aiConsent=false;persist();prepareSettings();},true);
      else openConsent();
    }
    else if(action==='accept-consent'){state.aiConsent=true;persist();$('#consent-dialog').close();if(route==='/settings')prepareSettings();toast('목업 안에서 AI 기능을 켰어요.');}
    else if(action==='ai-preview'){
      if(!state.aiConsent)openConsent();else dialog('AI로 다듬을까요?','<p>작성한 메모를 바탕으로 일지 문장을 다듬어요. 저장 전에 결과를 확인할 수 있어요.</p><p class="mockup-preview-note">이 목업에서는 입력한 내용을 결과 예시로 표시해요.</p>','다듬기',()=>dialog('다듬은 일지 확인',`<div class="mockup-dialog-fields"><label for="ai-result">일지 내용</label><textarea id="ai-result" rows="6" maxlength="300">${escapeHTML($('#journal-raw').value)}</textarea></div>`,'적용',()=>{$('#journal-raw').value=$('#ai-result').value;updateCounter($('#journal-raw'));captureDraft();}));
    }
    else if(action==='account-preview')accountDialog(button);
    else if(action==='reactivate'){const i=Number(button.dataset.index);dialog('관리대상을 다시 활성화할까요?',`<p>「${escapeHTML(state.recipients[i].name)}」을 홈과 기록 작성 목록에서 다시 볼 수 있어요.</p>`,'활성화',()=>{state.recipients[i].active=true;persist();prepareSettings();});}
    else if(action==='toggle-recipient'){const r=state.recipients[detailRecipient];dialog(r.active?'관리대상을 비활성화할까요?':'관리대상을 다시 활성화할까요?',`<p>${r.active?'홈과 기록 작성 목록에서 제외돼요. 기존 일지와 리포트는 보관돼요.':'홈과 기록 작성 목록에 다시 표시돼요.'}</p>`,r.active?'비활성화':'활성화',()=>{r.active=!r.active;persist();$('#recipient-dialog').close();renderRecipients();});}
    else if(action==='trash-report')dialog('리포트를 휴지통으로 옮길까요?','<p>30일 동안 휴지통에서 복원할 수 있어요.</p>','휴지통으로',()=>{state.reportRemoved||={};state.reportRemoved[recipient]=true;if(!state.trash.some(x=>x.type==='report'&&x.recipient===recipient))state.trash.push({type:'report',recipient,date:TODAY,title:'8월 28일 ~ 9월 3일 주간 리포트'});persist();render();toast('리포트를 휴지통으로 옮겼어요.');},true);
    else if(action==='restore-trash'){const i=Number(button.dataset.index);dialog('기록을 복원할까요?','<p>복원한 기록은 기록 목록에서 다시 볼 수 있어요.</p>','복원',()=>{const item=state.trash[i];if(item.type==='report')state.reportRemoved[item.recipient]=false;state.trash.splice(i,1);persist();renderRecords();});}
    else if(action==='delete-trash'){const i=Number(button.dataset.index);dialog('기록을 완전히 삭제할까요?','<p>완전히 삭제한 기록은 복원할 수 없어요.</p>','완전삭제',()=>{state.trash.splice(i,1);persist();renderRecords();},true);}
    else if(action==='generate-report'){
      if(reportDays()<3)return true;
      dialog('리포트를 생성할까요?',`<p>${escapeHTML(state.recipients[recipient].name)} · ${formatDate(reportRange.from)} ~ ${formatDate(reportRange.to)} · 기록 ${reportDays()}일 / 기준 3일.</p><p class="mockup-preview-note">이 목업에서는 생성 흐름만 확인할 수 있어요. 실제 AI 생성은 연결되지 않았어요.</p>`,'생성',()=>{
        if(isSampleReportPeriod()){
          state.reportRemoved||={};state.reportRemoved[recipient]=false;state.trash=state.trash.filter(x=>x.type!=='report'||x.recipient!==recipient);persist();render();
          toast('저장된 리포트 예시를 표시했어요.');
        }else toast('선택한 기간으로 생성 요청을 확인했어요. 실제 AI 생성은 연결되지 않았어요.');
      });
    }
    else if(action==='reset-design')dialog('편집 내용을 초기화할까요?','<p>수정한 문구와 스타일을 초기화해요. 저장한 일지와 관리대상은 유지돼요.</p>','초기화',()=>{state.edits={};delete state.css;delete state.color;delete state.radius;persist();location.reload();});
    else if(action==='plan'){e.preventDefault();dialog('스타터 요금제를 선택했어요','<p>월 14,900원 · 부가가치세 포함</p><p>유료 요금제 신청과 결제는 준비 중이에요.</p>');}
    else return false;
    return true;
  }
  function showStoredReport(){
    const tpl=$('#report-document');if(!tpl)return;
    $('.reports-layout').replaceChildren(tpl.content.cloneNode(true));
    const areas=REPORT_AREAS;
    $('[data-report-changes]').innerHTML=areas.map(([name,score])=>`<article class="configured-report-change-card"><strong>${name}</strong><em>비교하지 않음</em><div><b>${score}점</b></div><small>비교할 이전 주 점수가 없어요.</small></article>`).join('');
    $('[data-report-care]').insertAdjacentHTML('beforeend',areas.map(([name,score,evidence,copy])=>`<article class="configured-report-care-card"><div><strong>${name}</strong><b>${score}점</b></div><em>판정 5/5 · 근거 ${evidence}/5</em><p>${copy}</p></article>`).join(''));
    $('[data-report-questions]').innerHTML=areas.map(([name,score,evidence,copy,questions,scores])=>`<section><h3>${name}</h3><ol>${questions.map((question,i)=>`<li><p>${question}</p><span>${scores[i]===4?'반복 확인 · 100% · 획득 점수 20/20점 · 근거 2일':scores[i]===3?'명확한 수행 · 75% · 획득 점수 15/20점 · 근거 1일':'근거 없음 · 0점 · 영역 내 배점 0/20점'}</span></li>`).join('')}</ol></section>`).join('');
  }
  const SCORE_TEMPLATE_DOMAINS=[
    [
      {name:'신체운동·건강',questions:['몸을 움직이는 놀이와 활동에 즐겁게 참여한다.','이동할 때 몸의 균형과 방향을 상황에 맞게 조절한다.','공과 도구를 손과 눈을 함께 사용해 조작한다.','손가락과 손을 사용하는 놀이에 지속해서 참여한다.','식사와 간식 시간에 건강한 생활 습관을 실천한다.','휴식이 필요할 때 쉬거나 몸의 상태를 표현한다.','손 씻기 등 기본 위생 일과에 참여한다.','안전한 놀이 방법과 생활 약속을 이해하고 따른다.','위험할 수 있는 장소나 물건을 알아차리고 조심한다.','교통과 이동 상황에서 필요한 안전 행동을 시도한다.','아프거나 다쳤을 때 도움을 요청하거나 성인 안내를 따른다.','실내외에서 자신과 다른 사람의 몸을 안전하게 조절한다.']},
      {name:'의사소통',questions:['상대의 말과 소리에 관심을 보이며 듣는다.','일상적인 안내를 이해하고 자신의 방식으로 반응한다.','자신의 생각, 느낌, 요구를 말·몸짓·그림 등으로 표현한다.','상대와 말이나 비언어 표현을 주고받는다.','놀이와 대화에서 차례를 지키며 말한다.','상대에게 부탁하거나 거절할 때 적절한 표현을 사용한다.','그림, 기호, 표식에서 의미를 찾아본다.','자신의 이름이나 익숙한 글자에 관심을 보인다.','그림책과 이야기 자료를 보고 내용을 이해하려 한다.','이야기의 다음 장면이나 결말을 생각해 본다.','그리기, 끄적이기, 표시하기 등 쓰기 활동을 즐긴다.','책과 이야기, 노래말을 일상 놀이에 활용한다.']},
      {name:'사회관계',questions:['자신의 이름, 좋아하는 것, 할 수 있는 일을 알아차리고 표현한다.','자신의 감정과 필요를 알아차리고 표현한다.','놀이와 생활에서 스스로 선택하고 시도한다.','가족과 익숙한 사람에게 관심과 애정을 표현한다.','또래에게 관심을 보이고 함께 놀이하려 한다.','다른 사람과 놀잇감, 공간, 차례를 나눈다.','공동생활에 필요한 약속과 규칙을 이해하고 지킨다.','자신과 다른 사람의 생각과 모습을 존중한다.','갈등 상황에서 말하거나 성인의 도움을 받아 해결을 시도한다.','소집단과 전체 활동에서 자신의 역할로 참여한다.','우리 주변의 사람과 직업, 기관에 관심을 보인다.','공동체의 구성원으로서 배려와 책임을 실천한다.']},
      {name:'예술경험',questions:['자연과 생활 속 색, 소리, 모양의 아름다움에 관심을 보인다.','감각으로 느낀 차이와 변화를 표현한다.','노래, 리듬, 움직임을 즐기며 표현한다.','그리기와 만들기 재료를 탐색하며 표현한다.','여러 재료와 도구를 자신의 생각에 맞게 사용한다.','상상한 장면이나 경험을 놀이와 작품으로 나타낸다.','음악, 미술, 움직임 활동에서 자기만의 방법을 시도한다.','다른 사람의 작품과 표현을 보고 관심을 보인다.','예술 작품이나 공연을 보고 느낀 점을 표현한다.','자신과 친구의 표현을 함께 즐기고 나눈다.']},
      {name:'자연탐구',questions:['주변의 사물과 현상에 호기심을 보인다.','감각과 도구를 사용해 사물과 재료를 탐색한다.','사물의 같음과 다름을 비교한다.','공통점에 따라 사물과 그림을 분류한다.','반복되는 모양, 소리, 움직임의 규칙을 찾아본다.','생활 속 수량과 수를 세고 비교한다.','위치와 공간 관계를 이해하며 표현한다.','길이, 무게, 크기 등 속성을 비교해 본다.','물체와 재료의 변화, 움직임, 원인을 관찰한다.','식물과 동물, 계절과 날씨의 변화에 관심을 보인다.','생명과 자연을 돌보고 존중하는 행동을 실천한다.','문제가 생기면 여러 방법으로 해결을 시도한다.','탐색한 결과를 말, 그림, 몸짓 등으로 기록하거나 나눈다.']}
    ],
    [
      {name:'국어',questions:['말하는 이를 바라보며 핵심 내용을 듣는다.','자신의 경험과 생각을 문장으로 표현한다.','글과 그림 자료에서 필요한 정보를 찾는다.','읽은 내용과 자신의 경험을 연결해 말한다.','목적에 맞게 짧은 글이나 그림으로 표현한다.']},
      {name:'수학',questions:['생활 속 수량을 세고 비교한다.','규칙을 찾아 다음 모양이나 수를 예상한다.','여러 방법으로 덧셈과 뺄셈 상황을 해결한다.','위치와 방향을 이해하고 표현한다.','길이와 들이, 무게를 비교해 본다.']},
      {name:'바른 생활',questions:['일과에 필요한 약속과 규칙을 지킨다.','자신과 다른 사람의 기분을 살피고 배려한다.','맡은 일을 끝까지 해 보려 한다.','안전한 생활 습관을 실천한다.']},
      {name:'슬기로운 생활',questions:['주변 사람과 장소, 일에 관심을 보인다.','계절과 날씨의 변화를 관찰한다.','관찰한 내용을 기준에 따라 분류한다.','궁금한 점을 탐색하며 해결 방법을 찾는다.']},
      {name:'즐거운 생활',questions:['노래와 움직임을 즐기며 표현한다.','미술 재료와 도구를 탐색해 표현한다.','놀이에 자신의 생각을 더해 참여한다.','친구의 표현을 보고 함께 즐긴다.']}
    ]
  ];
  const REPORT_AREAS=[
      ['국어',15,1,'이웃을 만났을 때 손을 흔드는 것과 함께 밝게 인사말을 건네보세요.', ['글의 중심 내용을 파악한다.','근거를 들어 자신의 의견을 말하거나 쓴다.','상대와 목적에 맞게 대화한다.','다양한 글과 매체를 비판적으로 이해한다.','읽은 내용을 요약하고 자신의 생각을 표현한다.'],[0,0,3,0,0]],
      ['수학',0,0,'이번 기록만으로는 조언을 제안하기 어려워요.', ['문제 상황에 맞는 계산 방법을 선택한다.','규칙과 관계를 식이나 표로 표현한다.','자료를 수집하고 표와 그래프로 나타낸다.','도형의 성질을 활용해 문제를 해결한다.','해결 과정을 설명하고 다른 방법을 비교한다.'],[0,0,0,0,0]],
      ['사회',20,1,'횡단보도를 건널 때 주변의 신호를 살피며 안전하게 이동하는 연습을 계속해 보세요.', ['공동체에서 지켜야 할 규칙과 책임을 이해한다.','사회 현상을 다양한 관점에서 살펴본다.','자료를 바탕으로 자신의 의견을 근거 있게 표현한다.','지역사회와 세계의 변화에 관심을 보인다.','협력하여 공동의 문제 해결에 참여한다.'],[4,0,0,0,0]],
      ['과학',35,2,'공원에서 관찰한 나무나 새의 특징을 그림으로 그려보거나 이름을 함께 찾아보세요. 주변의 쓰레기를 줍는 것처럼 자연을 깨끗하게 유지하는 활동을 꾸준히 실천해 보세요.', ['자연 현상에 대해 질문하고 관찰한다.','예상과 실험을 통해 탐구한다.','탐구 결과를 자료로 정리하고 설명한다.','과학 원리를 생활 문제에 적용한다.','환경과 생명을 존중하는 태도를 실천한다.'],[4,0,0,0,3]],
      ['예술·체육',70,4,'오리를 보며 숫자를 세어본 것처럼 주변 사물의 개수를 손가락으로 표현하며 놀이해 보세요. 산책할 때처럼 옆 사람과 보폭을 맞추며 걷는 활동을 즐겨보세요. 외출 후 손을 씻고 수건을 정리하는 습관을 스스로 계속 실천해 보세요.', ['음악과 미술, 움직임으로 생각과 느낌을 표현한다.','다양한 표현 방식을 감상하고 의견을 나눈다.','신체 활동에 꾸준히 참여하며 안전을 지킨다.','협력과 규칙이 필요한 활동에 참여한다.','건강한 생활 습관을 스스로 실천한다.'],[3,0,4,3,4]]
    ];
  applyDesign();render();
})();
