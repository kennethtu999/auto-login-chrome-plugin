import { loadStore, saveStore } from "../services/storage.js";
import { isManagerEnabled } from "../services/manager-state.js";
import { syncHeaderRules } from "../services/header-rules.js";
import { hasSitePermission } from "../services/permissions.js";

const grid = document.querySelector("#site-grid");
const notice = document.querySelector("#notice");

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
  const siteEnabled = document.createElement("input");
  siteEnabled.type = "checkbox";
  siteEnabled.checked = site.enabled !== false;
  siteEnabled.setAttribute("aria-label", `Enable ${site.name}`);
  siteEnabled.title = `Enable ${site.name}`;
  siteEnabled.addEventListener("change", async () => {
    siteEnabled.disabled = true;
    try {
      const store = await loadStore();
      const savedSite = store.sites.find((candidate) => candidate.id === site.id);
      if (!savedSite) throw new Error("This site no longer exists.");
      savedSite.enabled = siteEnabled.checked;
      await saveStore(store);
      await syncHeaderRules(store.sites, hasSitePermission, await isManagerEnabled());
      showNotice(`${savedSite.name} ${siteEnabled.checked ? "enabled" : "disabled"}.`);
    } catch (error) {
      siteEnabled.checked = !siteEnabled.checked;
      showNotice(error.message, "error");
    } finally {
      siteEnabled.disabled = false;
    }
  });

  const manage = document.createElement("button");
  manage.className = "button secondary small";
  manage.type = "button";
  manage.textContent = "Manage";
  manage.addEventListener("click", () =>
    chrome.tabs.create({
      url: `${chrome.runtime.getURL("src/site/site.html")}?site=${encodeURIComponent(site.id)}`,
    }),
  );
  actions.append(siteEnabled, manage);
  row.append(siteLink, actions);
  return row;
}

async function start() {
  const store = await loadStore();
  grid.replaceChildren();
  if (store.sites.length === 0)
    grid.innerHTML =
      '<div class="empty">Create a site profile from Manage.</div>';
  else store.sites.forEach((site) => grid.append(renderSite(site)));
}
start().catch((error) => showNotice(error.message, "error"));
