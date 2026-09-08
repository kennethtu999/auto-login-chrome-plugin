import { ENABLED_KEY } from "../shared/constants.js";

export async function isManagerEnabled() {
  const result = await chrome.storage.local.get(ENABLED_KEY);
  return result[ENABLED_KEY] !== false;
}

export async function setManagerEnabled(enabled) {
  await chrome.storage.local.set({ [ENABLED_KEY]: Boolean(enabled) });
  return Boolean(enabled);
}
