/** Local-only account purchase/expense helpers. Price is stored in CNY. */
export function parseCodexActualSpendCnyInput(
  value: string,
): number | null | undefined {
  // Keep validation strict: silently deleting separators would turn inputs such
  // as `35,50` or `1 2` into a different price (3550 / 12).
  const normalized = value.trim().replace(/^[￥¥]\s*/, "");
  if (!normalized) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) {
    return undefined;
  }
  return parsed;
}

export function formatCodexActualSpendCny(
  value: number | null | undefined,
): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "—";
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCodexActualSpendCnyDraft(
  value: number | null | undefined,
): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "";
  }
  return String(Math.round(value * 100) / 100);
}

export function formatCodexEstimatedCostUsd(
  value: number | null | undefined,
): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "—";
  }
  if (value === 0) {
    return "$0.00";
  }
  if (value < 0.000001) return "<$0.000001";
  if (value < 0.01) return `$${value.toFixed(6)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

/**
 * This is a local value ratio: the manually entered CNY price divided by the
 * locally estimated USD model value. It intentionally does not exchange currencies.
 */
export function calculateCodexAccountCostMultiplier(
  actualSpendCny: number | null | undefined,
  estimatedCostUsd: number | null | undefined,
): number | null {
  if (
    typeof actualSpendCny !== "number" ||
    !Number.isFinite(actualSpendCny) ||
    actualSpendCny < 0 ||
    typeof estimatedCostUsd !== "number" ||
    !Number.isFinite(estimatedCostUsd) ||
    estimatedCostUsd <= 0
  ) {
    return null;
  }
  return actualSpendCny / estimatedCostUsd;
}

export function formatCodexAccountCostMultiplier(
  value: number | null | undefined,
): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "—";
  }
  if (value >= 1000) return `${value.toFixed(0)}×`;
  if (value >= 100) return `${value.toFixed(1)}×`;
  if (value >= 10) return `${value.toFixed(2)}×`;
  if (value >= 1) return `${value.toFixed(3)}×`;
  if (value >= 0.01) return `${value.toFixed(3)}×`;
  if (value > 0) return "<0.01×";
  return "0×";
}
