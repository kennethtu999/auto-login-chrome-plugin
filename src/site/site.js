import { createId } from "../shared/constants.js";
import { loadStore, saveStore } from "../services/storage.js";
import {
  isManagerEnabled,
  setManagerEnabled,
} from "../services/manager-state.js";
import {
  hasSitePermission,
  requestSitePermission,
} from "../services/permissions.js";
import { syncHeaderRules } from "../services/header-rules.js";
import { validateSite } from "../utils/validation.js";
import { runLoginOnActiveTab } from "../services/login-runner.js";
import { createBackup, parseBackup } from "../services/backup.js";

const app = document.querySelector("#app");
const notice = document.querySelector("#notice");
const enabledToggle = document.querySelector("#enabled-toggle");
const diagnoseRulesButton = document.querySelector("#diagnose-rules");
const headerActions = document.querySelector("#header-actions");
let store;
let activeSiteId = new URLSearchParams(location.search).get("site");

function showNotice(message, type = "success") {
  notice.className = `notice ${type}`;
  notice.textContent = message;
}

function element(tag, options = {}) {
  const node = document.createElement(tag);
  Object.assign(node, options);
  return node;
}

function button(label, className = "button secondary small") {
  return element("button", { type: "button", className, textContent: label });
}

function field(labelText, value = "", type = "text") {
  const label = element("label", { className: "field" });
  label.append(document.createTextNode(labelText));
  label.append(element("input", { type, value }));
  return label;
}

function currentSite() {
  return store.sites.find((site) => site.id === activeSiteId);
}

async function persist(nextStore = store) {
  store = await saveStore(nextStore);
  const count = await syncHeaderRules(
    store.sites,
    hasSitePermission,
    await isManagerEnabled(),
  );
  console.info("Header Login Manager synced dynamic header rules.", {
    ruleCount: count,
  });
  return count;
}

enabledToggle.addEventListener("change", async () => {
  const wasEnabled = !enabledToggle.checked;
  enabledToggle.disabled = true;
  try {
    const enabled = await setManagerEnabled(enabledToggle.checked);
    const count = await syncHeaderRules(store.sites, hasSitePermission, enabled);
    showNotice(
      enabled
        ? `Header Login Manager enabled: ${count} header rule(s) active.`
        : "Header Login Manager disabled: no header rules are active.",
    );
  } catch (error) {
    try {
      await setManagerEnabled(wasEnabled);
    } catch (restoreError) {
      console.error("Could not restore the enabled state.", restoreError);
    }
    enabledToggle.checked = wasEnabled;
    showNotice(error.message, "error");
  } finally {
    enabledToggle.disabled = false;
  }
});

diagnoseRulesButton.addEventListener("click", async () => {
  diagnoseRulesButton.disabled = true;
  try {
    const enabled = await isManagerEnabled();
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const results = await Promise.all(
      store.sites.map(async (site) => {
        const permitted = await hasSitePermission(site.domain);
        const probe = await chrome.declarativeNetRequest.testMatchOutcome({
          url: `https://${site.domain}/`,
          type: "main_frame",
        });
        return { site, permitted, matches: probe.matchedRules.length };
      }),
    );
    const recent = await chrome.declarativeNetRequest.getMatchedRules();
    const summary = results
      .map(
        ({ site, permitted, matches }) =>
          `${site.domain}: ${permitted ? "permission granted" : "permission missing"}, ${matches} rule match(es)`,
      )
      .join("; ");
    showNotice(
      `Enabled: ${enabled}. Dynamic rules: ${rules.length}. Recent matches: ${recent.rulesMatchedInfo.length}. ${summary}`,
      results.every((result) => result.permitted && result.matches > 0)
        ? "success"
        : "error",
    );
  } catch (error) {
    showNotice(`Rule check failed: ${error.message}`, "error");
  } finally {
    diagnoseRulesButton.disabled = false;
  }
});

function renderHome() {
  activeSiteId = null;
  headerActions.classList.remove("editor-mode");
  headerActions.querySelector(".editor-back")?.remove();
  app.replaceChildren();
  if (store.sites.length === 0) {
    app.append(
      element("div", {
        className: "card empty",
        textContent:
          "No site profiles yet. Add a site to request its permission and configure headers or logins.",
      }),
    );
    return;
  }
  const grid = element("div", { className: "site-grid" });
  for (const site of store.sites) {
    const card = element("button", { type: "button", className: "site-card" });
    card.append(
      element("span", { className: "site-card-title", textContent: site.name }),
    );
    card.append(
      element("span", {
        className: "site-card-domain",
        textContent: site.domain,
      }),
    );
    card.append(
      element("span", {
        className: "site-card-domain",
        textContent: `${site.logins.length} login profile${site.logins.length === 1 ? "" : "s"}`,
      }),
    );
    card.addEventListener("click", () => {
      activeSiteId = site.id;
      renderEditor();
    });
    grid.append(card);
  }
  app.append(grid);
}

