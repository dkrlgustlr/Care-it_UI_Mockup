import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("care-it-ui-mockup.html", "utf8");
const mobileSection = html.match(/<section class="mobile-section">[\s\S]*?<section class="desktop-section">/)?.[0] || "";
const mobileViewsBlock = html.match(/const mobileParentViews = \{[\s\S]*?\n      \};/)?.[0] || "";
const mobileSurface = `${mobileSection}\n${mobileViewsBlock}`;
const parentSummaryStyles = [...html.matchAll(/\.mobile-parent-summary[^{]*\{[^}]*\}/g)]
  .map((match) => match[0])
  .join("\n");

assert.ok(mobileSection, "mobile mockup section should be present");
assert.ok(mobileViewsBlock, "mobile parent view map should be present");
assert.doesNotMatch(parentSummaryStyles, /border-left/, "mobile parent summary should not use a vertical side accent");
assert.doesNotMatch(parentSummaryStyles, /--care-primary/, "mobile parent summary should not use the green accent-card treatment");

assert.match(mobileSection, /<h1 class="mobile-title">오늘 돌봄<\/h1>/, "mobile home should open as a parent-facing daily view");
assert.match(mobileSection, />보호자 공유</, "mobile home eyebrow should speak to guardians");
assert.match(mobileSection, /mobile-parent-summary/, "mobile home should lead with one concise parent summary");
assert.match(mobileSection, /점심 완식/, "mobile summary should expose a concrete daily status");
assert.match(mobileSection, /data-mobile-tab="journal"[\s\S]*<span>기록<\/span>/, "journal tab should be labeled as parent-friendly records");

const homeQuickCardCount = (mobileSection.match(/class="quick-card"/g) || []).length;
assert.ok(homeQuickCardCount <= 2, `mobile home should keep quick metrics concise, found ${homeQuickCardCount}`);

assert.doesNotMatch(mobileSection, /<button class="primary-action"[^>]*data-mobile-view="journal-write"/, "mobile home should not show a large write CTA");
assert.doesNotMatch(mobileSection, /<button class="mobile-text-action"[^>]*>관리<\/button>/, "mobile home should not expose management actions");

const adminCopy = [
  "대상자 관리",
  "프로필 수정",
  "일지 작성",
  "새 일지 작성",
  "리포트 작성",
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
assert.match(mobileViewsBlock, /title: "리포트 미리보기"/, "mobile report preview should be read-only");
assert.match(mobileViewsBlock, /title: "리포트 확인"/, "mobile report result should be readable by parents");
assert.match(mobileViewsBlock, /title: "가정 메모"/, "mobile parent flow should allow a simple home note instead of profile editing");
assert.match(mobileViewsBlock, />가정 메모 남기기</, "mobile parent flow should provide a parent-friendly note action");
