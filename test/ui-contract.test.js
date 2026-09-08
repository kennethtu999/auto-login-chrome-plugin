import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
test("UI uses the shared design system and keeps sensitive values masked by default", () => {
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
  assert.match(manager, /["']password["']/);
  assert.match(
    managerPage,
    /Credentials stay in local Chrome extension storage/,
  );
});
