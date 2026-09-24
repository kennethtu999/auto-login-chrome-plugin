const popupStartedAt = performance.now();
performance.mark("header-login-popup-start");

function debugPopup(event, details = {}) {
  const elapsedMs = Number((performance.now() - popupStartedAt).toFixed(1));
  console.info("[Header Login Manager][popup]", event, {
    elapsedMs,
    ...details,
  });
}

debugPopup("script-start", {
  timeOrigin: new Date(performance.timeOrigin).toISOString(),
});

const grid = document.querySelector("#site-grid");
const notice = document.querySelector("#notice");
const manageSites = document.querySelector("#manage-sites");
let autoSettings = {};
let activeUrl = null;

manageSites.addEventListener("click", () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("src/site/site.html") }),
);

function showNotice(message, type = "success") {
  notice.className = `notice ${type}`;
  notice.textContent = message;
}

function renderSite(site) {
  const row = document.createElement("article");
  row.className = "site-row";

  const siteLink = document.createElement("button");
  siteLink.className = "site-link";
  siteLink.type = "button";
  siteLink.innerHTML = '<span class="site-card-title"></span><span class="site-card-domain"></span>';
  siteLink.querySelector(".site-card-title").textContent = site.name;
  siteLink.querySelector(".site-card-domain").textContent = site.domain;
  siteLink.addEventListener("click", () =>
    chrome.tabs.create({ url: site.defaultUrl || `https://${site.domain}/` }),
  );

  const actions = document.createElement("div");
  actions.className = "site-row-actions";
  const loginActions = document.createElement("div");
  loginActions.className = "login-actions";
  if (site.logins?.length) {
    const accountHeading = document.createElement("div");
    accountHeading.className = "auto-account-heading";
    accountHeading.textContent = "自動登入帳號";
    loginActions.append(accountHeading);
  }
  const saved = autoSettings[site.id] ?? {};
  const savedAccountExists = site.logins?.some((item) => item.id === saved.loginId);
  let selectedLoginId = savedAccountExists ? saved.loginId : site.logins?.[0]?.id;
  let autoEnabled = saved.enabled === true && savedAccountExists;
  let feature;
  const onSite = activeUrl?.hostname.toLowerCase() === site.domain &&
    (!site.defaultUrl || activeUrl.origin === new URL(site.defaultUrl).origin);
  const accountCheckboxes = [];
  const updateCheckboxes = () => {
    for (const checkbox of accountCheckboxes) {
      const checked = autoEnabled && checkbox.value === selectedLoginId;
      checkbox.checked = checked;
      checkbox.disabled = !onSite && !checked;
    }
  };
  const save = async () => {
    const { saveAutoLogin } = await import("../services/auto-login.js");
    const functionByLogin = { ...autoSettings[site.id]?.functionByLogin, [selectedLoginId]: feature.value };
    autoSettings[site.id] = await saveAutoLogin(site.id, {
      enabled: autoEnabled, loginId: selectedLoginId, functionId: feature.value, functionByLogin,
    });
  };
  for (const login of site.logins ?? []) {
    const accountRow = document.createElement("div");
    accountRow.className = "account-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = login.id;
    checkbox.setAttribute("aria-label", `使用 ${login.name} 自動登入`);
    checkbox.title = onSite ? `使用 ${login.name} 自動登入` : "請先開啟此網站";
    accountCheckboxes.push(checkbox);
    checkbox.addEventListener("change", async () => {
      const previous = { autoEnabled, selectedLoginId, functionId: feature.value };
      for (const item of accountCheckboxes) item.disabled = true;
      try {
        if (checkbox.checked) {
          if (!onSite) throw new Error("請先切換至此網站再啟用自動登入。");
          const { hasSitePermission } = await import("../services/permissions.js");
          if (!(await hasSitePermission(site.domain))) throw new Error(`Permission missing for ${site.domain}.`);
          const manager = await chrome.storage.local.get("headerLoginManager.enabled");
          if (manager["headerLoginManager.enabled"] === false)
            throw new Error("Enable Header Login Manager in site settings first.");
          selectedLoginId = login.id;
          autoEnabled = true;
          const preferred = autoSettings[site.id]?.functionByLogin?.[login.id] ?? "";
          feature.value = site.functions?.some((item) => item.id === preferred) ? preferred : "";
        } else {
          autoEnabled = false;
        }
        await save();
        updateCheckboxes();
        if (autoEnabled) {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (tab?.id) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                files: ["src/content/auto-login.js"],
              });
            } catch (error) {
              showNotice(`已啟用自動登入；請重新整理頁面：${error.message}`, "error");
              return;
            }
          }
        }
        showNotice(autoEnabled ? `已使用 ${login.name} 自動登入。` : "自動登入已停用。");
        if (autoEnabled) await start();
      } catch (error) {
        autoEnabled = previous.autoEnabled;
        selectedLoginId = previous.selectedLoginId;
        feature.value = previous.functionId;
        showNotice(error.message, "error");
      } finally {
        updateCheckboxes();
      }
    });
    const loginButton = document.createElement("button");
    loginButton.className = "button small";
    loginButton.type = "button";
    loginButton.textContent = login.name;
    loginButton.title = `使用 ${login.name} 立即登入`;
    loginButton.addEventListener("click", async () => {
      loginButton.disabled = true;
      const closeTimer = setTimeout(() => window.close(), 1000);
      try {
        if (autoEnabled) {
          autoEnabled = false;
          await save();
          updateCheckboxes();
        }
        const { runLoginOnActiveTab } = await import("../services/login-runner.js");
        const result = await runLoginOnActiveTab(site, login);
        showNotice(`${login.name}: filled ${result.filledFields} field(s).`);
      } catch (error) {
        clearTimeout(closeTimer);
        showNotice(error.message, "error");
      } finally {
        loginButton.disabled = false;
      }
    });
    accountRow.append(checkbox, loginButton);
    loginActions.append(accountRow);
  }
  updateCheckboxes();

  if (site.logins?.length) {
    const controls = document.createElement("div");
    controls.className = "auto-controls";
    feature = document.createElement("select");
    feature.setAttribute("aria-label", `${site.name} function`);
    feature.add(new Option("No function", ""));
    for (const item of (site.functions ?? []).slice(0, 10)) feature.add(new Option(item.name, item.id));
    const selectedFunction = saved.functionByLogin?.[selectedLoginId] ?? saved.functionId;
    feature.value = site.functions?.some((item) => item.id === selectedFunction) ? selectedFunction : "";
    feature.addEventListener("change", () => save().catch((error) => showNotice(error.message, "error")));
    controls.append(feature);
    loginActions.append(controls);
  }

  actions.append(loginActions);
  row.append(siteLink, actions);
  return row;
}

