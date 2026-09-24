import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { loadAutoLogin, saveAutoLogin } from "../src/services/auto-login.js";

test("only one site account can have automatic login enabled", async () => {
  const values = {};
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) { return { [key]: values[key] }; },
        async set(patch) { Object.assign(values, patch); },
      },
    },
  };
  await saveAutoLogin("site-a", { enabled: true, loginId: "a1" });
  await saveAutoLogin("site-b", { enabled: true, loginId: "b1" });
  let state = await loadAutoLogin();
  assert.equal(state["site-a"].enabled, false);
  assert.equal(state["site-b"].enabled, true);
  await saveAutoLogin("site-b", { enabled: false });
  state = await loadAutoLogin();
  assert.equal(Object.values(state).some((setting) => setting.enabled), false);
});

test("invalidated extension context stops the old content script", async () => {
  let scheduledRun;
  let disconnected = false;
  let intervalCleared = false;
  let warned = false;
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, "../src/content/auto-login.js"), "utf8",
  );
  const context = {
    chrome: {
      storage: {
        local: { async get() { throw new Error("Extension context invalidated."); } },
        onChanged: { addListener() {}, removeListener() {} },
      },
    },
    document: { documentElement: {} },
    MutationObserver: class {
      observe() {}
      disconnect() { disconnected = true; }
    },
    setTimeout(callback) { scheduledRun = callback; return 1; },
    clearTimeout() {},
    setInterval() { return 2; },
    clearInterval(id) { intervalCleared = id === 2; },
    console: { warn() { warned = true; } },
  };
  vm.runInNewContext(source, context);
  await scheduledRun();
  assert.equal(disconnected, true);
  assert.equal(intervalCleared, true);
  assert.equal(warned, false);
});

test("post-login navigation clicks the configured function inside a CSS-hidden submenu", async () => {
  let scheduledRun;
  let menuFocused = false;
  let functionClicks = 0;
  let scriptNavigationPrevented = false;
  const menuRoot = { querySelectorAll() { return [functionLink]; } };
  const menu = {
    textContent: "管理設定",
    getClientRects() { return [1]; },
    focus() { menuFocused = true; },
    closest() { return menuRoot; },
    click() { throw new Error("The menu's javascript: link must not be clicked"); },
  };
  const functionLink = {
    textContent: "流程套餐",
    tagName: "A",
    getClientRects() { return []; },
    getAttribute() { return "javascript:void(0)"; },
    dispatchEvent(event) {
      if (event.type === "click") {
        functionClicks++;
        scriptNavigationPrevented = event.defaultPrevented;
      }
    },
  };
  const site = {
    id: "site-1", domain: "localhost", enabled: true,
    logins: [{ id: "login-1", fields: [{ label: "Account", value: "x" }], submitButton: "Login" }],
    functions: [{ id: "function-1", name: "流程套餐", selectors: [
      "focus: a.menu-link | 管理設定", 'click: a[name="CCMAAPACK"]',
    ] }],
  };
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, "../src/content/auto-login.js"), "utf8",
  );
  const context = {
    chrome: {
      storage: {
        local: { async get() { return {
          "headerLoginManager.profileStore": { sites: [site] },
          "headerLoginManager.autoLogin": { "site-1": {
            enabled: true, loginId: "login-1", functionId: "function-1",
          } },
        }; } },
        onChanged: { addListener() {} },
      },
    },
    document: {
      documentElement: {},
      querySelectorAll(selector) {
        if (selector === "a.menu-link") return [menu];
        if (selector === 'a[name="CCMAAPACK"]') return [functionLink];
        return [];
      },
    },
    location: { hostname: "localhost", origin: "http://localhost:3000" },
    getComputedStyle() { return { display: "block", visibility: "visible" }; },
    MutationObserver: class { observe() {} },
    MouseEvent: class {
      constructor(type) { this.type = type; this.defaultPrevented = false; }
      preventDefault() { this.defaultPrevented = true; }
    },
    setTimeout(callback, ms) {
      if (ms === 0) { scheduledRun = callback; return 1; }
      return setTimeout(callback, ms);
    },
    clearTimeout,
    setInterval() { return 2; },
    console,
  };
  vm.runInNewContext(source, context);
  await scheduledRun();
  assert.equal(menuFocused, true);
  assert.equal(functionClicks, 1);
  assert.equal(scriptNavigationPrevented, true);
  await scheduledRun();
  assert.equal(functionClicks, 1);
});
