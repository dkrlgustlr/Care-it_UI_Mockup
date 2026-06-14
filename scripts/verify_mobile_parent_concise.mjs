import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("care-it-ui-mockup.html", "utf8");
const mobileSection = html.match(/<section class="mobile-section">[\s\S]*?<section class="desktop-section">/)?.[0] || "";
const mobileViewsBlock = html.match(/const mobileParentViews = \{[\s\S]*?\n      \};/)?.[0] || "";
const mobileSurface = `${mobileSection}\n${mobileViewsBlock}`;
const parentSummaryStyles = [...html.matchAll(/\.mobile-parent-summary[^{]*\{[^}]*\}/g)]
  .map((match) => match[0])
  .join("\n");
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
const mobileCss = css.match(/\.mobile-frame[\s\S]*?\.dashboard-frame/)?.[0] || "";
const mobileScreenStyles = css.match(/\.mobile-screen\s*\{[^}]*\}/)?.[0] || "";
const quickCardStrongStyles = css.match(/\.quick-card strong\s*\{[^}]*\}/)?.[0] || "";
const createCardStyles = css.match(/\.mobile-create-card\s*\{[^}]*\}/)?.[0] || "";
const createSymbolStyles = css.match(/\.mobile-create-symbol\s*\{[^}]*\}/)?.[0] || "";

