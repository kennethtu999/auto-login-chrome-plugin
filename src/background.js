import { syncAutoLoginScripts } from "./services/content-scripts.js";
import { STORAGE_KEY } from "./shared/constants.js";

let pendingSync = Promise.resolve();
function sync() {
  pendingSync = pendingSync.catch(() => {}).then(syncAutoLoginScripts);
  pendingSync.catch((error) => console.error("Auto login script sync failed", error));
}

chrome.runtime.onInstalled.addListener(sync);
chrome.runtime.onStartup.addListener(sync);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) sync();
});
chrome.permissions.onAdded.addListener(sync);
chrome.permissions.onRemoved.addListener(sync);
