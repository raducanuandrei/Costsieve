import { d, parseDay } from './money.ts';
import type { BusinessReport, Finding, GroupSummary, ImportResult, LedgerRow, MoneyTotals, Subscription } from './types.ts';

export interface AnalysisOptions {
  subscriptions?: ImportResult<Subscription>;
  observationStart?: string;
  observationEnd?: string;
  generatedAt?: string;
  allowPartial?: boolean;
  dataOrigin?: 'USER_SUPPLIED' | 'SYNTHETIC_DEMO';
}

export function assertUsable<T>(input: ImportResult<T>, allowPartial = false): void {
  if (input.errors.some(error => error.row === null)) throw new Error('CSV headers, columns or structure are invalid. Correct the import before analysis.');
  if (!input.rows.length) throw new Error('There are no valid records to analyze.');
  if (input.errors.length && !allowPartial) throw new Error('Review excluded records and set allowPartial: true explicitly to continue.');
}

function totals(rows: LedgerRow[]): MoneyTotals {
  let expense = d(0), expenseRefunds = d(0), revenue = d(0), revenueRefunds = d(0), transfers = d(0);
  for (const row of rows) {
    if (row.kind === 'expense') expense = expense.plus(row.amount);
    else if (row.kind === 'expense_refund') expenseRefunds = expenseRefunds.plus(row.amount);
    else if (row.kind === 'revenue') revenue = revenue.plus(row.amount);
    else if (row.kind === 'revenue_refund') revenueRefunds = revenueRefunds.plus(row.amount);
    else transfers = transfers.plus(row.amount);
  }
  const netExpense = expense.minus(expenseRefunds), netRevenue = revenue.minus(revenueRefunds);
  return { grossExpense: expense.toFixed(), expenseRefunds: expenseRefunds.toFixed(), netExpense: netExpense.toFixed(), grossRevenue: revenue.toFixed(), revenueRefunds: revenueRefunds.toFixed(), netRevenue: netRevenue.toFixed(), recordedSurplus: netRevenue.minus(netExpense).toFixed(), transfers: transfers.toFixed() };
}

function groupRows(rows: LedgerRow[], getKey: (row: LedgerRow) => string): GroupSummary[] {
  const groups = new Map<string, { key: string; currency: string; rows: LedgerRow[] }>();
  for (const row of rows) {
    const key = getKey(row), id = JSON.stringify([row.currency, key]);
    const group = groups.get(id) ?? { key, currency: row.currency, rows: [] };
    group.rows.push(row); groups.set(id, group);
  }
  return [...groups.values()].map(group => ({ key: group.key, currency: group.currency, rows: group.rows.length, ...totals(group.rows) })).sort((a, b) => a.currency.localeCompare(b.currency) || a.key.localeCompare(b.key));
}

function monthShift(month: string, delta: number): string | null {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  if (date.getUTCFullYear() < 0 || date.getUTCFullYear() > 9999) return null;
  return date.toISOString().slice(0, 7);
}

