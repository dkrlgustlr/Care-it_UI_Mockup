import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("care-it-ui-mockup.html", "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || "";
const mobileSection = html.match(/<section class="mobile-section">[\s\S]*?<section class="desktop-section">/)?.[0] || "";
const mobileParentViewsBlock = html.match(/const mobileParentViews = \{([\s\S]*?)\};\s+Object\.assign/)?.[1] || "";

const requiredPageButtons = [
  'data-go-page="journals">일지 보기',
  'data-go-page="journals">기록 확인',
  'data-go-page="journals">일지 확인',
  'data-go-page="reports">리포트 작성',
  'data-go-page="journals">기록 보기',
  'data-go-page="report-archive">리포트 보기',
];

for (const marker of requiredPageButtons) {
  assert.ok(html.includes(marker), `${marker} should be wired to a page transition`);
}

const requiredMockActions = [
  "confirm-journal",
  "save-journal-draft",
  "edit-report-copy",
  "save-report-pdf",
  "complete-report-check",
  "view-billing-history",
  "change-plan",
  "save-settings",
  "change-password",
  "export-data",
  "delete-account",
];

for (const action of requiredMockActions) {
  assert.match(html, new RegExp(`data-mock-action="${action}"`), `${action} mock action should be present`);
}

assert.doesNotMatch(html, /data-mock-action="show-notifications"/, "mobile topbar should not keep a placeholder notification action");
assert.doesNotMatch(html, /class="icon-button"|\.icon-button/, "unused mobile ellipsis button and styles should be removed");

assert.match(html, /data-mock-toast/, "mock toast region should exist for button feedback");
assert.match(html, /handleMockAction/, "mock action dispatcher should exist");
assert.match(html, /mockActionMessages/, "mock action messages should exist");
assert.match(html, /data-open-profile-edit[^>]*data-profile-modal-mode="add"[^>]*>대상자 추가/, "subject add button should open the add-profile modal");
assert.doesNotMatch(html, /data-go-page="journal-write"[^>]*>대상자 추가/, "subject add button should not navigate to journal writing");
assert.match(html, /profileModalModes/, "profile modal should support separate edit and add modes");
assert.match(html, /let selectedProfileIndex = 0/, "profile modal should track the selected profile");
assert.match(html, /selectedProfileIndex = index/, "profile selection should update the modal edit target");
assert.match(html, /data-save-profile/, "profile modal save should have a dedicated save handler");
assert.match(html, /let currentProfileModalMode = "edit"/, "profile modal should remember whether it is adding or editing");
assert.match(html, /const renderProfileCards = \(\) =>/, "profile list should be rendered from profile data");
assert.match(html, /profileData\.push/, "saving a new subject should append to profile data");
assert.match(html, /renderProfileCards\(\)/, "saving a subject should refresh the profile list");
assert.match(html, /setJournalSubject\(selectedProfileIndex\)/, "saving a subject should make it available to journal subject selection");
assert.match(html, /data-static-calendar/, "static report archive calendar should be selectable");
assert.match(html, /closest\("\.mobile-chip"\)/, "mobile chips should be handled by event delegation");
assert.match(html, /toggleMobileChip/, "mobile chip selection helper should exist");
assert.match(html, /\.archive-actions button/, "archive restore/delete buttons should be handled");

const mobileViewKeys = new Set(
  [...mobileParentViewsBlock.matchAll(/\n\s{8}(?:"([^"]+)"|([a-zA-Z0-9_-]+)):\s*\{/g)].map((entry) => entry[1] || entry[2])
);
const mobileTargets = [
  ...mobileSection.matchAll(/data-mobile-(?:view|tab)="([^"]+)"/g),
  ...mobileParentViewsBlock.matchAll(/data-mobile-view="([^"]+)"/g),
].map((entry) => entry[1]);
const unknownMobileTargets = [...new Set(mobileTargets.filter((target) => !mobileViewKeys.has(target)))];
const mobileSurface = `${mobileSection}\n${mobileParentViewsBlock}`;
const inertMobileCards = [
  ...mobileSurface.matchAll(/<div class="mobile-subject-card"(?![^>]*data-mobile-view)[\s\S]*?<\/div>/g),
].map((entry) => entry[0].replace(/\s+/g, " ").trim());

assert.ok(mobileParentViewsBlock, "parent mobile views should be present");
assert.deepEqual(unknownMobileTargets, [], `mobile targets should point to implemented views:\n${unknownMobileTargets.join("\n")}`);
assert.deepEqual(inertMobileCards, [], `mobile subject cards should either navigate or be rendered as plain info:\n${inertMobileCards.join("\n")}`);
assert.match(html, /event\.target\.closest\("\[data-mobile-view\]"\)/, "mobile view buttons and cards should be handled by event delegation");

assert.doesNotThrow(() => new Function(script), "inline script should parse");

const buttonPattern = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
const unwiredButtons = [];
let match;

while ((match = buttonPattern.exec(html))) {
  const attrs = match[1].replace(/\s+/g, " ").trim();
  const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wired =
    /data-(go-page|mobile-view|mobile-tab|mobile-open-tab|report-mode|calendar|month-picker|picker|subject-picker|open-profile-edit|close-profile-edit|desktop-fullscreen|mock-action)/.test(attrs) ||
    /data-save-profile/.test(attrs) ||
    /class="[^"]*(choice-chip|mobile-chip|nav-item|report-kind-button|calendar-day)/.test(attrs) ||
    ["복원", "삭제"].includes(text);

  if (!wired) {
    unwiredButtons.push(`${text || "(icon)"} :: ${attrs}`);
  }
}

assert.deepEqual(unwiredButtons, [], `static buttons should be wired:\n${unwiredButtons.join("\n")}`);
