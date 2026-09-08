import test from "node:test";
import assert from "node:assert/strict";
import { compileHeaderRules } from "../src/services/header-rules.js";

test("compiles enabled headers into isolated Site DNR rules", () => {
  const rules = compileHeaderRules([
    {
      id: "admin",
      domain: "admin.example.com",
      headers: [{ key: "Authorization", value: "Bearer admin", enabled: true }],
    },
    {
      id: "grafana",
      domain: "grafana.example.com",
      headers: [
        { key: "X-Environment", value: "prod", enabled: true },
        { key: "Ignored", value: "no", enabled: false },
      ],
    },
  ]);
  assert.equal(rules.length, 2);
  assert.equal(
    rules[0].condition.regexFilter,
    "^https?://admin\\.example\\.com(?::\\d+)?(?:/|$)",
  );
  assert.ok(rules[0].condition.resourceTypes.includes("main_frame"));
  assert.ok(rules[0].condition.resourceTypes.includes("xmlhttprequest"));
  assert.deepEqual(rules[1].action.requestHeaders, [
    { header: "X-Environment", operation: "set", value: "prod" },
  ]);
  assert.notEqual(rules[0].id, rules[1].id);
});
