import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

test("release version guard accepts the manifest tag and rejects a mismatched tag", () => {
  assert.equal(
    spawnSync("node", ["scripts/check-version.mjs", "v1.0.0"], { cwd: root })
      .status,
    0,
  );
  assert.notEqual(
    spawnSync("node", ["scripts/check-version.mjs", "v1.0.1"], { cwd: root })
      .status,
    0,
  );
});
