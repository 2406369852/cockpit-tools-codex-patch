import {
  getClaudeQuotaClass,
  getClaudeRemainingPercentage,
  getClaudeRemainingQuotaClass,
} from '../types/claude.ts';

const STORAGE_KEY = 'agtools.claude.quota_display_remaining.v1';
export const CLAUDE_QUOTA_DISPLAY_REMAINING_CHANGED_EVENT =
  'claude-quota-display-remaining-changed';

/** Default: used% (previous product behavior). Remaining% is opt-in. */
export function isClaudeQuotaDisplayRemainingEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setClaudeQuotaDisplayRemainingEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore quota / private mode failures
  }
  window.dispatchEvent(new Event(CLAUDE_QUOTA_DISPLAY_REMAINING_CHANGED_EVENT));
}

export function resolveClaudeDisplayPercentage(usedPercent: number): number {
  if (isClaudeQuotaDisplayRemainingEnabled()) {
    return getClaudeRemainingPercentage(usedPercent);
  }
  if (!Number.isFinite(usedPercent)) return 0;
  return Math.max(0, Math.min(100, Math.round(usedPercent)));
}

/** Class for a raw used% value (warning tones always follow usage). */
export function resolveClaudeDisplayQuotaClass(usedPercent: number): string {
  if (isClaudeQuotaDisplayRemainingEnabled()) {
    return getClaudeRemainingQuotaClass(getClaudeRemainingPercentage(usedPercent));
  }
  return getClaudeQuotaClass(usedPercent);
}

/** Class for an already-resolved display percentage. */
export function resolveClaudeQuotaClassForDisplayValue(displayPercent: number): string {
  if (isClaudeQuotaDisplayRemainingEnabled()) {
    return getClaudeRemainingQuotaClass(displayPercent);
  }
  return getClaudeQuotaClass(displayPercent);
}
