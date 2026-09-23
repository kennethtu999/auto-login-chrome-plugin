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
  for (const login of site.logins ?? []) {
    const loginButton = document.createElement("button");
    loginButton.className = "button small";
    loginButton.type = "button";
    loginButton.textContent = login.name;
    loginButton.title = `Log in as ${login.name}`;
    loginButton.addEventListener("click", async () => {
      loginButton.disabled = true;
      const closeTimer = setTimeout(() => window.close(), 1000);
      try {
        const { runLoginOnActiveTab } = await import(
          "../services/login-runner.js"
        );
        const result = await runLoginOnActiveTab(site, login);
        showNotice(`${login.name}: filled ${result.filledFields} field(s).`);
      } catch (error) {
        clearTimeout(closeTimer);
        showNotice(error.message, "error");
      } finally {
        loginButton.disabled = false;
      }
    });
    loginActions.append(loginButton);
  }

  actions.append(loginActions);
  row.append(siteLink, actions);
  return row;
}

async function start() {
  debugPopup("storage-read-start");
  const storageStartedAt = performance.now();
  const result = await chrome.storage.local.get("headerLoginManager.profileStore");
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
