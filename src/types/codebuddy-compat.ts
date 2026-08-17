/**
 * CodeBuddy CN 兼容性函数
 *
 * 提供向后兼容的函数名称（getCodebuddy* 等旧命名）
 */

import type { CodebuddyCnAccount, CodebuddyPlanDetail, CodebuddyUsage, OfficialQuotaModel, QuotaDisplayItem, QuotaCategoryGroup } from './codebuddy-suite';
import type { CodebuddyResourceSummary, CodebuddyExtraCreditSummary } from './codebuddy';
import {
  PACKAGE_CODE,
} from './codebuddy-suite';
import {
  getAccountDisplayEmail,
  getAccountDisplayName,
  getPlanDetail,
  getPlanBadge,
  getPlanBadgeClass,
  getUsage,
  getAccountStatus,
  getCreditsBalance,
  getOfficialQuotaModel,
  getQuotaDisplayItems,
  getQuotaCategoryGroups,
  extractResourceAccounts,
  isActiveResource,
  isExtraPackage,
  parseNumeric,
  getAccountQuotaUpdatedAtMs,
} from '../utils/codebuddy-suite';

/**
 * @deprecated 使用 getAccountDisplayEmail
 */
export function getCodebuddyAccountDisplayEmail(account: CodebuddyCnAccount): string {
  return getAccountDisplayEmail(account);
}

/**
 * @deprecated 使用 getAccountDisplayName
 */
export function getCodebuddyAccountDisplayName(account: CodebuddyCnAccount): string {
  return getAccountDisplayName(account);
}

/**
 * @deprecated 使用 getPlanDetail
 */
export function getCodebuddyPlanDetail(account: CodebuddyCnAccount): CodebuddyPlanDetail {
  return getPlanDetail(account);
}

/**
 * @deprecated 使用 getPlanBadge
 */
export function getCodebuddyPlanBadge(account: CodebuddyCnAccount): string {
  return getPlanBadge(account);
}

/**
 * @deprecated 使用 getPlanBadgeClass
 */
export function getCodebuddyPlanBadgeClass(badge: string): string {
  return getPlanBadgeClass(badge);
}

/**
 * @deprecated 使用 getUsage
 */
export function getCodebuddyUsage(account: CodebuddyCnAccount): CodebuddyUsage {
  return getUsage(account);
}

/**
 * @deprecated 使用 getAccountStatus
 */
export function getCodebuddyAccountStatus(account: CodebuddyCnAccount): string {
  return getAccountStatus(account);
}

/**
 * @deprecated 使用 getCreditsBalance
 */
export function getCodebuddyCreditsBalance(account: CodebuddyCnAccount): number | null {
  return getCreditsBalance(account);
}

/**
 * @deprecated 使用 getOfficialQuotaModel
 */
export function getCodebuddyOfficialQuotaModel(account: CodebuddyCnAccount): OfficialQuotaModel {
  return getOfficialQuotaModel(account);
}

/**
 * @deprecated 使用 getQuotaDisplayItems
 */
export function getCodebuddyQuotaDisplayItems(account: CodebuddyCnAccount): QuotaDisplayItem[] {
  return getQuotaDisplayItems(account);
}

/**
 * @deprecated 使用 getQuotaCategoryGroups
 */
export function getCodebuddyQuotaCategoryGroups(
  account: CodebuddyCnAccount,
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string
): QuotaCategoryGroup[] {
  return getQuotaCategoryGroups(account, t);
}

/**
 * @deprecated 资源聚合摘要，保留向后兼容
 */
export function getCodebuddyResourceSummary(account: CodebuddyCnAccount): CodebuddyResourceSummary | null {
  const all = extractResourceAccounts(account);
  if (all.length === 0) return null;

  const active = all.filter((a) => isActiveResource(a) && !isExtraPackage(a));
  if (active.length === 0) return null;

  const codePriority: Record<string, number> = {
    [PACKAGE_CODE.proYear]: 0,
    [PACKAGE_CODE.proMon]: 1,
    [PACKAGE_CODE.gift]: 2,
    [PACKAGE_CODE.activity]: 3,
    [PACKAGE_CODE.freeMon]: 4,
    [PACKAGE_CODE.free]: 5,
  };
  const primaryPkg = [...active].sort((a, b) => {
    const ca = typeof a.PackageCode === 'string' ? a.PackageCode : '';
    const cb = typeof b.PackageCode === 'string' ? b.PackageCode : '';
    return (codePriority[ca] ?? 99) - (codePriority[cb] ?? 99);
  })[0];

  let totalAgg = 0;
  let remainAgg = 0;
  let usedAgg = 0;
  for (const a of active) {
    totalAgg += parseNumeric(a.CapacitySizePrecise) ?? parseNumeric(a.CapacitySize) ?? 0;
    remainAgg += parseNumeric(a.CapacityRemainPrecise) ?? parseNumeric(a.CapacityRemain) ?? 0;
    usedAgg += parseNumeric(a.CapacityUsedPrecise) ?? parseNumeric(a.CapacityUsed) ?? 0;
  }

  const total = totalAgg || null;
  const remain = remainAgg;
  const used = usedAgg;
  const usedPercent = total && total > 0 ? Math.max(0, Math.min(100, (used / total) * 100)) : 0;
  const remainPercent = total && total > 0 ? Math.max(0, Math.min(100, (remain / total) * 100)) : null;
  const boundUpdatedAt = getAccountQuotaUpdatedAtMs(account);

  return {
    packageName: typeof primaryPkg.PackageName === 'string' ? primaryPkg.PackageName : null,
    cycleStartTime: typeof primaryPkg.CycleStartTime === 'string' ? primaryPkg.CycleStartTime : null,
    cycleEndTime: typeof primaryPkg.CycleEndTime === 'string' ? primaryPkg.CycleEndTime : null,
    remain,
    used,
    total,
    usedPercent,
    remainPercent,
    boundUpdatedAt,
  };
}

/**
 * @deprecated 加量包摘要，保留向后兼容
 */
export function getCodebuddyExtraCreditSummary(account: CodebuddyCnAccount): CodebuddyExtraCreditSummary {
  const all = extractResourceAccounts(account);
  const extras = all.filter((a) => isActiveResource(a) && isExtraPackage(a));

  let totalAgg = 0;
  let remainAgg = 0;
  for (const a of extras) {
    totalAgg += parseNumeric(a.CapacitySizePrecise) ?? parseNumeric(a.CapacitySize) ?? 0;
    remainAgg += parseNumeric(a.CapacityRemainPrecise) ?? parseNumeric(a.CapacityRemain) ?? 0;
  }

  const usedAgg = Math.max(0, totalAgg - remainAgg);
  const usedPercent = totalAgg > 0 ? Math.max(0, Math.min(100, (usedAgg / totalAgg) * 100)) : 0;
  const remainPercent = totalAgg > 0 ? Math.max(0, Math.min(100, (remainAgg / totalAgg) * 100)) : null;
  return { remain: remainAgg, total: totalAgg, used: usedAgg, usedPercent, remainPercent };
}