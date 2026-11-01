import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importLedgerCsv } from '../src/import.ts';
import { simulateScenario } from '../src/scenario.ts';

const input = () => importLedgerCsv('date,vendor,category,amount,currency,kind\n2026-09-01,Tools,software,100,USD,expense\n2026-09-01,Sales,sales,1000,USD,revenue\n2026-09-02,Tools,software,10,USD,expense_refund\n2026-09-03,Bank,internal,200,USD,transfer\n2026-09-04,Tools,software,50,EUR,expense');

test('recomputes overlapping changes sequentially and allows a negative net benefit after overhead', () => {
  const result = simulateScenario(input(), { currency: 'USD', changes: [{ id: 'trim', vendor: 'Tools', reductionPercent: '20' }, { id: 'negotiate', category: 'software', reductionPercent: '50' }], implementationCost: '70' });
  assert.equal(result.baselineExpense, '100');
  assert.equal(result.projectedExpense, '40');
  assert.equal(result.hypotheticalSavings, '60');
  assert.equal(result.netBenefit, '-10');
  assert.equal(result.effects[0]?.independentSavings, '20');
  assert.equal(result.effects[1]?.independentSavings, '50');
  assert.equal(result.effects[1]?.incrementalSavings, '40');
  assert.equal(result.observedExpenseRefunds, '10');
  assert.equal(result.classification, 'HYPOTHETICAL');
  assert.ok(result.caveats.some(text => /refund/i.test(text)));
});

test('zero effect is the default and currencies remain separate', () => {
  const baseline = simulateScenario(input(), { currency: 'USD', changes: [] });
  assert.equal(baseline.hypotheticalSavings, '0');
  assert.equal(baseline.projectedExpense, '100');
  const eur = simulateScenario(input(), { currency: 'EUR', changes: [{ id: 'cancel', vendor: 'Tools', reductionPercent: '100' }] });
  assert.equal(eur.hypotheticalSavings, '50');
});

test('rejects bad assumptions, unknown options, ambiguous scope and nonexistent populations', () => {
  const invalid = [
    { currency: 'USD', changes: [{ id: 'a', vendor: 'Tools', reductionPercent: '101' }] },
    { currency: 'USD', changes: [{ id: 'a', vendor: 'Tools', reductionPercent: '-1' }] },
    { currency: 'USD', changes: [{ id: 'a', reductionPercent: '10' }] },
    { currency: 'USD', changes: [{ id: 'a', vendor: 'Ghost', reductionPercent: '10' }] },
    { currency: 'USD', changes: [{ id: 'a', vendor: 'Sales', reductionPercent: '10' }] },
    { currency: 'USD', changes: [{ id: 'a', allExpenses: true, reductionPercent: '10', vendor: 'Tools' }] },
    { currency: 'USD', changes: [{ id: 'a', vendor: 'Tools', reductionPercent: '10' }, { id: 'a', vendor: 'Tools', reductionPercent: '10' }] },
    { currency: 'USD', changes: [], implementationCost: '-2' },
    { currency: 'GBP', changes: [] },
    { currency: 'USD', changes: [], surprise: true },
    { currency: 'USD', changes: [{ id: 'a', vendor: 'Tools', reductionPercent: 10 }] },
    null,
  ];
  for (const options of invalid) assert.throws(() => simulateScenario(input(), options as never));
});

test('keeps subcent arithmetic and conservative per-step precision explicit', () => {
  const ledger = importLedgerCsv('date,vendor,category,amount,currency,kind\n2026-09-01,A,x,0.03,USD,expense');
  const result = simulateScenario(ledger, { currency: 'USD', changes: [{ id: 'all', allExpenses: true, reductionPercent: '10' }] });
  assert.equal(result.hypotheticalSavings, '0.003');
  assert.equal(result.projectedExpense, '0.027');
});
