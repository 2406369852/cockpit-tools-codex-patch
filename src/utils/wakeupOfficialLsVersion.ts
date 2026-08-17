export type WakeupOfficialLsVersionMode = 'gte_1_21_6' | 'lt_1_21_6';

export const DEFAULT_WAKEUP_OFFICIAL_LS_VERSION_MODE: WakeupOfficialLsVersionMode = 'gte_1_21_6';
export const WAKEUP_OFFICIAL_LS_VERSION_STORAGE_KEY = 'agtools.wakeup.official_ls_version_mode';
export const WAKEUP_OFFICIAL_LS_VERSION_CHANGED_EVENT = 'wakeup-official-ls-version-mode-changed';

export function normalizeWakeupOfficialLsVersionMode(
  value?: string | null,
): WakeupOfficialLsVersionMode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'lt_1_21_6' || normalized === '<1.21.6') {
    return 'lt_1_21_6';
  }
  return DEFAULT_WAKEUP_OFFICIAL_LS_VERSION_MODE;
}

export function loadWakeupOfficialLsVersionMode(): WakeupOfficialLsVersionMode {
  if (typeof window === 'undefined') {
    return DEFAULT_WAKEUP_OFFICIAL_LS_VERSION_MODE;
  }
  const raw = localStorage.getItem(WAKEUP_OFFICIAL_LS_VERSION_STORAGE_KEY);
  return normalizeWakeupOfficialLsVersionMode(raw);
}

export function saveWakeupOfficialLsVersionMode(mode: WakeupOfficialLsVersionMode): void {
  if (typeof window === 'undefined') return;
  const next = normalizeWakeupOfficialLsVersionMode(mode);
  localStorage.setItem(WAKEUP_OFFICIAL_LS_VERSION_STORAGE_KEY, next);
  window.dispatchEvent(
    new CustomEvent<WakeupOfficialLsVersionMode>(WAKEUP_OFFICIAL_LS_VERSION_CHANGED_EVENT, {
      detail: next,
    }),
  );
}

export function wakeupOfficialLsVersionRequiresRandomPort(
  mode: WakeupOfficialLsVersionMode,
): boolean {
  return mode === 'lt_1_21_6';
}