assert.ok(mobileSection, "mobile mockup section should be present");
assert.ok(mobileViewsBlock, "mobile parent view map should be present");
assert.match(css, /--mobile-title-size:\s*22px;/, "mobile title font size token should be 22px");
assert.match(css, /--mobile-subtitle-size:\s*15px;/, "mobile subtitle font size token should be 15px");
assert.match(css, /--mobile-content-size:\s*13px;/, "mobile content font size token should be 13px");
assert.match(css, /\.mobile-title\s*\{[\s\S]*?font-size:\s*var\(--mobile-title-size\)/, "mobile page title should use the title token");
assert.match(mobileScreenStyles, /background:\s*#f4f7f8;/, "mobile dashboard background should stay subtle and lightly separated from cards");
assert.match(css, /\.block-head h3\s*\{[\s\S]*?font-size:\s*var\(--mobile-subtitle-size\)/, "mobile section headings should use the subtitle token");
assert.match(css, /\.mobile-parent-summary strong\s*\{[\s\S]*?font-size:\s*var\(--mobile-subtitle-size\)/, "mobile summary headline should use the subtitle token");
assert.match(css, /\.mobile-parent-summary p\s*\{[\s\S]*?font-size:\s*var\(--mobile-content-size\)/, "mobile summary body should use the content token");
assert.match(quickCardStrongStyles, /font-size:\s*var\(--mobile-subtitle-size\)/, "mobile quick metric values should use the subtitle token");
assert.doesNotMatch(quickCardStrongStyles, /font-size:\s*var\(--mobile-title-size\)/, "mobile quick metric values should not use the page title token");
assert.match(css, /\.mobile-subject-title strong,\s*\.mobile-activity-title strong\s*\{[\s\S]*?font-size:\s*var\(--mobile-subtitle-size\)/, "mobile list item titles should use the subtitle token");
assert.match(css, /\.mobile-subject-title span,\s*\.mobile-activity-title span\s*\{[\s\S]*?font-size:\s*var\(--mobile-content-size\)/, "mobile list item details should use the content token");
assert.doesNotMatch(mobileCss, /font-size:\s*var\(--font-/, "mobile typography should use the mobile title/subtitle/content tokens");
assert.doesNotMatch(mobileCss, /font-size:\s*\d+px/, "mobile typography should avoid one-off pixel font sizes");
assert.match(createCardStyles, /grid-template-columns:\s*32px minmax\(0,\s*1fr\) auto;/, "mobile write entry cards should have a dedicated icon-title-action layout");
assert.match(createCardStyles, /background:\s*#e8f6f0;/, "mobile write entry cards should use a distinct mint action surface");
assert.doesNotMatch(createCardStyles, /border-left/, "mobile write entry cards should not use the rejected vertical side accent");
assert.match(createSymbolStyles, /background:\s*var\(--care-primary\);/, "mobile write entry cards should use a clear primary plus symbol");
assert.doesNotMatch(parentSummaryStyles, /border-left/, "mobile parent summary should not use a vertical side accent");
assert.doesNotMatch(parentSummaryStyles, /--care-primary/, "mobile parent summary should not use the green accent-card treatment");

assert.match(mobileSection, /<h1 class="mobile-title">오늘 돌봄<\/h1>/, "mobile home should open as a parent-facing daily view");
assert.doesNotMatch(mobileSection, />보호자 공유</, "mobile home dashboard should not show the guardian-sharing eyebrow");
assert.match(mobileViewsBlock, /home:\s*\{[\s\S]*?eyebrow:\s*""/, "mobile home view should keep the dashboard eyebrow empty");
assert.match(html, /mobileEyebrow\.hidden\s*=\s*!view\.eyebrow/, "mobile view renderer should hide an empty eyebrow");
assert.match(mobileSection, /mobile-parent-summary/, "mobile home should lead with one concise parent summary");
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
assert.match(mobileViewsBlock, /class="mobile-subject-card mobile-create-card"[^>]*data-mobile-view="journal-create"[\s\S]*<span class="mobile-create-symbol" aria-hidden="true">\+<\/span>[\s\S]*<span class="mobile-action-label">\uC2DC\uC791<\/span>/, "mobile journal writing entry should stand out as a primary create action");
assert.match(mobileViewsBlock, /class="mobile-subject-card mobile-create-card"[^>]*data-mobile-view="report-create"[\s\S]*<span class="mobile-create-symbol" aria-hidden="true">\+<\/span>[\s\S]*<span class="mobile-action-label">\uC2DC\uC791<\/span>/, "mobile report writing entry should stand out as a primary create action");
assert.doesNotMatch(mobileSection, /<button class="mobile-text-action"[^>]*>관리<\/button>/, "mobile home should not expose management actions");

const adminCopy = [
  "대상자 관리",
  "프로필 수정",
  "새 일지 작성",
  "정리된 일지 확인",
  "임시 보관",
  "다시 수정",
  "내용 수정",
];

for (const label of adminCopy) {
  assert.doesNotMatch(mobileSurface, new RegExp(label), `mobile parent flow should not expose admin copy: ${label}`);
}

for (const label of ["신체·운동 발달", "인지 발달", "언어·의사소통 발달", "사회·정서 발달"]) {
  assert.match(mobileSurface, new RegExp(label), `mobile parent flow should retain report area: ${label}`);
}

assert.match(mobileViewsBlock, /title: "기록 모아보기"/, "mobile records tab should be a read-only record collection");
assert.match(mobileViewsBlock, /data-mobile-view="journal-create"[\s\S]*<strong>일지 작성<\/strong>/, "mobile records tab should include a journal writing entry point");
assert.match(mobileViewsBlock, /"journal-create":\s*\{[\s\S]*?title: "일지 작성"/, "mobile should include a journal writing view");
assert.match(mobileViewsBlock, /title: "리포트 미리보기"/, "mobile report preview should be read-only");
assert.match(mobileViewsBlock, /data-mobile-view="report-create"[\s\S]*<strong>리포트 작성<\/strong>/, "mobile reports tab should include a report writing entry point");
assert.match(mobileViewsBlock, /"report-create":\s*\{[\s\S]*?title: "리포트 작성"/, "mobile should include a report writing view");
assert.match(mobileViewsBlock, /title: "리포트 확인"/, "mobile report result should be readable by parents");
assert.match(mobileViewsBlock, /title: "가정 메모"/, "mobile parent flow should allow a simple home note instead of profile editing");
assert.match(mobileViewsBlock, />가정 메모 남기기</, "mobile parent flow should provide a parent-friendly note action");
