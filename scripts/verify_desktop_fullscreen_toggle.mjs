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
