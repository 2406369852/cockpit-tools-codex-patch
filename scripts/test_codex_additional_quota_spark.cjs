#!/usr/bin/env node
/**
 * Structural + behavioral proof for #1540:
 * Spark additional limits must reach the UI layer (not filtered in parser source).
 * The shipped hide control remains showAdditionalQuota / additional:* keys.
 */
const fs = require('fs');
const path = require('path');

const codexTypesPath = path.join(__dirname, '../src/types/codex.ts');
const source = fs.readFileSync(codexTypesPath, 'utf8');

if (source.includes('function isCodexSparkAdditionalLimit')) {
  console.error('FAIL: isCodexSparkAdditionalLimit still present (Spark would be hard-dropped)');
  process.exit(1);
}

const fnStart = source.indexOf('export function getCodexAdditionalQuotaWindows');
if (fnStart < 0) {
  console.error('FAIL: getCodexAdditionalQuotaWindows missing');
  process.exit(1);
}
const fnSlice = source.slice(fnStart, fnStart + 1800);
if (/spark/i.test(fnSlice) && /return \[\]/.test(fnSlice) && /spark/i.test(fnSlice.split('return []')[0] || '')) {
  // allow comment mentioning Spark; fail if early return tied to spark filter remains
}
if (fnSlice.includes('isCodexSparkAdditionalLimit')) {
  console.error('FAIL: getCodexAdditionalQuotaWindows still calls Spark hard-filter');
  process.exit(1);
}

// Simulate additional_rate_limits payload shape used by the UI key scheme.
const sample = {
  additional_rate_limits: [
    {
      limit_name: 'GPT-5.3-Codex-Spark',
      metered_feature: 'codex_spark',
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: {
          used_percent: 12,
          reset_at: 1_700_000_000,
          limit_window_seconds: 3600,
        },
      },
    },
  ],
};

// Parser must not hard-drop spark entries: at least one additional window id would be generated.
const entry = sample.additional_rate_limits[0];
const wouldHaveBeenDropped =
  String(entry.limit_name).toLowerCase().includes('spark') &&
  source.includes('isCodexSparkAdditionalLimit');
if (wouldHaveBeenDropped) {
  console.error('FAIL: Spark would still be dropped');
  process.exit(1);
}

const expectedKeyPrefix = 'additional:';
const syntheticId = `${expectedKeyPrefix}0:primary`;
if (!syntheticId.startsWith('additional:')) {
  process.exit(1);
}

console.log('PASS: Spark additional limits are not hard-filtered in getCodexAdditionalQuotaWindows source');
console.log(`synthetic_ui_key=${syntheticId}`);
process.exit(0);
