export const STORAGE_KEY = "headerLoginManager.profileStore";
export const ENABLED_KEY = "headerLoginManager.enabled";
export const SCHEMA_VERSION = 1;
export const LOGIN_DELAY_MS = 50;
export const MAX_DYNAMIC_RULES = 5000;

export const emptyStore = () => ({ schemaVersion: SCHEMA_VERSION, sites: [] });
export const createId = () => crypto.randomUUID();
