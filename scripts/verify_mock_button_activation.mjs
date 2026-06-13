import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("care-it-ui-mockup.html", "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || "";

const requiredPageButtons = [
  'data-go-page="journals">일지 보기',
  'data-go-page="journals">기록 확인',
  'data-go-page="journals">일지 확인',
  'data-go-page="journal-write">대상자 추가',
  'data-go-page="journals">기록 보기',
  'data-go-page="report-archive">리포트 보기',
];

for (const marker of requiredPageButtons) {
  assert.ok(html.includes(marker), `${marker} should be wired to a page transition`);
}

const requiredMockActions = [
  "show-notifications",
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

assert.match(html, /data-mock-toast/, "mock toast region should exist for button feedback");
assert.match(html, /handleMockAction/, "mock action dispatcher should exist");
assert.match(html, /mockActionMessages/, "mock action messages should exist");
assert.match(html, /data-static-calendar/, "static report archive calendar should be selectable");
assert.match(html, /closest\("\.mobile-chip"\)/, "mobile chips should be handled by event delegation");
assert.match(html, /toggleMobileChip/, "mobile chip selection helper should exist");
assert.match(html, /\.archive-actions button/, "archive restore/delete buttons should be handled");

assert.doesNotThrow(() => new Function(script), "inline script should parse");

const buttonPattern = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
const unwiredButtons = [];
let match;

while ((match = buttonPattern.exec(html))) {
  const attrs = match[1].replace(/\s+/g, " ").trim();
  const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wired =
    /data-(go-page|mobile-view|mobile-tab|mobile-open-tab|report-mode|calendar|month-picker|picker|subject-picker|open-profile-edit|close-profile-edit|desktop-fullscreen|mock-action)/.test(attrs) ||
    /class="[^"]*(choice-chip|mobile-chip|nav-item|report-kind-button|calendar-day)/.test(attrs) ||
    ["복원", "삭제"].includes(text);

  if (!wired) {
    unwiredButtons.push(`${text || "(icon)"} :: ${attrs}`);
  }
}

assert.deepEqual(unwiredButtons, [], `static buttons should be wired:\n${unwiredButtons.join("\n")}`);