async function start() {
  debugPopup("storage-read-start");
  const storageStartedAt = performance.now();
  const [result, tabs] = await Promise.all([
    chrome.storage.local.get(["headerLoginManager.profileStore", "headerLoginManager.autoLogin"]),
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
  ]);
  autoSettings = result["headerLoginManager.autoLogin"] ?? {};
  let foundEnabled = false;
  let repaired = false;
  for (const [siteId, setting] of Object.entries(autoSettings)) {
    if (!setting?.enabled) continue;
    if (foundEnabled) {
      autoSettings[siteId] = { ...setting, enabled: false };
      repaired = true;
    } else {
      foundEnabled = true;
    }
  }
  if (repaired) await chrome.storage.local.set({ "headerLoginManager.autoLogin": autoSettings });
  try { activeUrl = tabs[0]?.url ? new URL(tabs[0].url) : null; } catch { activeUrl = null; }
  const storageDurationMs = Number(
    (performance.now() - storageStartedAt).toFixed(1),
  );
  const storedStore = result["headerLoginManager.profileStore"];
  const store = {
    sites: Array.isArray(storedStore?.sites) ? storedStore.sites : [],
  };
  const enabledSites = store.sites.filter((site) => site.enabled !== false);
  debugPopup("storage-read-complete", {
    durationMs: storageDurationMs,
    siteCount: store.sites.length,
    enabledSiteCount: enabledSites.length,
  });

  const renderStartedAt = performance.now();
  grid.replaceChildren();
  if (enabledSites.length === 0)
    grid.innerHTML =
      '<div class="empty">No enabled site profiles.</div>';
  else enabledSites.forEach((site) => grid.append(renderSite(site)));

  const renderDurationMs = Number(
    (performance.now() - renderStartedAt).toFixed(1),
  );
  performance.mark("header-login-popup-ready");
  performance.measure("header-login-popup-total", {
    start: "header-login-popup-start",
    end: "header-login-popup-ready",
  });
  debugPopup("render-complete", {
    durationMs: renderDurationMs,
    totalDurationMs: Number((performance.now() - popupStartedAt).toFixed(1)),
  });
}

start().catch((error) => {
  debugPopup("startup-error", {
    error: error instanceof Error ? error.message : String(error),
  });
  showNotice(error.message, "error");
});
