import { d, parseMagnitude } from './money.ts';
import { assertUsable } from './analyze.ts';
import type { ImportResult, LedgerRow } from './types.ts';

export interface CostChange {
  id: string;
  vendor?: string;
  category?: string;
  allExpenses?: boolean;
  reductionPercent: string;
}

export interface ScenarioOptions {
  currency: string;
  changes: CostChange[];
  implementationCost?: string;
  allowPartial?: boolean;
}

export interface ScenarioResult {
  classification: 'HYPOTHETICAL';
  currency: string;
  period: { from: string; to: string };
  basis: string;
  baselineExpense: string;
  observedExpenseRefunds: string;
  projectedExpense: string;
  hypotheticalSavings: string;
  implementationCost: string;
  netBenefit: string;
  effects: { id: string; matchedRows: number; reductionPercent: string; independentSavings: string; incrementalSavings: string }[];
  assumptions: CostChange[];
  caveats: string[];
}

function object(value: unknown, keys: string[], context: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`${context} must be an object containing only documented fields.`);
}

export function simulateScenario(input: ImportResult<LedgerRow>, options: ScenarioOptions): ScenarioResult {
  object(options, ['currency', 'changes', 'implementationCost', 'allowPartial'], 'Scenario');
  if (options.allowPartial !== undefined && typeof options.allowPartial !== 'boolean') throw new Error('allowPartial must be a boolean.');
  assertUsable(input, options.allowPartial);
  if (typeof options.currency !== 'string' || !/^[A-Z]{3}$/.test(options.currency)) throw new Error('Select one explicit uppercase currency.');
  if (!Array.isArray(options.changes) || options.changes.length > 50) throw new Error('changes must be an array of at most 50 explicit assumptions.');
  if (options.implementationCost !== undefined && typeof options.implementationCost !== 'string') throw new Error('implementationCost must be a decimal string.');
  const implementationCost = parseMagnitude(options.implementationCost ?? '0');
  const expenses = input.rows.filter(row => row.currency === options.currency && row.kind === 'expense');
  if (!expenses.length) throw new Error('No expense records match the selected currency.');
  const remaining = expenses.map(row => d(row.amount));
  const baseline = remaining.reduce((sum, amount) => sum.plus(amount), d(0));
  const ids = new Set<string>();
  const effects: ScenarioResult['effects'] = [];
  const assumptions: CostChange[] = [];
  for (const change of options.changes) {
    object(change, ['id', 'vendor', 'category', 'allExpenses', 'reductionPercent'], 'Change');
    if (typeof change.id !== 'string' || !change.id.trim() || change.id.length > 100 || ids.has(change.id)) throw new Error('Each change requires a unique nonempty id of at most 100 characters.');
    ids.add(change.id);
    if (typeof change.reductionPercent !== 'string') throw new Error('reductionPercent must be a decimal string from 0 to 100.');
    const percent = parseMagnitude(change.reductionPercent);
    if (d(percent).gt(100)) throw new Error('reductionPercent must be between 0 and 100.');
    for (const field of ['vendor', 'category'] as const) {
      if (change[field] !== undefined && (typeof change[field] !== 'string' || !change[field].trim() || change[field].length > 500)) throw new Error(`${field} must be an explicit nonempty label.`);
    }
    if (change.allExpenses !== undefined && typeof change.allExpenses !== 'boolean') throw new Error('allExpenses must be a boolean.');
    if (change.allExpenses ? change.vendor !== undefined || change.category !== undefined : !change.vendor && !change.category) throw new Error('Select vendor/category filters, or explicitly set allExpenses: true; do not combine them.');
    const selected = expenses.map((row, index) => ({ row, index })).filter(({ row }) => change.allExpenses || ((!change.vendor || row.vendor === change.vendor) && (!change.category || row.category === change.category)));
    if (!selected.length) throw new Error('A change matches no expense records. Check the exact vendor/category labels and currency.');
    const factor = d(100).minus(percent).div(100);
    let incremental = d(0), independent = d(0);
    for (const { row, index } of selected) {
      const old = remaining[index]!, next = old.mul(factor).toDecimalPlaces(12);
      incremental = incremental.plus(old.minus(next)); remaining[index] = next;
      independent = independent.plus(d(row.amount).minus(d(row.amount).mul(factor).toDecimalPlaces(12)));
    }
    effects.push({ id: change.id, matchedRows: selected.length, reductionPercent: percent, independentSavings: independent.toFixed(), incrementalSavings: incremental.toFixed() });
    assumptions.push({ ...change, reductionPercent: percent });
  }
  const projected = remaining.reduce((sum, amount) => sum.plus(amount), d(0)), savings = baseline.minus(projected);
  const days = input.rows.filter(row => row.currency === options.currency).map(row => row.date).sort();
  const refunds = input.rows.filter(row => row.currency === options.currency && row.kind === 'expense_refund').reduce((sum, row) => sum.plus(row.amount), d(0));
  return {
    classification: 'HYPOTHETICAL', currency: options.currency, period: { from: days[0]!, to: days.at(-1)! },
    basis: 'Gross imported expense charges for the observed period; no annual extrapolation.',
    baselineExpense: baseline.toFixed(), observedExpenseRefunds: refunds.toFixed(), projectedExpense: projected.toFixed(), hypotheticalSavings: savings.toFixed(), implementationCost,
    netBenefit: savings.minus(implementationCost).toFixed(), effects, assumptions,
    caveats: [
      'User-entered reductions are assumptions, not evidence that suppliers will offer a discount or that service quality and business outcomes remain equivalent.',
      'Refunds, revenue and transfers are excluded from the scenario. Gross expense reductions are not net savings on already-refunded purchases; inspect the separately reported expense refunds.',
      'Changes apply in the supplied order to remaining expenses. Independent effects must not be added together where populations overlap.',
      'Each row is rounded to 12 decimal places after each transformation, half up. No rounding to cents occurs inside the calculation.',
      'Implementation cost is a one-time user assumption in the selected currency. No future period, extra revenue, recurring overhead or tax effect is inferred.',
      ...(input.errors.length ? ['This scenario uses a partial import; excluded records may change the result.'] : []),
    ],
  };
}
