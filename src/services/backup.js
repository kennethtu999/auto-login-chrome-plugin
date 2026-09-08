import { validateStore } from "../utils/validation.js";

export const BACKUP_SCHEMA = "header-login-manager-backup/v1";

export function createBackup(store, exportedAt = new Date().toISOString()) {
  return {
    schema: BACKUP_SCHEMA,
    exportedAt,
    store: validateStore(store),
  };
}

export function parseBackup(serializedBackup) {
  let backup;
  try {
    backup = JSON.parse(serializedBackup);
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }
  if (!backup || backup.schema !== BACKUP_SCHEMA) {
    throw new Error(
      "Backup schema is unsupported. Expected header-login-manager-backup/v1.",
    );
  }
  if (
    !backup.store ||
    backup.store.schemaVersion !== 1 ||
    !Array.isArray(backup.store.sites)
  ) {
    throw new Error("Backup does not contain a valid Site Profile store.");
  }
  try {
    return { ...backup, store: validateStore(backup.store) };
  } catch (error) {
    throw new Error(`Backup Site Profile validation failed: ${error.message}`);
  }
}
