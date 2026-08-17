/**
 * CodeBuddy Suite 共享工具函数
 *
 * 用于解析账号数据、配额信息等的通用工具函数
 */

import { PACKAGE_CODE, RESOURCE_STATUS, CodebuddySuiteAccountBase } from '../../types/codebuddy-suite';

/**
 * 将未知值转换为 Record 对象
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/**
 * 解析数值
 */
export function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * 解析日期时间字符串为 Epoch 时间戳
 */
export function parseDateTimeToEpoch(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  const isoText = text.includes('T') ? text : text.replace(' ', 'T');
  const parsed = Date.parse(isoText);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 解析周期配额总量
 */
export function parseCycleTotal(a: Record<string, unknown>): number {
  return (
    parseNumeric(a.CycleCapacitySizePrecise) ?? parseNumeric(a.CycleCapacitySize) ?? parseNumeric(a.CapacitySizePrecise) ?? parseNumeric(a.CapacitySize) ?? 0
  );
}

/**
 * 解析周期配额剩余量
 */
export function parseCycleRemain(a: Record<string, unknown>): number {
  return (
    parseNumeric(a.CycleCapacityRemainPrecise) ?? parseNumeric(a.CycleCapacityRemain) ?? parseNumeric(a.CapacityRemainPrecise) ?? parseNumeric(a.CapacityRemain) ?? 0
  );
}

/**
 * 检查是否为活跃资源
 */
export function isActiveResource(a: Record<string, unknown>): boolean {
  const s = typeof a.Status === 'number' ? a.Status : -1;
  return s === RESOURCE_STATUS.valid || s === RESOURCE_STATUS.usedUp;
}

/**
 * 检查是否为加量包
 */
export function isExtraPackage(a: Record<string, unknown>): boolean {
  return typeof a.PackageCode === 'string' && a.PackageCode === PACKAGE_CODE.extra;
}

/**
 * 检查是否为试用或免费月包
 */
export function isTrialOrFreeMonPackage(a: Record<string, unknown>): boolean {
  const code = typeof a.PackageCode === 'string' ? a.PackageCode : '';
  return code === PACKAGE_CODE.gift || code === PACKAGE_CODE.freeMon;
}

/**
 * 检查是否为专业版包
 */
export function isProPackage(a: Record<string, unknown>): boolean {
  if (isTrialOrFreeMonPackage(a)) return false;
  const code = typeof a.PackageCode === 'string' ? a.PackageCode : '';
  return code === PACKAGE_CODE.proMon || code === PACKAGE_CODE.proYear;
}

/**
 * 提取资源账号列表
 */
export function extractResourceAccounts(account: CodebuddySuiteAccountBase): Array<Record<string, unknown>> {
  const usageRoot = asRecord(account.usage_raw);
  const quotaRoot = asRecord(account.quota_raw);
  const userResource = asRecord(quotaRoot?.userResource) ?? usageRoot;
  const data = asRecord(userResource?.data);
  const response = asRecord(data?.Response);
  const payload = asRecord(response?.Data);
  const list = Array.isArray(payload?.Accounts) ? (payload!.Accounts as unknown[]) : [];
  return list.filter((a): a is Record<string, unknown> => a != null && typeof a === 'object');
}

/**
 * 获取账号配额更新时间（毫秒）
 */
export function getAccountQuotaUpdatedAtMs(account: CodebuddySuiteAccountBase): number | null {
  const lastUsed = account.last_used;
  if (typeof lastUsed !== 'number' || !Number.isFinite(lastUsed) || lastUsed <= 0) return null;
  return Math.trunc(lastUsed * 1000);
}

/**
 * 聚合周期资源
 */
export function aggregateCycleResources(list: Array<Record<string, unknown>>): Record<string, unknown> | null {
  if (list.length === 0) return null;
  const first = list[0];
  const totals = list.reduce(
    (acc: { total: number; remain: number }, item) => {
      acc.total += parseCycleTotal(item);
      acc.remain += parseCycleRemain(item);
      return acc;
    },
    { total: 0, remain: 0 },
  );
  return {
    ...first,
    CycleCapacitySizePrecise: String(totals.total),
    CycleCapacityRemainPrecise: String(totals.remain),
  };
}