import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("care-it-ui-mockup.html", "utf8");
const logoPath = "output/logo/care-it-logo-c-transparent.png";

assert.match(
  html,
  /data-desktop-fullscreen-toggle/,
  "desktop fullscreen toggle button should exist",
);
assert.match(
  html,
  /\.dashboard-frame\.desktop-fullscreen/,
  "desktop fullscreen CSS state should exist",
);
assert.match(
  html,
  /desktopFrame\.classList\.toggle\("desktop-fullscreen"/,
  "desktop fullscreen toggle behavior should exist",
);
assert.doesNotMatch(
  html,
  /requestFullscreen|exitFullscreen|fullscreenElement|fullscreenchange/,
  "desktop fullscreen should stay inside the page and not call the browser Fullscreen API",
);
assert.ok(fs.existsSync(logoPath), "Care-it logo asset should exist");
assert.match(
  html,
  /<img class="brand-logo" src="output\/logo\/care-it-logo-c-transparent\.png" alt="Care-it" \/>/,
  "desktop sidebar should use the Care-it logo image",
);

const journalDevelopmentFields = [
  ["신체·운동 발달", "대근육, 소근육, 감각, 건강, 기본생활 움직임"],
  ["인지 발달", "탐색, 문제해결, 기억, 분류, 수·공간 개념, 주의집중"],
  ["언어·의사소통 발달", "듣기, 말하기, 어휘, 문장, 비언어 표현, 상호작용 대화"],
  ["사회·정서 발달", "또래관계, 애착, 자기조절, 감정표현, 규칙, 협동"],
];

for (const [label, placeholder] of journalDevelopmentFields) {
  assert.match(html, new RegExp(label), `${label} journal field should exist`);
  assert.match(html, new RegExp(placeholder), `${label} guidance text should exist`);
}

for (const oldLabel of ["기분과 사람들과의 관계", "활동과 프로그램 참여", "건강과 안전", "전달할 내용"]) {
  assert.doesNotMatch(html, new RegExp(oldLabel), `${oldLabel} should be replaced in journal fields`);
}
