import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
test("UI uses the shared design system and exposes login actions and values", () => {
  const popup = fs.readFileSync(
    path.join(root, "src/popup/popup.html"),
    "utf8",
  );
  const manager = fs.readFileSync(path.join(root, "src/site/site.js"), "utf8");
  const managerPage = fs.readFileSync(
    path.join(root, "src/site/site.html"),
    "utf8",
  );
  assert.match(popup, /design-system\.css/);
  assert.match(popup, /id="manage-sites"/);
  assert.match(popup, />⚙<\/button>/);
  assert.match(manager, /field\("Value", loginField\.value, "text"\)/);
  assert.match(manager, /button\("Clone profile"\)/);
  const popupScript = fs.readFileSync(
    path.join(root, "src/popup/popup.js"),
    "utf8",
  );
  assert.match(popupScript, /runLoginOnActiveTab\(site, login\)/);
  assert.match(popupScript, /querySelector\("#manage-sites"\)/);
  assert.doesNotMatch(popupScript, /textContent = "Manage"/);
  assert.match(popupScript, /const closeTimer = setTimeout\(\(\) => window\.close\(\), 1000\)/);
  assert.doesNotMatch(popupScript, /siteEnabled/);
  assert.match(popupScript, /store\.sites\.filter\(\(site\) => site\.enabled !== false\)/);
  const popupStyles = fs.readFileSync(
    path.join(root, "src/popup/popup.css"),
    "utf8",
  );
  assert.match(popupStyles, /\.login-actions\s*\{[\s\S]*flex-direction: column/);
  assert.match(popupStyles, /\.login-actions \.button\s*\{[\s\S]*font-size: 10px/);
  const loginRunner = fs.readFileSync(
    path.join(root, "src/services/login-runner.js"),
    "utf8",
  );
  assert.match(loginRunner, /target: \{ tabId: tab\.id, allFrames: true \}/);
  assert.match(
    managerPage,
    /Credentials stay in local Chrome extension storage/,
  );
});
