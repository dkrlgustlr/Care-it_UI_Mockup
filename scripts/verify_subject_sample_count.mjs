import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("care-it-ui-mockup.html", "utf8");
const profileDataBlock = html.match(/const profileData = \[([\s\S]*?)\];\s+const getJournalSubjectIndex/)?.[1] || "";
const profileNames = [...profileDataBlock.matchAll(/\n\s+name: "([^"]+)"/g)].map((match) => match[1]);

assert.deepEqual(
  profileNames,
  ["김도윤", "이서준", "박하린", "최민준", "윤서아"],
  "mock should start with exactly five subject profiles"
);

for (const removedName of ["정하민", "오시우", "한유진", "서지호", "문가온", "강도현", "최아린", "임지안", "배서윤", "노하준"]) {
  assert.doesNotMatch(profileDataBlock, new RegExp(removedName), `${removedName} should not remain in default profileData`);
}

assert.match(html, /대상자 5명 기준/, "mobile home summary should use five current subjects");
assert.match(html, /5명 중 2명 완료/, "desktop completion metric should use five current subjects");
assert.doesNotMatch(html, /전체 15명 중 1명 선택/, "subject picker initial copy should not mention 15 current subjects");
