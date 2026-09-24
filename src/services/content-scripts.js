import { loadStore } from "./storage.js";
import { hasSitePermission } from "./permissions.js";
import { originPatterns } from "../utils/validation.js";

const SCRIPT_PREFIX = "auto-login-";

export async function syncAutoLoginScripts() {
  const store = await loadStore();
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const ids = registered.map((script) => script.id).filter((id) => id.startsWith(SCRIPT_PREFIX));
  if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
  const scripts = [];
  for (const site of store.sites) {
    if (site.enabled === false || !(await hasSitePermission(site.domain))) continue;
    scripts.push({
      id: `${SCRIPT_PREFIX}${site.id}`,
      matches: originPatterns(site.domain),
      js: ["src/content/auto-login.js"],
      allFrames: true,
      runAt: "document_idle",
      persistAcrossSessions: true,
    });
  }
  if (scripts.length) await chrome.scripting.registerContentScripts(scripts);
}
