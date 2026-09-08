import fs from "node:fs";
import path from "node:path";

const tag = process.argv[2];
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag))
  throw new Error("Expected a release tag in vX.Y.Z format.");
const manifest = JSON.parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, "../manifest.json"),
    "utf8",
  ),
);
if (tag.slice(1) !== manifest.version)
  throw new Error(
    `Tag ${tag} does not match manifest version ${manifest.version}.`,
  );
console.log(`Tag ${tag} matches manifest version.`);
