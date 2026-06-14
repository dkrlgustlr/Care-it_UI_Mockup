import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("care-it-ui-mockup.html", "utf8");
const mobileSection = html.match(/<section class="mobile-section">[\s\S]*?<section class="desktop-section">/)?.[0] || "";
const mobileViewsBlock = html.match(/const mobileParentViews = \{[\s\S]*?\n      \};/)?.[0] || "";
const mobileSurface = `${mobileSection}\n${mobileViewsBlock}`;
const settingsContent =
  mobileViewsBlock.match(/settings:\s*\{[\s\S]*?title: "내 설정"[\s\S]*?content:\s*`([\s\S]*?)`\s*,\s*\},/)?.[1] || "";
const journalWriteContent =
  mobileViewsBlock.match(/"journal-write":\s*\{[\s\S]*?title: "일지 작성"[\s\S]*?content:\s*`([\s\S]*?)`\s*,\s*\},/)?.[1] || "";
const journalDraftContent =
  mobileViewsBlock.match(/"journal-draft":\s*\{[\s\S]*?title: "정리된 일지 확인"[\s\S]*?content:\s*`([\s\S]*?)`\s*,\s*\},/)?.[1] || "";
const reportWriteContent =
  mobileViewsBlock.match(/"report-write":\s*\{[\s\S]*?title: "리포트 작성"[\s\S]*?content:\s*`([\s\S]*?)`\s*,\s*\},/)?.[1] || "";
const parentSummaryStyles = [...html.matchAll(/\.mobile-parent-summary[^{]*\{[^}]*\}/g)]
  .map((match) => match[0])
  .join("\n");
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
const rootStyles = css.match(/:root\s*\{[\s\S]*?\n\s*\}/)?.[0] || "";
const mobileCss = css.match(/\.mobile-frame[\s\S]*?\.dashboard-frame/)?.[0] || "";
const mobileFrameStyles = css.match(/\.mobile-frame\s*\{[^}]*\}/)?.[0] || "";
const mobileScreenStyles = css.match(/\.mobile-screen\s*\{[^}]*\}/)?.[0] || "";
const mobilePageStyles = css.match(/\.mobile-page\s*\{[^}]*\}/)?.[0] || "";
const mobileTopbarStyles = css.match(/\.mobile-topbar\s*\{[^}]*\}/)?.[0] || "";
const mobileTitleRowStyles = css.match(/\.mobile-title-row\s*\{[^}]*\}/)?.[0] || "";
const mobileContentStyles = css.match(/\.mobile-content\s*\{[^}]*\}/)?.[0] || "";
const primaryActionStyles = css.match(/\.primary-action\s*\{[^}]*\}/)?.[0] || "";
const quickCardStyles = css.match(/\.quick-card\s*\{[^}]*\}/)?.[0] || "";
const quickCardStrongStyles = css.match(/\.quick-card strong\s*\{[^}]*\}/)?.[0] || "";
const manageGridStyles = css.match(/\.mobile-manage-grid\s*\{[^}]*\}/)?.[0] || "";
const manageCardStyles = css.match(/\.mobile-manage-card\s*\{[^}]*\}/)?.[0] || "";
const manageCardStrongStyles = css.match(/\.mobile-manage-card strong\s*\{[^}]*\}/)?.[0] || "";
const manageCardSpanStyles = css.match(/\.mobile-manage-card span\s*\{[^}]*\}/)?.[0] || "";
const subjectCardStyles = css.match(/\.mobile-subject-card,\s*\.mobile-activity-item\s*\{[^}]*\}/)?.[0] || "";
const settingCardStyles = css.match(/\.mobile-setting-card\s*\{[^}]*\}/)?.[0] || "";
const formCardStyles = css.match(/\.mobile-form-card\s*\{[^}]*\}/)?.[0] || "";
const previewCardStyles = css.match(/\.mobile-preview-card\s*\{[^}]*\}/)?.[0] || "";
const quickRowStyles = css.match(/\.mobile-quick-row\s*\{[^}]*\}/)?.[0] || "";
const chipRowStyles = css.match(/\.mobile-chip-row\s*\{[^}]*\}/)?.[0] || "";
const bottomTabsStyles = css.match(/\.bottom-tabs\s*\{[^}]*\}/)?.[0] || "";
const createCardStyles = css.match(/\.mobile-create-card\s*\{[^}]*\}/)?.[0] || "";
const groupCreateCardStyles = css.match(/\.mobile-group-list \.mobile-create-card\s*\{[^}]*\}/)?.[0] || "";
const createCardHoverStyles = css.match(/\.mobile-create-card:hover\s*\{[^}]*\}/)?.[0] || "";
const createSymbolStyles = css.match(/\.mobile-create-symbol\s*\{[^}]*\}/)?.[0] || "";
const createTitleStyles = css.match(/\.mobile-create-card \.mobile-subject-title strong\s*\{[^}]*\}/)?.[0] || "";
const createDetailStyles = css.match(/\.mobile-create-card \.mobile-subject-title span\s*\{[^}]*\}/)?.[0] || "";
const createActionStyles = css.match(/\.mobile-create-card \.mobile-action-label\s*\{[^}]*\}/)?.[0] || "";
const referenceFlowStyles = [...css.matchAll(/\.mobile-reference-flow\s*\{[^}]*\}/g)]
  .map((match) => match[0])
  .join("\n");
