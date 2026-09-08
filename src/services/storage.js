import { STORAGE_KEY, emptyStore } from "../shared/constants.js";
import { validateStore } from "../utils/validation.js";

export async function loadStore() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (!result[STORAGE_KEY]) return emptyStore();
  try {
    return validateStore(result[STORAGE_KEY]);
  } catch (error) {
    console.warn(
      "Stored site profiles are invalid; using an empty store.",
      error,
    );
    return emptyStore();
  }
}

export async function saveStore(store) {
  const normalized = validateStore(store);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

export async function saveSite(site) {
  const store = await loadStore();
  const index = store.sites.findIndex((candidate) => candidate.id === site.id);
  if (index >= 0) store.sites[index] = site;
  else store.sites.push(site);
  return saveStore(store);
}

export async function deleteSite(siteId) {
  const store = await loadStore();
  store.sites = store.sites.filter((site) => site.id !== siteId);
  return saveStore(store);
}
