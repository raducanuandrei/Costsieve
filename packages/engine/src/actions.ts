import { analyzeBusiness } from './analyze.ts';
import { d, parseDay, parseMagnitude } from './money.ts';
import type { BusinessReport, ImportResult, LedgerRow, TransactionKind } from './types.ts';

export interface SourceRef { documentId: string; kind: 'csv' | 'xlsx' | 'pdf' | 'image'; record: number; sheet?: string; page?: number }
export interface NormalizedRecord extends LedgerRow { recordId: string; source: SourceRef }
export interface CostAction { id: string; targetRecordIds: string[]; reductionPercent?: string; replacementCost?: string }
export type RecommendationKind = 'possible_duplicate' | 'recurring_charge' | 'spend_concentration' | 'unused_seats';
export interface Recommendation {
  id: string; kind: RecommendationKind; title: string; currency: string; targetRecordIds: string[]; evidence: SourceRef[];
  estimatedSavings: string | null; period: { from: string; to: string }; explanation: string; caveat: string; action: CostAction | null;
}
export interface UsageAnswer { targetRecordIds: string[]; paidSeats: number; activeSeats: number; uniformPricing: boolean; reductionAllowed: boolean }
export interface BusinessAnalysis { report: BusinessReport; recommendations: Recommendation[]; questions: { id: string; recommendationId: string; text: string; targetRecordIds: string[] }[] }

const obj = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, field: string) => { if (typeof value !== 'string' || !value.trim() || value.length > 500) throw new Error(`${field} requires a nonempty string of at most 500 characters.`); return value.trim(); };

export function validateLedgerRows(input: unknown[]): ImportResult<NormalizedRecord> {
  if (!Array.isArray(input) || input.length > 100_000) throw new Error('Expected at most 100,000 normalized records.');
  const ids = new Set<string>();
  const rows = input.map((value): NormalizedRecord => {
    if (!obj(value)) throw new Error('Each record must be an object.');
    const recordId = text(value.recordId, 'recordId');
    if (ids.has(recordId)) throw new Error('recordId must be globally unique.');
    ids.add(recordId);
    const source = value.source;
    if (!obj(source) || !['csv', 'xlsx', 'pdf', 'image'].includes(String(source.kind)) || !Number.isSafeInteger(source.record) || Number(source.record) < 1) throw new Error('Each record requires a valid source reference.');
    const reference: SourceRef = { documentId: text(source.documentId, 'source.documentId'), kind: source.kind as SourceRef['kind'], record: Number(source.record) };
    if (source.sheet !== undefined) reference.sheet = text(source.sheet, 'source.sheet');
    if (source.page !== undefined) { if (!Number.isSafeInteger(source.page) || Number(source.page) < 1) throw new Error('Invalid source page.'); reference.page = Number(source.page); }
    const kind = text(value.kind, 'kind') as TransactionKind;
    if (!['expense', 'revenue', 'expense_refund', 'revenue_refund', 'transfer'].includes(kind)) throw new Error('Unknown transaction kind.');
    const currency = text(value.currency, 'currency').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('An explicit three-letter currency is required.');
    const row: NormalizedRecord = { recordId, source: reference, sourceRow: reference.record, date: parseDay(text(value.date, 'date')), vendor: text(value.vendor, 'vendor'), category: value.category ? text(value.category, 'category') : 'Uncategorized', amount: parseMagnitude(text(value.amount, 'amount')), currency, kind };
    if (value.transactionId !== undefined && value.transactionId !== '') row.transactionId = text(value.transactionId, 'transactionId');
    return row;
  });
  return { rows, totalRows: rows.length, errors: [], format: 'costsieve-ledger-v1' };
}