function createHeaderEditor(
  header = { id: createId(), key: "", value: "", enabled: true },
) {
  const row = element("div", { className: "field-row header-editor" });
  const key = field("Header name", header.key);
  key.querySelector("input").dataset.headerKey = "true";
  const value = field("Header value", header.value);
  value.querySelector("input").dataset.headerValue = "true";
  const actions = element("div", { className: "inline-actions" });
  const enabled = element("input", {
    type: "checkbox",
    checked: header.enabled !== false,
    title: "Enable header",
  });
  enabled.dataset.headerEnabled = "true";
  const remove = button("Delete", "button danger small");
  remove.addEventListener("click", () => row.remove());
  actions.append(enabled, remove);
  row.append(key, value, actions);
  return row;
}

function createLoginEditor(
  login = {
    id: createId(),
    name: "",
    submitButton: "",
    fields: [{ id: createId(), label: "", value: "" }],
  },
) {
  const block = element("section", { className: "editor-block login-editor" });
  const heading = element("div", { className: "section-heading" });
  heading.append(element("h3", { textContent: "Login profile" }));
  const removeProfile = button("Delete profile", "button danger small");
  removeProfile.addEventListener("click", () => block.remove());
  heading.append(removeProfile);
  block.append(heading);
  const name = field("Profile name", login.name);
  name.querySelector("input").dataset.loginName = "true";
  const submit = field("Submit button text", login.submitButton);
  submit.querySelector("input").dataset.loginSubmit = "true";
  const top = element("div", { className: "form-grid" });
  top.append(name, submit);
  block.append(top);
  const fieldList = element("div", { className: "login-field-list" });
  const addField = button("Add field");
  addField.addEventListener("click", () =>
    fieldList.append(createLoginField()),
  );
  const fieldHeading = element("div", { className: "section-heading" });
  fieldHeading.append(element("h3", { textContent: "Fields" }), addField);
  block.append(fieldHeading, fieldList);
  for (const item of login.fields) fieldList.append(createLoginField(item));
  return block;
}

function createLoginField(
  loginField = { id: createId(), label: "", value: "" },
) {
  const row = element("div", { className: "field-row login-field-editor" });
  const label = field("Page label", loginField.label);
  label.querySelector("input").dataset.fieldLabel = "true";
  const value = field("Value", loginField.value, "password");
  value.querySelector("input").dataset.fieldValue = "true";
  const remove = button("Delete", "button danger small");
  remove.addEventListener("click", () => row.remove());
  row.append(label, value, remove);
  return row;
}

function readHeaders(container) {
  return [...container.querySelectorAll(".header-editor")].map((row) => ({
    id: createId(),
    key: row.querySelector("[data-header-key]").value,
    value: row.querySelector("[data-header-value]").value,
    enabled: row.querySelector("[data-header-enabled]").checked,
  }));
}

function readLogins(container) {
  return [...container.querySelectorAll(".login-editor")].map((block) => ({
    id: createId(),
    name: block.querySelector("[data-login-name]").value,
    submitButton: block.querySelector("[data-login-submit]").value,
    fields: [...block.querySelectorAll(".login-field-editor")].map((row) => ({
      id: createId(),
      label: row.querySelector("[data-field-label]").value,
      value: row.querySelector("[data-field-value]").value,
    })),
  }));
}

