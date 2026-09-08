import test from "node:test";
import assert from "node:assert/strict";
import { exactText } from "../src/services/login-runner.js";

test("normalizes labels for case-insensitive exact comparison without fuzzy matching", () => {
  assert.equal(exactText("  Sign   In "), "sign in");
  assert.notEqual(exactText("Sign in"), exactText("Sign into account"));
});
