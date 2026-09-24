(() => {
  if (globalThis.__headerLoginAutoStarted) return;
  globalThis.__headerLoginAutoStarted = true;

  const STORE_KEY = "headerLoginManager.profileStore";
  const AUTO_KEY = "headerLoginManager.autoLogin";
  const ENABLED_KEY = "headerLoginManager.enabled";
  let timer;
  let intervalId;
  let observer;
  let storageListener;
  let disposed = false;
  let running = false;
  let lastSubmitAt = 0;
  let confirmedElement = null;
  let lastFunctionKey = "";
  let lastFunctionAttemptKey = "";
  let lastFunctionAttemptAt = 0;
  let lastSelectionKey = "";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    clearInterval(intervalId);
    observer?.disconnect();
    try { chrome.storage.onChanged.removeListener(storageListener); } catch {}
    delete globalThis.__headerLoginAutoStarted;
  }
  const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const visible = (node) => {
    if (!node || node.disabled) return false;
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
  };
  const select = (selector) => {
    if (!selector) return null;
    try { return [...document.querySelectorAll(selector)].find(visible) ?? null; }
    catch { return null; }
  };
  const parseStep = (line) => {
    const match = /^(focus|click):\s*(.+)$/i.exec(line);
    const action = match ? match[1].toLowerCase() : "click";
    const [selector, exactText] = (match ? match[2] : line).split(/\s+\|\s+/, 2);
    return { action, selector: selector.trim(), exactText: exactText?.trim() };
  };
  const stepTarget = (step) => {
    if (!step.exactText) return select(step.selector);
    try {
      return [...document.querySelectorAll(step.selector)].find((node) =>
        visible(node) && normalize(node.textContent) === normalize(step.exactText)
      ) ?? null;
    } catch { return null; }
  };
  const duplicateConfirmation = (site) => {
    const configured = select(site.duplicateConfirmSelector);
    if (configured) return configured;
    // Only act on the known same-session warning, never on an arbitrary confirm button.
    for (const dialog of document.querySelectorAll("div.popup-visible")) {
      if (!visible(dialog) || !dialog.textContent?.includes("GIB-CHC210001")) continue;
      const button = [...dialog.querySelectorAll("button")].find((node) =>
        visible(node) && normalize(node.textContent) === normalize("確定登入")
      );
      if (button) return button;
    }
    return null;
  };
  const fieldFor = (field) => {
    const direct = select(field.selector);
    if (direct) return direct;
    for (const label of document.querySelectorAll("label")) {
      if (normalize(label.textContent) !== normalize(field.label)) continue;
      const target = label.control || label.querySelector("input,textarea,select");
      if (visible(target)) return target;
    }
    return [...document.querySelectorAll("input,textarea,select")].find((node) =>
      visible(node) && [node.getAttribute("aria-label"), node.getAttribute("placeholder")].some((value) => normalize(value) === normalize(field.label))
    ) ?? null;
  };
  const submitFor = (login) => select(login.submitSelector) ??
    [...document.querySelectorAll('button,input[type="submit"]')].find((node) =>
      visible(node) && [node.textContent, node.value, node.getAttribute("aria-label")].some((value) => normalize(value) === normalize(login.submitButton))
    );
  const fill = (node, value) => {
    const proto = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype :
      node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (!setter) return false;
    node.focus();
    setter.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    node.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    node.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  };
  const clickTarget = (node) => {
    if (node.tagName === "A" && /^javascript:/i.test(node.getAttribute("href") ?? "")) {
      node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      event.preventDefault();
      node.dispatchEvent(event);
      return;
    }
    node.click();
  };
  async function state() {
    const data = await chrome.storage.local.get([STORE_KEY, AUTO_KEY, ENABLED_KEY]);
    if (data[ENABLED_KEY] === false) return null;
    const sites = data[STORE_KEY]?.sites ?? [];
    const site = sites.find((item) => item.enabled !== false && item.domain === location.hostname.toLowerCase());
    if (!site) return null;
    if (site.defaultUrl) {
      const target = new URL(site.defaultUrl);
      if (target.origin !== location.origin) return null;
    }
    const setting = data[AUTO_KEY]?.[site.id];
    if (!setting?.enabled) return null;
    const login = site.logins?.find((item) => item.id === setting.loginId);
    if (!login) return null;
    return { site, setting, login };
  }
  async function stillEnabled(siteId, loginId, functionId) {
    const current = await state();
    return current?.site.id === siteId && current.login.id === loginId && current.setting.functionId === functionId;
  }
  async function navigateFunction(site, setting, login) {
    const item = site.functions?.find((entry) => entry.id === setting.functionId);
    if (!item) return;
    const key = `${site.id}:${login.id}:${item.id}`;
    if (lastFunctionKey === key) return;
    if (lastFunctionAttemptKey === key && Date.now() - lastFunctionAttemptAt < 10000) return;
    const steps = item.selectors.map(parseStep);
    const first = stepTarget(steps[0]);
    if (!first) return;
    const menu = first.closest("li") ?? first.parentElement;
    const stepOrMenuTarget = (step, index) => {
      const configured = stepTarget(step);
      if (configured || index !== steps.length - 1 || !menu) return configured;
      // This site's submenu exists in the DOM while its parent li is not hovered.
      // The Angular click handler still works when the CSS panel is hidden.
      let candidates = [];
      try { candidates = [...menu.querySelectorAll(step.selector)]; } catch {}
      const allowed = (node) => !node.disabled && node.getAttribute?.("aria-disabled") !== "true";
      const matchesText = (node) => !step.exactText || normalize(node.textContent) === normalize(step.exactText);
      return candidates.find((node) => allowed(node) && matchesText(node)) ??
        [...menu.querySelectorAll("a,button")].find((node) =>
          allowed(node) && normalize(node.textContent) === normalize(item.name)
        ) ?? null;
    };
    lastFunctionAttemptKey = key;
    lastFunctionAttemptAt = Date.now();
    for (let index = 0; index < steps.length; index++) {
      const step = steps[index];
      if (!(await stillEnabled(site.id, login.id, setting.functionId))) return;
      let target = stepOrMenuTarget(step, index);
      for (let attempt = 0; !target && attempt < 50; attempt++) {
        await sleep(200);
        target = stepOrMenuTarget(step, index);
      }
      if (!target) {
        console.info("[Header Login Manager] Function step unavailable", { functionName: item.name, step: index + 1 });
        return;
      }
      if (step.action === "focus") {
        target.focus();
        await sleep(100);
      } else {
        clickTarget(target);
      }
      await sleep(200);
    }
    lastFunctionKey = key;
  }
  async function run() {
    if (running || disposed) return;
    running = true;
    try {
      const current = await state();
      if (!current) return;
      const { site, setting, login } = current;
      const selectionKey = `${site.id}:${login.id}:${setting.functionId ?? ""}`;
      if (lastSelectionKey !== selectionKey) {
        lastSelectionKey = selectionKey;
        lastSubmitAt = 0;
        lastFunctionKey = "";
      }
      const confirm = duplicateConfirmation(site);
      if (!confirm) confirmedElement = null;
      if (confirm && confirm !== confirmedElement) {
        confirmedElement = confirm;
        confirm.click();
        return;
      }
      if (confirm) return;
      const fields = login.fields.map(fieldFor);
      const submit = submitFor(login);
      if (fields.every(Boolean) && submit) {
        lastFunctionKey = "";
        // The same-session response in the captured HNCB flow can take over 30 seconds.
        if (Date.now() - lastSubmitAt < 45000) return;
        lastSubmitAt = Date.now();
        for (let index = 0; index < fields.length; index++) fill(fields[index], login.fields[index].value);
        await sleep(150);
        if (await stillEnabled(site.id, login.id, setting.functionId)) submit.click();
        return;
      }
      await navigateFunction(site, setting, login);
    } catch (error) {
      if (String(error?.message ?? error).includes("Extension context invalidated")) {
        dispose();
        return;
      }
      console.warn("[Header Login Manager] Auto login failed", error);
    } finally {
      running = false;
    }
  }
  function schedule(delay = 250) {
    if (disposed) return;
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }
  observer = new MutationObserver(() => schedule());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  storageListener = (changes, area) => {
    if (area === "local" && (changes[STORE_KEY] || changes[AUTO_KEY] || changes[ENABLED_KEY])) schedule(0);
  };
  chrome.storage.onChanged.addListener(storageListener);
  schedule(0);
  intervalId = setInterval(() => schedule(0), 2000);
})();
