import test from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  normalizeDomain,
  normalizeDefaultUrl,
  validateSite,
} from "../src/utils/validation.js";

const validSite = () => ({
  id: "site-1",
  name: "Admin",
  domain: "admin.example.com",
  headers: [
    { id: "h1", key: "Authorization", value: "Bearer token", enabled: true },
  ],
  logins: [
    {
      id: "l1",
      name: "Admin",
      submitButton: "Login",
      fields: [{ id: "f1", label: "Email", value: "admin@example.com" }],
    },
  ],
});

test("happy path validates a Site Profile with Header and Login Profile", () => {
  const site = validateSite(validSite());
  assert.equal(site.domain, "admin.example.com");
  assert.equal(site.logins[0].fields[0].label, "Email");
});

test("accepts a same-domain default URL and rejects an unrelated destination", () => {
  assert.equal(
    normalizeDefaultUrl("https://admin.example.com/login", "admin.example.com"),
    "https://admin.example.com/login",
  );
  assert.throws(
    () => normalizeDefaultUrl("https://example.com/", "admin.example.com"),
    /match the exact site domain/,
  );
});

test("supports multiple Login Profiles", () => {
  const site = validateSite({
    ...validSite(),
    logins: [
      ...validSite().logins,
      {
        id: "l2",
        name: "Tester",
        submitButton: "Login",
        fields: [{ id: "f2", label: "User ID", value: "tester" }],
      },
    ],
  });
  assert.equal(site.logins.length, 2);
  assert.equal(site.logins[1].name, "Tester");
});

test("accepts local development hostnames", () => {
  assert.equal(normalizeDomain("localhost"), "localhost");
  assert.equal(normalizeDomain("127.0.0.1"), "127.0.0.1");
  assert.equal(
    normalizeDefaultUrl("http://localhost:3000/login", "localhost"),
    "http://localhost:3000/login",
  );
});

test("rejects non-exact, duplicate, and invalid Header Site Profile input", () => {
  assert.throws(
    () => normalizeDomain("https://admin.example.com/path"),
    ValidationError,
  );
  assert.throws(
    () => validateSite({ ...validSite(), id: "site-2" }, [validSite()]),
    /already exists/,
  );
  assert.throws(
    () =>
      validateSite({
        ...validSite(),
        headers: [{ key: "Bad Header", value: "x" }],
      }),
    /Header name/,
  );
});
