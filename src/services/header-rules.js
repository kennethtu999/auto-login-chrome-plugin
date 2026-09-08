import { MAX_DYNAMIC_RULES } from "../shared/constants.js";

function hashText(value) {
  let hash = 2166136261;
  for (const character of value)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 900000000) + 1;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileHeaderRules(sites) {
  const usedIds = new Set();
  const rules = [];
  for (const site of sites) {
    if (site.enabled === false) continue;
    const headers = site.headers.filter((header) => header.enabled);
    if (headers.length === 0) continue;
    let id = hashText(site.id);
    while (usedIds.has(id)) id = id === 900000000 ? 1 : id + 1;
    usedIds.add(id);
    rules.push({
      id,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: headers.map((header) => ({
          header: header.key,
          operation: "set",
          value: header.value,
        })),
      },
      // urlFilter with ||domain/ also matches subdomains; this must stay exact-host only.
      condition: {
        regexFilter: `^https?://${escapeRegex(site.domain)}(?::\\d+)?(?:/|$)`,
        // Chrome excludes main-frame navigations when no resource types are listed.
        // Include it explicitly so a direct visit to the saved Site receives headers.
        resourceTypes: [
          "main_frame",
          "sub_frame",
          "stylesheet",
          "script",
          "image",
          "font",
          "object",
          "xmlhttprequest",
          "ping",
          "csp_report",
          "media",
          "websocket",
          "webtransport",
          "webbundle",
          "other",
        ],
      },
    });
  }
  if (rules.length > MAX_DYNAMIC_RULES)
    throw new Error(
      `Too many header rules; Chrome allows at most ${MAX_DYNAMIC_RULES} dynamic modification rules.`,
    );
  return rules;
}

export async function syncHeaderRules(sites, isPermitted, enabled = true) {
  const allowedSites = [];
  if (enabled)
    for (const site of sites)
      if (await isPermitted(site.domain)) allowedSites.push(site);
  const addRules = compileHeaderRules(allowedSites);
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: currentRules.map((rule) => rule.id),
    addRules,
  });
  return addRules.length;
}
