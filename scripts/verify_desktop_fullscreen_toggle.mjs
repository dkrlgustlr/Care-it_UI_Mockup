import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("care-it-ui-mockup.html", "utf8");

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