export function analyzeRecords(input: ImportResult<NormalizedRecord>, context: { usage?: UsageAnswer[]; generatedAt?: string } = {}): BusinessAnalysis {
  const validated = validateLedgerRows(input.rows);
  // Legacy evidence uses row numbers; unique internal numbers are remapped to qualified sources below.
  const numbered = validated.rows.map((row, index) => ({ ...row, sourceRow: index + 2 }));
  const report = analyzeBusiness({ ...input, rows: numbered }, context.generatedAt ? { generatedAt: context.generatedAt } : {});
  const index = new Map(numbered.map(row => [row.sourceRow, row]));
  const recommendations: Recommendation[] = report.findings.filter(item => item.evidenceSource === 'ledger').map(item => {
    const targets = item.evidenceRows.map(row => index.get(row)!).filter(Boolean);
    const days = targets.map(row => row.date).sort();
    return { id: `${item.kind}:${targets[0]!.recordId}`, kind: item.kind as RecommendationKind, title: item.title, currency: item.currency, targetRecordIds: targets.map(row => row.recordId), evidence: targets.map(row => row.source), estimatedSavings: null, period: { from: days[0]!, to: days.at(-1)! }, explanation: item.explanation, caveat: item.caveat, action: null };
  });
  report.findings = report.findings.map(item => {
    const targets = item.evidenceRows.map(row => index.get(row)!).filter(Boolean);
    return { ...item, id: `${item.kind}:${targets[0]!.recordId}`, evidence: targets.map(row => row.source), targetRecordIds: targets.map(row => row.recordId) };
  });
  const usageTargets = new Set<string>();
  const recordIndex = new Map(validated.rows.map(row => [row.recordId, row]));
  for (const answer of context.usage ?? []) {
    if (!obj(answer) || !Array.isArray(answer.targetRecordIds) || !answer.targetRecordIds.length || new Set(answer.targetRecordIds).size !== answer.targetRecordIds.length || !Number.isSafeInteger(answer.paidSeats) || answer.paidSeats < 1 || !Number.isSafeInteger(answer.activeSeats) || answer.activeSeats < 0 || answer.activeSeats > answer.paidSeats || typeof answer.uniformPricing !== 'boolean' || typeof answer.reductionAllowed !== 'boolean') throw new Error('Usage requires explicit target records, valid seat counts, pricing and contract confirmations.');
    const targets = answer.targetRecordIds.map(id => recordIndex.get(id));
    for (const id of answer.targetRecordIds) { if (usageTargets.has(id)) throw new Error('Usage answers overlap. Supply one answer per expense.'); usageTargets.add(id); }
    if (targets.some(row => !row || row.kind !== 'expense') || new Set(targets.map(row => row!.currency)).size !== 1) throw new Error('Usage targets must be expenses in one currency.');
    if (!answer.uniformPricing || !answer.reductionAllowed || answer.activeSeats === answer.paidSeats) continue;
    const matched = targets as NormalizedRecord[];
    const cost = matched.reduce((sum, row) => sum.plus(row.amount), d(0));
    const replacementCost = cost.mul(answer.activeSeats).div(answer.paidSeats).toDecimalPlaces(12).toFixed();
    const days = matched.map(row => row.date).sort(), id = `unused_seats:${matched[0]!.recordId}`;
    recommendations.push({ id, kind: 'unused_seats', title: 'Review unused paid seats', currency: matched[0]!.currency, targetRecordIds: [...answer.targetRecordIds], evidence: matched.map(row => row.source), estimatedSavings: cost.minus(replacementCost).toFixed(), period: { from: days[0]!, to: days.at(-1)! }, explanation: `${answer.paidSeats - answer.activeSeats} of ${answer.paidSeats} paid seats are inactive according to the supplied answer.`, caveat: 'Hypothetical effect on the selected recorded charges, assuming unchanged revenue, uniform seat pricing and a permitted reduction. Not money already saved or an annual forecast.', action: { id, targetRecordIds: [...answer.targetRecordIds], replacementCost } });
  }
  const questions = recommendations.filter(item => item.kind === 'recurring_charge' || item.kind === 'spend_concentration').filter(item => !context.usage?.some(answer => answer.targetRecordIds.some(id => item.targetRecordIds.includes(id)))).slice(0, 3).map(item => ({ id: `usage:${item.id}`, recommendationId: item.id, targetRecordIds: item.targetRecordIds, text: 'Is this a per-seat subscription? If so, how many seats are paid/active, is pricing uniform, and do contract terms permit a reduction?' }));
  return { report, recommendations, questions };
}

