import { originPatterns } from "../utils/validation.js";

export async function hasSitePermission(domain) {
  return chrome.permissions.contains({ origins: originPatterns(domain) });
}

export async function requestSitePermission(domain) {
  return chrome.permissions.request({ origins: originPatterns(domain) });
}
