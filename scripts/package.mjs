import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
);
const outputDirectory = path.join(root, "dist");
const packageName = `header-login-manager-v${manifest.version}.zip`;
const output = path.join(outputDirectory, packageName);
fs.mkdirSync(outputDirectory, { recursive: true });
fs.rmSync(output, { force: true });
execFileSync("zip", ["-rq", output, "manifest.json", "src", "README.md"], {
  cwd: root,
  stdio: "inherit",
});
console.log(output);