export function simulateActions(input: ImportResult<NormalizedRecord>, actions: CostAction[], options: { currency: string; implementationCost?: string }) {
  const validated = validateLedgerRows(input.rows);
  if (!obj(options) || !/^[A-Z]{3}$/.test(options.currency)) throw new Error('Select one currency.');
  if (!Array.isArray(actions) || actions.length > 50) throw new Error('Select at most 50 explicit actions.');
  const expenses = validated.rows.filter(row => row.currency === options.currency && row.kind === 'expense');
  const expenseIndex = new Map(expenses.map(row => [row.recordId, row]));
  if (!expenses.length) throw new Error('No expenses in the selected currency.');
  const used = new Set<string>(), ids = new Set<string>();
  let savings = d(0);
  const effects = actions.map(action => {
    if (!obj(action) || typeof action.id !== 'string' || !action.id || ids.has(action.id) || !Array.isArray(action.targetRecordIds) || !action.targetRecordIds.length) throw new Error('Each action requires a unique id and explicit target record IDs.');
    ids.add(action.id);
    if ((action.reductionPercent === undefined) === (action.replacementCost === undefined)) throw new Error('Choose reductionPercent or replacementCost, not both.');
    let baseline = d(0);
    for (const id of action.targetRecordIds) {
      if (used.has(id)) throw new Error('Selected actions overlap. Choose one alternative per expense.');
      const row = expenseIndex.get(id);
      if (!row) throw new Error('Action targets an unknown record, another currency or a non-expense.');
      used.add(id); baseline = baseline.plus(row.amount);
    }
    let projected;
    if (action.replacementCost !== undefined) projected = d(parseMagnitude(text(action.replacementCost, 'replacementCost')));
    else { const percent = d(parseMagnitude(text(action.reductionPercent, 'reductionPercent'))); if (percent.gt(100)) throw new Error('reductionPercent must be between 0 and 100.'); projected = baseline.mul(d(100).minus(percent)).div(100).toDecimalPlaces(12); }
    const delta = baseline.minus(projected); savings = savings.plus(delta);
    return { id: action.id, targetRecordIds: [...action.targetRecordIds], baseline: baseline.toFixed(), projected: projected.toFixed(), hypotheticalSavings: delta.toFixed() };
  });
  const baseline = expenses.reduce((sum, row) => sum.plus(row.amount), d(0));
  const overhead = parseMagnitude(options.implementationCost ?? '0'), net = savings.minus(overhead);
  const currency = analyzeBusiness(validated).currencies.find(row => row.currency === options.currency)!;
  const days = validated.rows.filter(row => row.currency === options.currency).map(row => row.date).sort();
  return { classification: 'HYPOTHETICAL' as const, currency: options.currency, period: { from: days[0]!, to: days.at(-1)! }, basis: 'Gross selected recorded charges for the imported period; refunds are unallocated and no future savings are inferred.', baselineExpense: baseline.toFixed(), projectedExpense: baseline.minus(savings).toFixed(), hypotheticalSavings: savings.toFixed(), implementationCost: overhead, netBenefit: net.toFixed(), recordedResultBefore: currency.hasRevenue ? currency.recordedSurplus : null, recordedResultAfter: currency.hasRevenue ? d(currency.recordedSurplus).plus(net).toFixed() : null, effects, assumptions: 'Revenue unchanged; declared one-time implementation cost included; recorded result is not audited profit. Do not count reductions on refunded purchases as recoverable cash.' };
}

const guides: Record<RecommendationKind, { title: string; steps: string[]; verification: string; rollback: string }> = {
  unused_seats: { title: 'Reduce unused paid seats', steps: ['Check active users and confirm dormant seats are not needed for backups, service accounts or upcoming staff.', 'Review minimum commitments, renewal date and the consequences of removing a seat.', 'Back up data and reassign ownership before reducing seats through the provider.', 'Record the new charge and any implementation or termination fee.'], verification: 'Compare the next invoice with the agreed seat count and verify that work and data access are unaffected.', rollback: 'Restore seats or access if a required user or service is disrupted; include restoration fees in the actual outcome.' },
  possible_duplicate: { title: 'Review matching payments', steps: ['Compare invoice references, transaction IDs and delivery details.', 'Distinguish a duplicated export from two actual charges or legitimate separate purchases.', 'If two actual charges cover one purchase, contact the supplier with evidence and request review.'], verification: 'Only count recovery when a refund or credit is documented; reconciling duplicate documents is not a saving.', rollback: 'Restore excluded records if evidence shows separate purchases.' },
  recurring_charge: { title: 'Review a recurring commitment', steps: ['Identify the service and business purpose.', 'Check actual usage, dependencies, contract terms and renewal dates.', 'Compare a confirmed smaller plan or cancellation cost against the current commitment.', 'Schedule any change after backups and owner approval.'], verification: 'Check the next billing cycle and operational impact; include switching costs.', rollback: 'Keep a restoration path and the required data until the replacement is proven.' },
  spend_concentration: { title: 'Review a major vendor', steps: ['Break down the vendor commitment into services and owners.', 'Check necessity, usage and contract restrictions.', 'Request a documented alternative offer or negotiate; do not assume a discount.', 'Test any replacement before migration and record one-time costs.'], verification: 'Compare total cost and equivalent service quality for the same workload and period.', rollback: 'Retain the original service until migration and data recovery have been tested.' },
};

export function getActionGuide(kind: RecommendationKind) {
  if (!Object.hasOwn(guides, kind)) throw new Error('Unknown guide.');
  return { version: '1.0', kind, ...guides[kind], steps: [...guides[kind].steps] };
}