function monthEnd(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1); date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function ledgerFindings(rows: LedgerRow[], byVendor: GroupSummary[], currencies: BusinessReport['currencies']): Finding[] {
  const findings: Finding[] = [];
  const expenses = rows.filter(row => row.kind === 'expense' && d(row.amount).gt(0));
  const candidateGroups = new Map<string, LedgerRow[]>();
  const vendorGroups = new Map<string, LedgerRow[]>();
  for (const row of expenses) {
    const key = JSON.stringify([row.currency, row.vendor.toLowerCase(), row.date, row.amount]);
    const group = candidateGroups.get(key) ?? []; group.push(row); candidateGroups.set(key, group);
    const vendorKey = JSON.stringify([row.currency, row.vendor]);
    const vendorRows = vendorGroups.get(vendorKey) ?? []; vendorRows.push(row); vendorGroups.set(vendorKey, vendorRows);
  }
  for (const group of candidateGroups.values()) {
    if (group.length < 2) continue;
    const first = group[0]!;
    findings.push({ id: `duplicate:${first.sourceRow}`, kind: 'possible_duplicate', classification: 'MEASURED', currency: first.currency, vendor: first.vendor, title: 'Review matching payments', evidenceRows: group.map(row => row.sourceRow), evidenceSource: 'ledger', observedAmount: first.amount, estimatedMonthlyOpportunity: null, explanation: `${group.length} expense records have the same vendor, UTC date and amount. All remain included in spending.`, caveat: 'These may be legitimate separate purchases. Review invoices before treating any charge as a duplicate; no saving is assumed.' });
  }
  for (const currency of currencies) {
    const largest = byVendor.filter(row => row.currency === currency.currency).sort((a, b) => d(b.grossExpense).comparedTo(a.grossExpense))[0];
    if (!largest || d(currency.grossExpense).isZero() || d(largest.grossExpense).div(currency.grossExpense).lt('0.5')) continue;
    findings.push({ id: `concentration:${currency.currency}`, kind: 'spend_concentration', classification: 'MEASURED', currency: currency.currency, vendor: largest.key, title: 'Review the largest vendor commitment', evidenceRows: expenses.filter(row => row.vendor === largest.key && row.currency === currency.currency).map(row => row.sourceRow), evidenceSource: 'ledger', observedAmount: largest.grossExpense, estimatedMonthlyOpportunity: null, explanation: 'This vendor represents at least half of gross expenses in this currency. Review the contract, necessity and renewal terms.', caveat: 'Concentration is a prioritization signal, not evidence of waste, a market benchmark or a cheaper equivalent.' });
  }
  for (const vendorRows of vendorGroups.values()) {
    const months = new Map<string, LedgerRow[]>();
    for (const row of vendorRows) { const key = row.date.slice(0, 7); const group = months.get(key) ?? []; group.push(row); months.set(key, group); }
    let run: LedgerRow[] = [], candidate: LedgerRow[] = [];
    for (const [month, group] of [...months.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (group.length !== 1) { run = []; continue; }
      const row = group[0]!, previous = run.at(-1);
      if (!previous || monthShift(previous.date.slice(0, 7), 1) !== month) run = [];
      run.push(row);
      if (run.length > 3) run.shift();
      const anchor = run[0]!;
      if (run.length === 3 && run.every(item => d(item.amount).minus(anchor.amount).abs().div(anchor.amount).lte('0.05'))) candidate = [...run];
    }
    if (candidate.length < 3) continue;
    const first = candidate[0]!, latest = candidate.at(-1)!;
    findings.push({ id: `recurring:${first.sourceRow}`, kind: 'recurring_charge', classification: 'MEASURED', currency: first.currency, vendor: first.vendor, title: 'Review a recurring-charge candidate', evidenceRows: candidate.map(row => row.sourceRow), evidenceSource: 'ledger', observedAmount: latest.amount, estimatedMonthlyOpportunity: null, explanation: 'One charge per month for three consecutive months, each within 5% of the first charge in this window. Review renewal, usage and contract terms.', caveat: 'A stable payment pattern does not prove a subscription, unnecessary spending or cancellability. No cancellation saving is assumed.' });
  }
  return findings;
}

export function analyzeBusiness(input: ImportResult<LedgerRow>, options: AnalysisOptions = {}): BusinessReport {
  assertUsable(input, options.allowPartial);
  const rows = input.rows;
  const days = rows.map(row => row.date).sort(), first = days[0]!, last = days.at(-1)!;
  if (Boolean(options.observationStart) !== Boolean(options.observationEnd)) throw new Error('Provide both observationStart and observationEnd.');
  const observationStart = options.observationStart ? parseDay(options.observationStart) : null;
  const observationEnd = options.observationEnd ? parseDay(options.observationEnd) : null;
  if (observationStart && observationEnd && observationStart > observationEnd) throw new Error('Observation start must not follow observation end.');
  if ((observationStart && first < observationStart) || (observationEnd && last > observationEnd)) throw new Error('Transactions fall outside the declared observation period.');
  const generated = new Date(options.generatedAt ?? Date.now());
  if (!Number.isFinite(generated.getTime())) throw new Error('generatedAt must be a valid timestamp.');
  const byVendor = groupRows(rows, row => row.vendor), byCategory = groupRows(rows, row => row.category), byMonth = groupRows(rows, row => row.date.slice(0, 7));
  const currencies = groupRows(rows, () => '').map(({ key: _key, rows: _rows, ...summary }) => ({ ...summary, hasRevenue: rows.some(row => row.currency === summary.currency && row.kind === 'revenue') }));
  const findings = ledgerFindings(rows, byVendor, currencies);
  const monthlyChanges: BusinessReport['monthlyChanges'] = [];
  if (observationStart && observationEnd) {
    const monthly = new Map(byMonth.map(row => [JSON.stringify([row.currency, row.key]), row]));
    for (const summary of currencies) {
      const candidateMonths = new Set<string>();
      for (const month of byMonth.filter(row => row.currency === summary.currency && (d(row.grossExpense).gt(0) || d(row.expenseRefunds).gt(0)))) {
        candidateMonths.add(month.key);
        const nextMonth = monthShift(month.key, 1);
        if (nextMonth) candidateMonths.add(nextMonth);
      }
      for (const month of [...candidateMonths].sort()) {
        const previousMonth = monthShift(month, -1);
        if (!previousMonth) continue;
        if (`${previousMonth}-01` < observationStart || monthEnd(month) > observationEnd) continue;
        const previousExpense = monthly.get(JSON.stringify([summary.currency, previousMonth]))?.netExpense ?? '0';
        const expense = monthly.get(JSON.stringify([summary.currency, month]))?.netExpense ?? '0';
        const delta = d(expense).minus(previousExpense);
        monthlyChanges.push({ currency: summary.currency, previousMonth, month, previousExpense, expense, delta: delta.toFixed(), changePercent: d(previousExpense).gt(0) ? delta.div(previousExpense).mul(100).toDecimalPlaces(6).toFixed() : null });
      }
    }
  }
  const inventory = options.subscriptions;
  if (inventory) assertUsable(inventory, options.allowPartial);
  const subscriptionGroups = new Map<string, { monthly: ReturnType<typeof d>; unused: ReturnType<typeof d>; unknown: number }>();
  for (const subscription of inventory?.rows ?? []) {
    const monthly = d(subscription.amountPerCycle).div(subscription.billingCycle === 'annual' ? 12 : 1).toDecimalPlaces(12);
    const group = subscriptionGroups.get(subscription.currency) ?? { monthly: d(0), unused: d(0), unknown: 0 };
    group.monthly = group.monthly.plus(monthly);
    const known = subscription.seats !== undefined && subscription.activeSeats !== undefined;
    const unused = known ? monthly.mul(subscription.seats! - subscription.activeSeats!).div(subscription.seats!).toDecimalPlaces(12) : null;
    if (unused) group.unused = group.unused.plus(unused); else group.unknown++;
    subscriptionGroups.set(subscription.currency, group);
    if (known && unused!.isZero()) continue;
    findings.push({ id: `subscription:${subscription.sourceRow}`, kind: known ? 'unused_seats' : 'unknown_seat_usage', classification: known ? 'ESTIMATED' : 'MEASURED', currency: subscription.currency, vendor: subscription.vendor, title: known ? 'Review unused paid seats' : 'Collect subscription usage evidence', evidenceRows: [subscription.sourceRow], evidenceSource: 'subscription_inventory', observedAmount: subscription.amountPerCycle, estimatedMonthlyOpportunity: unused?.toFixed() ?? null, explanation: known ? `${subscription.seats! - subscription.activeSeats!} of ${subscription.seats} declared seats are inactive. Estimate assumes uniform per-seat pricing and the supplied usage is current.` : 'No seat usage was supplied; unused-license savings cannot be inferred.', caveat: 'Inventory is separate from the ledger. Annual commitments, minimum tiers, bundled pricing and contract terms may prevent immediate savings. Monthly equivalents are estimates, not savings achieved.' });
  }
  const excludedRows = input.totalRows - rows.length;
  const inventoryExcluded = inventory ? inventory.totalRows - inventory.rows.length : 0;
  const limitations = [
    'DRAFT: recorded surplus is net recorded revenue minus net recorded expenses, not audited profit, cash balance or a tax calculation. Completeness of the supplied records is not independently verified.',
    'Currencies are reported separately. No foreign-exchange conversion or cross-currency total is computed.',
    'Candidate findings are review prompts, not achieved or guaranteed savings. No money has been moved and no contract changed.',
    'Exports contain summaries and evidence row numbers, not raw descriptions or transaction identifiers. Vendor/category labels can still identify a business; share deliberately.',
  ];
  if (currencies.some(row => !row.hasRevenue)) limitations.push('Some currencies have no revenue records. Their recorded surplus does not measure business profitability.');
  if (!observationStart) limitations.push('Observation completeness was not declared. Transaction dates do not prove complete months; monthly percentage comparisons are omitted.');
  if (!inventory) limitations.push('No subscription inventory was supplied. Unused-seat savings cannot be inferred from payment totals.');
  if (excludedRows || inventoryExcluded) limitations.push('Excluded records make this a partial analysis. Correct source errors before relying on totals.');
  return {
    schemaVersion: 'costsieve-business-v1', dataOrigin: options.dataOrigin ?? 'USER_SUPPLIED', reviewStatus: 'DRAFT — human review required', generatedAt: generated.toISOString(), status: excludedRows || inventoryExcluded ? 'partial' : 'complete',
    currencyPolicy: 'Separate currency totals; no FX conversion. Currency codes are user-supplied three-letter labels.',
    period: { firstTransaction: first, lastTransaction: last, observationStart, observationEnd, timezone: 'UTC' },
    coverage: { totalRows: input.totalRows, validRows: rows.length, excludedRows, issues: input.errors.map(error => ({ ...error })) },
    currencies, byVendor, byCategory, byMonth, monthlyChanges,
    subscriptions: { coverage: { totalRows: inventory?.totalRows ?? 0, validRows: inventory?.rows.length ?? 0, excludedRows: inventoryExcluded, issues: inventory?.errors.map(error => ({ ...error })) ?? [] }, byCurrency: [...subscriptionGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, group]) => ({ currency, monthlyCommitment: group.monthly.toFixed(), estimatedUnusedSeatCost: group.unused.toFixed(), entriesMissingUsage: group.unknown })) },
    findings, limitations,
  };
}
