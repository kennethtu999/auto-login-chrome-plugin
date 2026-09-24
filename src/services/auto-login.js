import { AUTO_LOGIN_KEY } from "../shared/constants.js";

export async function loadAutoLogin() {
  const data = await chrome.storage.local.get(AUTO_LOGIN_KEY);
  return data[AUTO_LOGIN_KEY] && typeof data[AUTO_LOGIN_KEY] === "object"
    ? data[AUTO_LOGIN_KEY]
    : {};
}

export async function saveAutoLogin(siteId, patch) {
  const state = await loadAutoLogin();
  if (patch.enabled === true) {
    for (const [otherSiteId, setting] of Object.entries(state)) {
      if (otherSiteId !== siteId && setting?.enabled)
        state[otherSiteId] = { ...setting, enabled: false };
    }
  }
  state[siteId] = { ...state[siteId], ...patch };
  await chrome.storage.local.set({ [AUTO_LOGIN_KEY]: state });
  return state[siteId];
}
