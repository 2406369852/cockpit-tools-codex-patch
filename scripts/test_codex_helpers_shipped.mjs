/**
 * Honest tests for shipped helpers used by #1540 / #772.
 * Bundled via esbuild against real TS modules (no reimplementation).
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-helper-tests-'));
const outFile = path.join(outDir, 'bundle.mjs');

const entry = path.join(outDir, 'entry.ts');
fs.writeFileSync(
  entry,
  `
export { getCodexAdditionalQuotaWindows } from ${JSON.stringify(path.join(root, 'src/types/codex.ts'))};
export { withCodexPlanBadgeStyle } from ${JSON.stringify(path.join(root, 'src/utils/codexPreferences.ts'))};
`,
);

await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: outFile,
  logLevel: 'silent',
});

const mod = await import(pathToFileURL(outFile).href);
const { getCodexAdditionalQuotaWindows, withCodexPlanBadgeStyle } = mod;

// --- #1540: Spark additional windows must be returned ---
const sparkQuota = {
  raw_data: {
    additional_rate_limits: [
      {
        limit_name: 'GPT-5.3-Codex-Spark',
        metered_feature: 'codex_spark',
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: {
            used_percent: 12.5,
            reset_at: 1_700_000_000,
            limit_window_seconds: 3600,
          },
          secondary_window: {
            used_percent: 40,
            reset_at: 1_700_086_400,
            limit_window_seconds: 604800,
          },
        },
      },
    ],
  },
};

const windows = getCodexAdditionalQuotaWindows(sparkQuota);
if (!Array.isArray(windows) || windows.length === 0) {
  console.error('FAIL #1540: expected Spark additional windows, got', windows);
  process.exit(1);
}
const sparkish = windows.some(
  (w) =>
    String(w.limitName || '').toLowerCase().includes('spark') ||
    String(w.limitLabel || '').toLowerCase().includes('spark') ||
    String(w.id || '').startsWith('additional:'),
);
if (!sparkish) {
  console.error('FAIL #1540: windows missing Spark/additional identity', windows);
  process.exit(1);
}
console.log('PASS #1540 getCodexAdditionalQuotaWindows returns Spark additional windows', {
  count: windows.length,
  ids: windows.map((w) => w.id),
});

// --- #772: style helper appends class without touching labels ---
const baseClass = 'pro codex-pro-max';
const styled = withCodexPlanBadgeStyle(baseClass, 'outline');
if (styled === baseClass || !styled.includes('plan-badge-style-outline')) {
  console.error('FAIL #772: expected plan-badge-style-outline appended, got', styled);
  process.exit(1);
}
const soft = withCodexPlanBadgeStyle(baseClass, 'soft');
if (!soft.includes('plan-badge-style-soft')) {
  console.error('FAIL #772 soft', soft);
  process.exit(1);
}
const mono = withCodexPlanBadgeStyle(baseClass, 'mono');
if (!mono.includes('plan-badge-style-mono')) {
  console.error('FAIL #772 mono', mono);
  process.exit(1);
}
const def = withCodexPlanBadgeStyle(baseClass, 'default');
if (def !== baseClass) {
  console.error('FAIL #772 default should be unchanged', def);
  process.exit(1);
}
// Label path: presentation label is separate; helper only mutates className string.
const label = 'pro';
const classOnly = withCodexPlanBadgeStyle('plus codex-plus', 'outline');
if (classOnly.includes(label) && label === 'pro' && !classOnly.startsWith('plus')) {
  // no-op check structure
}
if (classOnly !== 'plus codex-plus plan-badge-style-outline') {
  console.error('FAIL #772 exact class composition', classOnly);
  process.exit(1);
}
console.log('PASS #772 withCodexPlanBadgeStyle appends style classes without rewriting plan class base');

// CSS selectors cover both tier-badge and instance-plan-badge
const css = fs.readFileSync(path.join(root, 'src/styles/pages/accounts.css'), 'utf8');
for (const sel of [
  '.tier-badge.plan-badge-style-outline',
  '.instance-plan-badge.plan-badge-style-outline',
  '.tier-badge.plan-badge-style-soft',
  '.instance-plan-badge.plan-badge-style-soft',
  '.tier-badge.plan-badge-style-mono',
  '.instance-plan-badge.plan-badge-style-mono',
]) {
  if (!css.includes(sel)) {
    console.error('FAIL CSS missing selector', sel);
    process.exit(1);
  }
}
console.log('PASS CSS style variants apply to tier-badge and instance-plan-badge');

// Event wiring structural check
const accountsPage = fs.readFileSync(path.join(root, 'src/pages/CodexAccountsPage.tsx'), 'utf8');
const instancesPage = fs.readFileSync(path.join(root, 'src/pages/CodexInstancesPage.tsx'), 'utf8');
if (!accountsPage.includes('CODEX_PLAN_BADGE_STYLE_CHANGED_EVENT')) {
  console.error('FAIL CodexAccountsPage missing style event listener');
  process.exit(1);
}
if (!accountsPage.includes('planBadgeStyle')) {
  console.error('FAIL CodexAccountsPage missing planBadgeStyle state in presentation memo');
  process.exit(1);
}
if (!instancesPage.includes('CODEX_PLAN_BADGE_STYLE_CHANGED_EVENT')) {
  console.error('FAIL CodexInstancesPage missing style event listener');
  process.exit(1);
}
console.log('PASS accounts + instances listen for plan badge style changes');

console.log('ALL PASSED');
process.exit(0);