function renderEditor(
  site = currentSite() ?? {
    id: createId(),
    name: "",
    domain: "",
    enabled: true,
    headers: [],
    logins: [],
  },
) {
  app.replaceChildren();
  const card = element("section", { className: "card stack" });
  const title = element("h2", { textContent: site.name || "New site" });
  const back = button("Back", "button editor-back");
  back.addEventListener("click", renderHome);
  headerActions.querySelector(".editor-back")?.remove();
  headerActions.classList.add("editor-mode");
  headerActions.prepend(back);
  card.append(title);
  const siteFields = element("div", { className: "form-grid" });
  const name = field("Site name", site.name);
  name.querySelector("input").dataset.siteName = "true";
  const domain = field("Exact domain", site.domain);
  domain.querySelector("input").dataset.siteDomain = "true";
  const defaultUrl = field(
    "Default URL",
    site.defaultUrl || (site.domain ? `https://${site.domain}/` : ""),
    "url",
  );
  defaultUrl.querySelector("input").dataset.siteDefaultUrl = "true";
  domain.querySelector("input").addEventListener("change", () => {
    const defaultUrlInput = defaultUrl.querySelector("input");
    if (!defaultUrlInput.value && domain.querySelector("input").value.trim())
      defaultUrlInput.value = `https://${domain.querySelector("input").value.trim()}/`;
  });
  const siteEnabled = element("label", { className: "enable-toggle" });
  const enabledInput = element("input", {
    type: "checkbox",
    checked: site.enabled !== false,
  });
  siteEnabled.append(enabledInput, document.createTextNode("Enable this site"));
  siteFields.append(name, domain, defaultUrl, siteEnabled);
  card.append(siteFields);
  const permission = element("div", {
    className: "permission",
    textContent:
      "Permission is requested when the Site is saved. Header rules remain inactive until permission is granted.",
  });
  card.append(permission);
  const headersHeading = element("div", { className: "section-heading" });
  const headers = element("div");
  const addHeader = button("Add header");
  addHeader.addEventListener("click", () =>
    headers.append(createHeaderEditor()),
  );
  headersHeading.append(element("h3", { textContent: "Headers" }), addHeader);
  card.append(headersHeading, headers);
  site.headers.forEach((header) => headers.append(createHeaderEditor(header)));
  const loginsHeading = element("div", { className: "section-heading" });
  const logins = element("div");
  const addLogin = button("Add login");
  addLogin.addEventListener("click", () => logins.append(createLoginEditor()));
  loginsHeading.append(
    element("h3", { textContent: "Login accounts" }),
    addLogin,
  );
  card.append(loginsHeading, logins);
  site.logins.forEach((login) => logins.append(createLoginEditor(login)));
  const actions = element("div", { className: "inline-actions" });
  const save = button("Save site", "button");
  save.addEventListener("click", async () => {
    try {
      const candidate = validateSite(
        {
          id: site.id,
          name: name.querySelector("input").value,
          domain: domain.querySelector("input").value,
          defaultUrl:
            defaultUrl.querySelector("input").value ||
            (domain.querySelector("input").value.trim()
              ? `https://${domain.querySelector("input").value.trim()}/`
              : ""),
          enabled: enabledInput.checked,
          headers: readHeaders(headers),
          logins: readLogins(logins),
        },
        store.sites,
      );
      const existingIndex = store.sites.findIndex(
        (item) => item.id === candidate.id,
      );
      if (
        !(await hasSitePermission(candidate.domain)) &&
        !(await requestSitePermission(candidate.domain))
      )
        throw new Error(`Permission was not granted for ${candidate.domain}.`);
      if (existingIndex >= 0) store.sites[existingIndex] = candidate;
      else store.sites.push(candidate);
      const count = await persist();
      activeSiteId = candidate.id;
      showNotice(
        `Site saved: ${count} header rule(s) active.`,
      );
      renderEditor();
    } catch (error) {
      showNotice(error.message, "error");
    }
  });
  actions.append(save);
  if (store.sites.some((item) => item.id === site.id)) {
    const remove = button("Delete site", "button danger");
    remove.addEventListener("click", async () => {
      if (!confirm(`Delete ${site.name}?`)) return;
      store.sites = store.sites.filter((item) => item.id !== site.id);
      await persist();
      showNotice("Site deleted.");
      renderHome();
    });
    actions.append(remove);
  }
  card.append(actions);
  if (site.logins.length) {
    const quickRun = element("div", { className: "inline-actions" });
    quickRun.append(
      element("span", {
        className: "muted",
        textContent: "Run from current tab:",
      }),
    );
    for (const login of site.logins) {
      const run = button(login.name);
      run.addEventListener("click", async () => {
        try {
          const result = await runLoginOnActiveTab(site, login);
          showNotice(`${login.name}: filled ${result.filledFields} field(s).`);
        } catch (error) {
          showNotice(error.message, "error");
        }
      });
      quickRun.append(run);
    }
    card.append(quickRun);
  }
  app.append(card);
}

document
  .querySelector("#new-site")
  .addEventListener("click", () => renderEditor());

document.querySelector("#export-backup").addEventListener("click", () => {
  const backup = createBackup(store);
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const download = element("a", {
    href: url,
    download: `header-login-manager-backup-${backup.exportedAt.slice(0, 10)}.json`,
  });
  download.click();
  URL.revokeObjectURL(url);
  showNotice(
    "Backup exported. Store this file securely because it contains credentials and Header values.",
  );
});

const importFile = document.querySelector("#import-file");
document
  .querySelector("#import-backup")
  .addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const [file] = importFile.files;
  importFile.value = "";
  if (!file) return;
  if (!confirm("Import will replace every current Site Profile. Continue?"))
    return;
  try {
    const backup = parseBackup(await file.text());
    await persist(backup.store);
    activeSiteId = null;
    renderHome();
    showNotice(
      "Backup restored. Re-save each Site to grant its host permission again after an extension reset.",
    );
  } catch (error) {
    showNotice(error.message, "error");
  }
});

loadStore()
  .then((loaded) => {
    store = loaded;
    return isManagerEnabled();
  })
  .then((enabled) => {
    enabledToggle.checked = enabled;
    if (currentSite()) renderEditor();
    else renderHome();
  })
  .catch((error) => showNotice(error.message, "error"));
