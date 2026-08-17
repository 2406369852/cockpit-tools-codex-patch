import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCodexAccountCostMultiplier,
  formatCodexAccountCostMultiplier,
  formatCodexEstimatedCostUsd,
  parseCodexActualSpendCnyInput,
} from './codexAccountCost.ts';

test('actual CNY price parsing preserves empty and zero semantics', () => {
  assert.equal(parseCodexActualSpendCnyInput(''), null);
  assert.equal(parseCodexActualSpendCnyInput('  '), null);
  assert.equal(parseCodexActualSpendCnyInput('0'), 0);
  assert.equal(parseCodexActualSpendCnyInput('￥ 35.50'), 35.5);
});

test('actual CNY price parsing rejects ambiguous separators', () => {
  assert.equal(parseCodexActualSpendCnyInput('35,50'), undefined);
  assert.equal(parseCodexActualSpendCnyInput('1 2'), undefined);
  assert.equal(parseCodexActualSpendCnyInput('1,000.00'), undefined);
});

test('actual CNY price parsing enforces range and precision', () => {
  assert.equal(parseCodexActualSpendCnyInput('12.345'), undefined);
  assert.equal(parseCodexActualSpendCnyInput('-1'), undefined);
  assert.equal(parseCodexActualSpendCnyInput('1000000.00'), 1_000_000);
  assert.equal(parseCodexActualSpendCnyInput('1000000.01'), undefined);
});

test('account value ratio keeps fractional values readable', () => {
  assert.equal(calculateCodexAccountCostMultiplier(35, 70), 0.5);
  assert.equal(formatCodexAccountCostMultiplier(0.5), '0.500×');
  assert.equal(formatCodexAccountCostMultiplier(0.01), '0.010×');
  assert.equal(formatCodexAccountCostMultiplier(0.009), '<0.01×');
});

test('missing local usage is distinct from a measured zero', () => {
  assert.equal(formatCodexEstimatedCostUsd(undefined), '—');
  assert.equal(formatCodexEstimatedCostUsd(null), '—');
  assert.equal(formatCodexEstimatedCostUsd(0), '$0.00');
});
