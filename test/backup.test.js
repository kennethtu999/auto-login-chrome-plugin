import test from "node:test";
import assert from "node:assert/strict";
import { createBackup, parseBackup } from "../src/services/backup.js";

const store = {
  schemaVersion: 1,
  sites: [
    {
      id: "site-1",
      name: "Admin",
      domain: "admin.example.com",
      headers: [
        {
          id: "header-1",
          key: "Authorization",
          value: "Bearer secret",
          enabled: true,
        },
      ],
      logins: [
        {
          id: "login-1",
          name: "Admin",
          submitButton: "Login",
          fields: [
            {
              id: "field-1",
              label: "Email",
              value: "admin@example.com",
            },
          ],
        },
      ],
    },
  ],
};

test("exports and restores a versioned complete Site Profile backup", () => {
  const backup = createBackup(store, "2026-09-07T00:00:00.000Z");
  const restored = parseBackup(JSON.stringify(backup));
  assert.equal(restored.schema, "header-login-manager-backup/v1");
  assert.deepEqual(restored.store, store);
});

test("rejects malformed JSON, unknown schema, and invalid backup store before persistence", () => {
  assert.throws(() => parseBackup("not-json"), /not valid JSON/);
  assert.throws(
    () => parseBackup(JSON.stringify({ schema: "backup/v2" })),
    /unsupported/,
  );
  assert.throws(
    () =>
      parseBackup(
        JSON.stringify({
          schema: "header-login-manager-backup/v1",
          store: { schemaVersion: 2, sites: [] },
        }),
      ),
    /does not contain a valid Site Profile store/,
  );
});
