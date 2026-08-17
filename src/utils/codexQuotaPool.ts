import type { CodexAccount } from '../types/codex';
import {
  getCodexPlanFilterKey,
  getCodexQuotaWindows,
} from '../types/codex';
import { sortCodexPlanFilterKeys } from './codexAccountOverview';

export interface CodexQuotaPoolWindow {
  key: string;
  label: string;
  percentage: number;
  accountCount: number;
  windowMinutes: number;
}

export interface CodexQuotaPoolItem {
  key: string;
  count: number;
  windows: CodexQuotaPoolWindow[];
}

export interface CodexQuotaPoolSummary {
  all: CodexQuotaPoolItem;
  byPlan: Record<string, CodexQuotaPoolItem>;
  visiblePlans: CodexQuotaPoolItem[];
}

function createQuotaPoolItem(key: CodexQuotaPoolItem['key']): CodexQuotaPoolItem {
  return { key, count: 0, windows: [] };
}

function addAccountToQuotaPool(target: CodexQuotaPoolItem, account: CodexAccount): void {
  target.count += 1;
  const seenWindowKeys = new Set<string>();
  getCodexQuotaWindows(account.quota).forEach((window) => {
    const key = window.label.trim().toLowerCase();
    const windowMinutes =
      window.windowMinutes ?? (window.id === 'secondary' ? 7 * 24 * 60 : 5 * 60);
    let pooledWindow = target.windows.find((item) => item.key === key);
    if (!pooledWindow) {
      pooledWindow = {
        key,
        label: window.label,
        percentage: 0,
        accountCount: 0,
        windowMinutes,
      };
      target.windows.push(pooledWindow);
    }
    pooledWindow.percentage += window.percentage;
    pooledWindow.windowMinutes = Math.min(pooledWindow.windowMinutes, windowMinutes);
    if (!seenWindowKeys.has(key)) {
      pooledWindow.accountCount += 1;
      seenWindowKeys.add(key);
    }
  });
  target.windows.sort(
    (left, right) =>
      left.windowMinutes - right.windowMinutes || left.label.localeCompare(right.label),
  );
}

export function summarizeCodexQuotaPool(accounts: CodexAccount[]): CodexQuotaPoolSummary {
  const byPlan: Record<string, CodexQuotaPoolItem> = {};
  const all = createQuotaPoolItem('ALL');

  accounts.forEach((account) => {
    addAccountToQuotaPool(all, account);
    const planKey = getCodexPlanFilterKey(account);
    byPlan[planKey] ??= createQuotaPoolItem(planKey);
    addAccountToQuotaPool(byPlan[planKey], account);
  });

  return {
    all,
    byPlan,
    visiblePlans: sortCodexPlanFilterKeys(Object.keys(byPlan)).map(
      (key) => byPlan[key],
    ),
  };
}

export function formatCodexQuotaPoolPercent(value: number): string {
  return `${Math.max(0, Math.round(value))}%`;
}

export function formatCodexQuotaPoolWindowLabel(
  label: string,
  weeklyLabel: string,
): string {
  return label === 'Weekly' ? weeklyLabel : label;
}
