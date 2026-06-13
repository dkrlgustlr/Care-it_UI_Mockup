import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("care-it-ui-mockup.html", "utf8");
const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";

const cssBlock = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return style.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`))?.[1] || "";
};

const workspacePanelBlock = cssBlock(".workspace-grid .panel");
assert.doesNotMatch(
  workspacePanelBlock,
  /height:\s*100%/,
  "workspace panels should not globally stretch to the tallest column"
);

for (const selector of [".workspace-grid.profiles", ".workspace-grid.billing", ".workspace-grid.settings"]) {
  assert.match(cssBlock(selector), /align-items:\s*start/, `${selector} should keep content-height panels`);
}

assert.match(
  style,
  /\.workspace-grid:is\(\.journals,\s*\.reports,\s*\.report-result,\s*\.journal-draft\) \.panel\s*\{[\s\S]*?height:\s*100%/,
  "only workflow screens that need aligned panes should opt into full-height panels"
);
