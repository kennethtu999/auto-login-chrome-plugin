import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
);
const requiredFiles = [
  "src/popup/popup.html",
  "src/popup/popup.js",
  "src/site/site.html",
  "src/site/site.js",
  "src/services/login-runner.js",
];
if (manifest.manifest_version !== 3)
  throw new Error("manifest_version must be 3.");
if (!/^\d+\.\d+\.\d+$/.test(manifest.version))
  throw new Error("manifest version must use semantic x.y.z format.");
for (const permission of [
  "storage",
  "scripting",
  "declarativeNetRequestWithHostAccess",
])
  if (!manifest.permissions?.includes(permission))
    throw new Error(`Missing required permission: ${permission}`);
if (
  !Array.isArray(manifest.optional_host_permissions) ||
  manifest.optional_host_permissions.length === 0
)
  throw new Error("Optional host permissions are required.");
for (const file of requiredFiles)
  if (!fs.existsSync(path.join(root, file)))
    throw new Error(`Missing extension file: ${file}`);
console.log(`Validated Header Login Manager ${manifest.version}.`);