const referenceFlowItemStyles = css.match(/\.mobile-reference-flow span\s*\{[^}]*\}/)?.[0] || "";

assert.ok(mobileSection, "mobile mockup section should be present");
assert.ok(mobileViewsBlock, "mobile parent view map should be present");
assert.ok(settingsContent, "mobile settings view should be present");
assert.ok(journalWriteContent, "mobile journal write flow should be present");
assert.ok(journalDraftContent, "mobile journal draft review flow should be present");
assert.ok(reportWriteContent, "mobile report write flow should be present");
assert.match(css, /--mobile-title-size:\s*22px;/, "mobile title font size token should be 22px");
assert.match(css, /--mobile-subtitle-size:\s*15px;/, "mobile subtitle font size token should be 15px");
assert.match(css, /--mobile-content-size:\s*13px;/, "mobile content font size token should be 13px");
for (const token of [
  "--mobile-screen-gutter",
  "--mobile-frame-padding",
  "--mobile-page-top",
  "--mobile-header-gap",
  "--mobile-section-gap",
  "--mobile-block-gap",
  "--mobile-card-padding",
  "--mobile-card-padding-compact",
  "--mobile-list-row-y",
  "--mobile-list-row-x",
  "--mobile-row-gap",
  "--mobile-chip-gap",
  "--mobile-control-padding-y",
  "--mobile-control-padding-x",
  "--mobile-tab-padding-y",
  "--mobile-tab-padding-bottom",
]) {
  assert.match(rootStyles, new RegExp(`${token}:`), `mobile spacing token should be defined: ${token}`);
}
assert.match(mobileFrameStyles, /padding:\s*var\(--mobile-frame-padding\) var\(--mobile-screen-gutter\) var\(--mobile-screen-gutter\);/, "mobile device frame should use the frame/gutter spacing tokens");
assert.match(mobilePageStyles, /padding:\s*var\(--mobile-page-top\) var\(--mobile-screen-gutter\) 0;/, "mobile page should use page top and gutter spacing tokens");
assert.match(mobileTopbarStyles, /margin-bottom:\s*var\(--mobile-header-gap\);/, "mobile topbar should use the header gap token");
assert.match(mobileTitleRowStyles, /gap:\s*var\(--mobile-block-gap\);[\s\S]*margin-bottom:\s*var\(--mobile-section-gap\);/, "mobile title row should use block and section gap tokens");
assert.match(mobileContentStyles, /gap:\s*var\(--mobile-section-gap\);[\s\S]*padding-bottom:\s*var\(--mobile-section-gap\);/, "mobile content should use the section gap token for vertical rhythm");
assert.match(primaryActionStyles, /gap:\s*var\(--mobile-row-gap\);[\s\S]*padding:\s*var\(--mobile-control-padding-y\) var\(--mobile-card-padding-compact\);/, "mobile primary actions should use row and control spacing tokens");
assert.match(quickCardStyles, /padding:\s*var\(--mobile-card-padding-compact\);/, "mobile quick cards should use the compact card padding token");
assert.match(manageCardStyles, /gap:\s*var\(--space-1\);[\s\S]*padding:\s*var\(--mobile-card-padding-compact\);/, "mobile management cards should use the compact card padding token");
assert.match(parentSummaryStyles, /padding:\s*var\(--mobile-card-padding\);/, "mobile summary cards should use the standard card padding token");
assert.match(subjectCardStyles, /gap:\s*var\(--mobile-row-gap\);[\s\S]*padding:\s*var\(--mobile-list-row-y\) var\(--mobile-list-row-x\);/, "mobile list rows should use row gap and list row padding tokens");
assert.match(settingCardStyles, /gap:\s*var\(--mobile-row-gap\);[\s\S]*padding:\s*var\(--mobile-list-row-y\) var\(--mobile-list-row-x\);/, "mobile setting rows should use the same row spacing tokens");
assert.match(formCardStyles, /gap:\s*var\(--mobile-block-gap\);[\s\S]*padding:\s*var\(--mobile-card-padding\);/, "mobile form cards should use block gap and card padding tokens");
assert.match(previewCardStyles, /gap:\s*var\(--space-2\);[\s\S]*padding:\s*var\(--mobile-card-padding\);/, "mobile preview cards should use the standard card padding token");
assert.match(quickRowStyles, /gap:\s*var\(--space-2\);[\s\S]*padding:\s*var\(--mobile-control-padding-y\) var\(--mobile-control-padding-x\);/, "mobile quick rows should use control padding tokens");
assert.match(chipRowStyles, /gap:\s*var\(--mobile-chip-gap\);/, "mobile chip rows should use the chip gap token");
assert.match(bottomTabsStyles, /margin:\s*auto calc\(var\(--mobile-screen-gutter\) \* -1\) 0;[\s\S]*padding:\s*var\(--mobile-tab-padding-y\) var\(--mobile-screen-gutter\) var\(--mobile-tab-padding-bottom\);/, "mobile bottom tabs should use gutter and tab padding tokens");
assert.match(css, /\.mobile-title\s*\{[\s\S]*?font-size:\s*var\(--mobile-title-size\)/, "mobile page title should use the title token");
assert.match(mobileScreenStyles, /background:\s*#f4f7f8;/, "mobile dashboard background should stay subtle and lightly separated from cards");
assert.match(css, /\.block-head h3\s*\{[\s\S]*?font-size:\s*var\(--mobile-subtitle-size\)/, "mobile section headings should use the subtitle token");
assert.match(css, /\.mobile-parent-summary strong\s*\{[\s\S]*?font-size:\s*var\(--mobile-subtitle-size\)/, "mobile summary headline should use the subtitle token");
assert.match(css, /\.mobile-parent-summary p\s*\{[\s\S]*?font-size:\s*var\(--mobile-content-size\)/, "mobile summary body should use the content token");
assert.match(quickCardStrongStyles, /font-size:\s*var\(--mobile-subtitle-size\)/, "mobile quick metric values should use the subtitle token");
assert.doesNotMatch(quickCardStrongStyles, /font-size:\s*var\(--mobile-title-size\)/, "mobile quick metric values should not use the page title token");
assert.match(manageGridStyles, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/, "mobile home management shortcuts should use a compact two-column grid");
assert.match(manageCardStyles, /background:\s*var\(--care-surface-raised\);/, "mobile home management shortcuts should read as cards");
assert.match(manageCardStrongStyles, /font-size:\s*var\(--mobile-subtitle-size\)/, "mobile management shortcut titles should use the subtitle token");
assert.match(manageCardSpanStyles, /font-size:\s*var\(--mobile-content-size\)/, "mobile management shortcut helper text should use the content token");
assert.match(css, /\.mobile-subject-title strong,\s*\.mobile-activity-title strong\s*\{[\s\S]*?font-size:\s*var\(--mobile-subtitle-size\)/, "mobile list item titles should use the subtitle token");
assert.match(css, /\.mobile-subject-title span,\s*\.mobile-activity-title span\s*\{[\s\S]*?font-size:\s*var\(--mobile-content-size\)/, "mobile list item details should use the content token");
assert.doesNotMatch(mobileCss, /font-size:\s*var\(--font-/, "mobile typography should use the mobile title/subtitle/content tokens");
assert.doesNotMatch(mobileCss, /font-size:\s*\d+px/, "mobile typography should avoid one-off pixel font sizes");
assert.doesNotMatch(mobileCss, /animation:\s*(?!none\b)[^;]+;/, "mobile UI should not use fade-in or entrance animations");
assert.match(createCardStyles, /grid-template-columns:\s*32px minmax\(0,\s*1fr\) auto;/, "mobile write entry cards should have a dedicated icon-title-action layout");
assert.match(createCardStyles, /background:\s*var\(--care-primary\);/, "mobile write entry cards should use a full green action surface");
assert.match(groupCreateCardStyles, /background:\s*var\(--care-primary\);/, "mobile grouped write entry cards should stay green before hover");
assert.match(groupCreateCardStyles, /border-radius:\s*var\(--radius-md\);/, "mobile grouped write entry cards should keep the rounded action-card shape");
assert.match(createCardHoverStyles, /background:\s*var\(--care-primary-dark\);/, "mobile write entry cards should keep a darker green hover state");
assert.doesNotMatch(createCardStyles, /border-left/, "mobile write entry cards should not use the rejected vertical side accent");
assert.match(createSymbolStyles, /background:\s*rgba\(255,\s*255,\s*255,\s*0\.18\);/, "mobile write entry plus symbols should sit on the green card without adding another green badge");
assert.match(createSymbolStyles, /color:\s*#ffffff;/, "mobile write entry plus symbols should be white");
assert.match(createTitleStyles, /color:\s*#ffffff;/, "mobile write entry titles should be white");
assert.match(createDetailStyles, /color:\s*rgba\(255,\s*255,\s*255,\s*0\.82\);/, "mobile write entry helper text should be white with a softer emphasis");
assert.match(createActionStyles, /color:\s*#ffffff;/, "mobile write entry action labels should be white");
assert.match(referenceFlowStyles, /grid-template-columns:\s*1fr;/, "mobile report support flow should stack as a calm list, not three mismatched pills");
assert.match(referenceFlowStyles, /border-top:\s*1px solid var\(--care-border\);/, "mobile report support flow should use the same subtle divider language as nearby content");
assert.match(referenceFlowItemStyles, /background:\s*transparent;/, "mobile report support flow items should not look like standalone green buttons");
assert.doesNotMatch(referenceFlowItemStyles, /background:\s*var\(--care-mint-soft\)|place-items|border-radius/, "mobile report support flow items should avoid the mismatched pill treatment");
assert.doesNotMatch(parentSummaryStyles, /border-left/, "mobile parent summary should not use a vertical side accent");
assert.doesNotMatch(parentSummaryStyles, /--care-primary/, "mobile parent summary should not use the green accent-card treatment");

assert.match(mobileSection, /<h1 class="mobile-title">오늘 돌봄<\/h1>/, "mobile home should open as a parent-facing daily view");
assert.doesNotMatch(mobileSection, />보호자 공유</, "mobile home dashboard should not show the guardian-sharing eyebrow");
assert.match(mobileViewsBlock, /home:\s*\{[\s\S]*?eyebrow:\s*""/, "mobile home view should keep the dashboard eyebrow empty");
assert.match(html, /mobileEyebrow\.hidden\s*=\s*!view\.eyebrow/, "mobile view renderer should hide an empty eyebrow");
assert.match(mobileSection, /mobile-parent-summary/, "mobile home should lead with one concise parent summary");
assert.match(mobileSection, /<h3>\uAD00\uB9AC<\/h3>/, "mobile home should include a simple management section");
assert.match(mobileSection, /<button class="mobile-manage-card" type="button" data-mobile-open-tab="journal">[\s\S]*<strong>\uC77C\uC9C0 \uAD00\uB9AC<\/strong>[\s\S]*<span>\uC791\uC131\u00B7\uD655\uC778<\/span>/, "mobile home should link to journal management");
assert.match(mobileSection, /<button class="mobile-manage-card" type="button" data-mobile-open-tab="report">[\s\S]*<strong>\uB9AC\uD3EC\uD2B8 \uAD00\uB9AC<\/strong>[\s\S]*<span>\uC791\uC131\u00B7\uBCF4\uAE30<\/span>/, "mobile home should link to report management");
assert.match(mobileSection, /김도윤 오늘 요약/, "mobile summary should use a short subject label");
assert.match(mobileSection, /점심 완식 · 휴식 후 재참여/, "mobile summary should expose a short concrete daily status");
assert.doesNotMatch(mobileSection, />확인할 기록 1건</, "mobile summary should not show extra helper metadata");
assert.doesNotMatch(mobileSection, /활동 보통 · 수면 보통/, "mobile status card should not show extra helper detail text");
assert.doesNotMatch(mobileSection, /리포트는 준비 중/, "mobile weekly card should not show extra helper detail text");
assert.doesNotMatch(mobileSection, /점심은 완식했고/, "mobile summary should not use a long sentence");
assert.doesNotMatch(mobileSurface, /긴 설명보다 오늘 상태와 변화만 먼저 볼 수 있게 모았습니다\./, "mobile records summary should not show the extra explanatory sentence");
assert.doesNotMatch(mobileSurface, /확인할 기록 1건을 마치면 리포트가 공유됩니다\./, "mobile report summary should not show the extra explanatory sentence");
assert.match(mobileSection, /data-mobile-tab="journal"[\s\S]*<span>기록<\/span>/, "journal tab should be labeled as parent-friendly records");
const weeklyReportCard = mobileSection.match(/<div class="mobile-subject-card" data-mobile-view="report-write">[\s\S]*?<\/div>/)?.[0] || "";
assert.ok(weeklyReportCard, "mobile weekly report should use the same subject-card treatment as the surrounding list");
assert.match(weeklyReportCard, /<strong>5월 2주차 리포트<\/strong>/, "mobile weekly report should keep the report title");
assert.match(weeklyReportCard, /준비 중 · 기록 5건 중 1건 확인 필요/, "mobile weekly report status should sit in the helper line");
assert.match(weeklyReportCard, /기록 5건 중 1건 확인 필요/, "mobile weekly report helper text should be shorter");
assert.match(weeklyReportCard, /<span class="mobile-action-label">보기<\/span>/, "mobile weekly report action should be shortened");
assert.doesNotMatch(mobileSection, /<span class="time">준비 중<\/span>|mobile-report-card|리포트 보기/, "mobile weekly report should not use a unique pill-card treatment");
assert.doesNotMatch(css, /\.mobile-report-card/, "mobile weekly report should not define a separate visual treatment");

const homeQuickCardCount = (mobileSection.match(/class="quick-card"/g) || []).length;
assert.ok(homeQuickCardCount <= 2, `mobile home should keep quick metrics concise, found ${homeQuickCardCount}`);

assert.doesNotMatch(mobileSection, /<button class="primary-action"[^>]*data-mobile-view="journal-write"/, "mobile home should not show a large write CTA");
assert.match(mobileViewsBlock, /class="mobile-subject-card mobile-create-card"[^>]*data-mobile-view="journal-write"[\s\S]*<span class="mobile-create-symbol" aria-hidden="true">\+<\/span>[\s\S]*<span class="mobile-action-label">\uC2DC\uC791<\/span>/, "mobile journal writing entry should open the same write flow as PC");
assert.match(mobileViewsBlock, /class="mobile-subject-card mobile-create-card"[^>]*data-mobile-view="report-write"[\s\S]*<span class="mobile-create-symbol" aria-hidden="true">\+<\/span>[\s\S]*<span class="mobile-action-label">\uC2DC\uC791<\/span>/, "mobile report writing entry should open the same report flow as PC");
assert.doesNotMatch(mobileViewsBlock, /data-mobile-view="journal-create"|data-mobile-view="report-create"/, "mobile write entry cards should not route to simplified create-only flows");
assert.doesNotMatch(mobileSection, /<button class="mobile-text-action"[^>]*>관리<\/button>/, "mobile home should not expose management actions");

const adminCopy = [
  "대상자 관리",
  "프로필 수정",
  "새 일지 작성",
];

for (const label of adminCopy) {
  assert.doesNotMatch(mobileSurface, new RegExp(label), `mobile parent flow should not expose admin copy: ${label}`);
}

for (const label of ["신체·운동 발달", "인지 발달", "언어·의사소통 발달", "사회·정서 발달"]) {
  assert.match(mobileSurface, new RegExp(label), `mobile parent flow should retain report area: ${label}`);
}

assert.match(mobileViewsBlock, /title: "기록 모아보기"/, "mobile records tab should be a read-only record collection");
assert.match(mobileViewsBlock, /data-mobile-view="journal-write"[\s\S]*<strong>일지 작성<\/strong>/, "mobile records tab should include a journal writing entry point");
assert.match(mobileViewsBlock, /"journal-write":\s*\{[\s\S]*?title: "일지 작성"/, "mobile should include a journal writing view");
assert.match(mobileViewsBlock, /title: "리포트 작성"/, "mobile report writing should use the same page title as PC");
assert.match(mobileViewsBlock, /data-mobile-view="report-write"[\s\S]*<strong>리포트 작성<\/strong>/, "mobile reports tab should include a report writing entry point");
assert.match(mobileViewsBlock, /"report-write":\s*\{[\s\S]*?title: "리포트 작성"/, "mobile should include a report writing view");
assert.doesNotMatch(mobileViewsBlock, /"journal-create":\s*\{|"report-create":\s*\{/, "mobile should not keep separate simplified write flows");
assert.match(mobileViewsBlock, /title: "리포트 확인"/, "mobile report result should be readable by parents");
assert.match(mobileViewsBlock, /title: "가정 메모"/, "mobile parent flow should allow a simple home note instead of profile editing");
assert.match(mobileViewsBlock, />가정 메모 남기기</, "mobile parent flow should provide a parent-friendly note action");

assert.doesNotMatch(settingsContent, /mobile-form-card|mobile-check-row/, "mobile settings should not use the nested form/check-row card treatment");
assert.match(settingsContent, /<div class="mobile-group-list">[\s\S]*?<div class="mobile-setting-card">[\s\S]*<strong>보호자<\/strong>[\s\S]*<span>김도윤 보호자<\/span>/, "mobile settings account should use the standard list-card treatment");
assert.match(settingsContent, /<div class="mobile-group-list">[\s\S]*?<div class="mobile-setting-card">[\s\S]*<strong>오늘 기록 알림<\/strong>[\s\S]*<span>켜짐<\/span>/, "mobile settings notifications should use the standard list-card treatment");
assert.match(settingsContent, /<div class="mobile-group-list">[\s\S]*?<div class="mobile-setting-card" data-mobile-view="billing">[\s\S]*<strong>공유 범위<\/strong>[\s\S]*<span>기록과 리포트 보기 권한<\/span>[\s\S]*<span class="mobile-action-label">보기<\/span>/, "mobile settings sharing should match the same list-card treatment");

for (const required of ["작성 대상", "1. 빠른 체크", "식사", "오늘 상태", "2. 오늘 기록 직접 입력", "임시 보관", "정리된 일지 확인"]) {
  assert.match(journalWriteContent, new RegExp(required), `mobile journal writing should match the PC step: ${required}`);
}

for (const required of ["내가 입력한 내용", "선택한 내용", "정리된 일지", "다시 수정", "일지 저장"]) {
  assert.match(journalDraftContent, new RegExp(required), `mobile journal review should match the PC step: ${required}`);
}

for (const required of ["리포트 작성 대상", "리포트 종류", "주간 리포트", "월간 리포트", "리포트 미리보기", "내용 수정", "리포트 작성"]) {
  assert.match(reportWriteContent, new RegExp(required), `mobile report writing should match the PC step: ${required}`);
}
