const CODEX_IMPORT_SYNC_API_SERVICE_STORAGE_KEY =
  "agtools.codex.import.sync_api_service.v1";

export const readCodexImportSyncApiService = (): boolean => {
  try {
    return localStorage.getItem(CODEX_IMPORT_SYNC_API_SERVICE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const writeCodexImportSyncApiService = (enabled: boolean): void => {
  try {
    localStorage.setItem(
      CODEX_IMPORT_SYNC_API_SERVICE_STORAGE_KEY,
      enabled ? "true" : "false",
    );
  } catch {
    // Keep the in-memory choice when storage is unavailable.
  }
};
